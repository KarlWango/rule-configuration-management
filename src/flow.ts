import type { UiCommand } from './core/bridge';
import type { DiffResult } from './core/diff';
import type { PairDraft } from './core/pairDrafts';
import type { Plan } from './core/plan';
import type { LangTag, Settings } from './core/settings';
import type { NetSetTableRow } from './core/tableImport';
import type { ConfigSetData, ModuleKey, RuleConfigSet } from './core/types';
/**
 * 向导控制器：把内核（导出 / 预览 / 导入）与内联框架界面接起来。
 *
 * 界面状态由本控制器单向发布，界面只回传指令；界面层不直接接触 EDA API。
 */
import { Channel } from './core/bridge';
import { collectModules } from './core/collect';
import { diffPlan } from './core/diff';
import { eda, fileSystem, toast } from './core/eda';
import { parseConfigSet, runExport, runImport } from './core/engine';
import { buildNetIndex } from './core/netindex';
import { scheduleOverlayCleanup } from './core/overlay';
import { appendPairDrafts, buildExportSummary } from './core/pairDrafts';
import { buildPlan } from './core/plan';
import { loadSettings, saveSettings } from './core/settings';
import { decodeCsv, parseNetSetTable } from './core/tableImport';
import { text } from './core/text';
import { ALL_MODULES, MODULE_LABELS, SCHEMA_ID, SCHEMA_VERSION } from './core/types';
import { parseNetList } from './core/util';

export const IFRAME_ID = 'rcm-wizard';
export const IFRAME_FILE = '/iframe/index.html';
const WINDOW_W = 1020;
const WINDOW_H = 720;
const GENERATOR = { name: 'rule-configuration-management', version: '1.0.0' };

type Mode = 'import' | 'export' | 'netpair';

interface Ctx {
	mode: Mode;
	lang: LangTag;
	settings: Settings;
	file?: RuleConfigSet;
	fileName?: string;
	fileSize?: number;
	warnings: string[];
	error?: string;
	modules: Record<string, boolean>;
	exportFileName: string;
	diff?: DiffResult;
	steps?: any[];
	residualSummary?: Record<string, number>;
	skippedItems?: { module: string; what: string; reason: string }[];
	savedName?: string;
	log: string[];
	/** 预览时抓取的「导入前现场」：导入后可一键还原 */
	snapshot?: { data: ConfigSetData; modules: ModuleKey[]; draftClasses?: string[] };
	/** 本次结果是否为「还原」产生 */
	restored?: boolean;
	/** 「网络集合规则」直写入口：集合输入框 + 可选网络类，复用导入管线写入 */
	netpair?: {
		groups: string[];
		rules: Record<string, string[]>;
		group?: string;
		a: string;
		b: string;
		rule: string;
		classA?: string;
		classB?: string;
		preview?: { aCount: number; bCount: number; total: number; missingA: string[]; missingB: string[] };
	};
	/** 导出弹窗用的分组/规则元数据与实时内容清单 */
	npMeta?: { groups: string[]; rules: Record<string, string[]> };
	/** 表格导入结果（带自增 id，界面按 id 合并一次） */
	npdTableImported?: { id: number; drafts?: NetSetTableRow[]; error?: string };
	exportSummary?: ReturnType<typeof buildExportSummary>;
}

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

/** 集合输入解析：支持 / , ， ; ； 与空白符分隔（固定格式，不做表达式解析） */
function defaultExportName(): string {
	const d = new Date();
	return `Config_DesignRule_PCB_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
}

/** 界面 / 日志用：本地时区的「年-月-日 时:分:秒」（文件里的 exportedAt 仍保留 ISO 格式） */
function formatDateTime(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} `
		+ `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export class Wizard {
	private readonly channel = new Channel(command => void this.handle(command));
	private ctx: Ctx = this.freshCtx('import');
	private tableImportSeq = 0;
	private started = false;

	private freshCtx(mode: Mode): Ctx {
		const settings = loadSettings();
		// 导出勾选沿用上次：设置里存「上次勾了哪些」，没记录过则默认全选
		const remembered = settings.lastExportModules;
		const modules: Record<string, boolean> = {};
		for (const key of ALL_MODULES) modules[key] = remembered ? remembered.includes(key) : true;
		return {
			mode,
			lang: 'zh-Hans',
			settings,
			warnings: [],
			modules,
			exportFileName: defaultExportName(),
			log: [],
		};
	}

	private t(tag: string, args: any[] = []): string {
		return text(tag, this.ctx.lang, args);
	}

	// ---------------------------------------------------------------- 生命周期

	async open(mode: Mode): Promise<void> {
		this.channel.stop();
		this.ctx = this.freshCtx(mode);
		this.ctx.lang = await this.resolveLang();
		if (mode === 'netpair')
			this.ctx.netpair = { ...(await this.collectNetPairData()), a: '', b: '', rule: '', classA: '', classB: '' };
		if (mode === 'export')
			await this.loadExportMeta();
		this.channel.reset();
		await this.show();
		// 导入菜单直达：窗口就绪后自动弹出系统文件选择框；取消则回落到「选择文件」页
		if (mode === 'import')
			setTimeout(() => void this.pickFile(), 200);
	}

	private async collectNetPairData(): Promise<{ groups: string[]; rules: Record<string, string[]> }> {
		const groups: string[] = [];
		const rules: Record<string, string[]> = {};
		try {
			const nbn = await (eda() as any).pcb_Drc.getNetByNetRules();
			for (const key of Object.keys(nbn || {}))
				groups.push(key);
		}
		catch {
		}
		try {
			const rc = await (eda() as any).pcb_Drc.getCurrentRuleConfiguration();
			const cfg = (rc && (rc.config ?? rc)) || {};
			for (const group of groups) {
				rules[group] = [];
				for (const top of Object.keys(cfg)) {
					const groupCfg = (cfg[top] || {})[group];
					if (groupCfg && typeof groupCfg === 'object') {
						rules[group] = Object.keys(groupCfg);
						break;
					}
				}
			}
		}
		catch { /* 无法读取规则配置时按「无规则」处理，写入前校验兜底 */ }
		return { groups, rules };
	}

	/** 导出弹窗的元数据：分组/规则（供附加网络对选择）+ 当前 PCB 将导出的内容清单 */
	private async loadExportMeta(): Promise<void> {
		this.ctx.npMeta = await this.collectNetPairData();
		try {
			const collected = await collectModules();
			this.ctx.exportSummary = buildExportSummary(collected.data as Record<string, any>);
		}
		catch {
			this.ctx.exportSummary = undefined;
		}
	}

	/** 界面语言：设置优先；auto 时跟随编辑器（非中文一律按英文） */
	private async resolveLang(): Promise<LangTag> {
		const setting = loadSettings().uiLanguage;
		if (setting === 'zh-Hans' || setting === 'en')
			return setting;
		try {
			const current = await (eda() as any).sys_I18n?.getCurrentLanguage?.();
			if (typeof current === 'string' && current)
				return current.toLowerCase().startsWith('zh') ? 'zh-Hans' : 'en';
		}
		catch { /* 平台查询失败时按中文 */ }
		return 'zh-Hans';
	}

	private async show(snapshotOverride?: Record<string, any>): Promise<void> {
		const opened = await this.ensureWindow();
		if (!opened) {
			toast(this.t('toast.noWindow'));
			return;
		}
		this.channel.start();
		this.started = true;
		this.publish(snapshotOverride);
	}

	private async ensureWindow(): Promise<boolean> {
		try {
			// 已存在则先关闭，保证每次都是干净的新窗口
			await (eda().sys_IFrame as any).closeIFrame(IFRAME_ID);
		}
		catch { /* 忽略：窗口本就不存在 */ }
		try {
			return await (eda().sys_IFrame as any).openIFrame(IFRAME_FILE, WINDOW_W, WINDOW_H, IFRAME_ID, {
				title: text(`window.title.${this.ctx.mode}`, this.ctx.lang),
				minimizeButton: true,
				maximizeButton: false,
				grayscaleMask: false,
			});
		}
		catch {
			return false;
		}
	}

	// ---------------------------------------------------------------- 状态发布

	private publish(override?: Record<string, any>): void {
		const ctx = this.ctx;
		const state: Record<string, any> = {
			view: this.view(),
			mode: ctx.mode,
			lang: ctx.lang,
			file: ctx.file
				? {
						name: ctx.fileName,
						size: ctx.fileSize,
						modules: ctx.file.modules,
						moduleLabels: ctx.file.modules.map(key => MODULE_LABELS[key as ModuleKey] ?? key),
						edaVersion: ctx.file.edaVersion,
						exportedAt: ctx.file.exportedAt ? formatDateTime(new Date(ctx.file.exportedAt)) : undefined,
						unit: ctx.file.source?.unit,
						ruleConfigName: ctx.file.source?.ruleConfigName,
						schemaVersion: ctx.file.schemaVersion,
					}
				: undefined,
			warnings: ctx.warnings,
			error: ctx.error,
			modules: ALL_MODULES.map(key => ({ key, label: MODULE_LABELS[key], on: ctx.modules[key] !== false })),
			exportFileName: ctx.exportFileName,
			diff: ctx.diff ? this.diffViewModel(ctx.diff) : undefined,
			steps: ctx.steps,
			residualSummary: ctx.residualSummary,
			savedName: ctx.savedName,
			restored: ctx.restored,
			hasSnapshot: !!ctx.snapshot,
			netpair: ctx.netpair ? JSON.parse(JSON.stringify(ctx.netpair)) as typeof ctx.netpair : undefined,
			npMeta: ctx.npMeta ? JSON.parse(JSON.stringify(ctx.npMeta)) as typeof ctx.npMeta : undefined,
			npdTableImported: ctx.npdTableImported,
			exportSummary: ctx.exportSummary ? JSON.parse(JSON.stringify(ctx.exportSummary)) as typeof ctx.exportSummary : undefined,
			log: ctx.log.join('\n'),
			...override,
		};
		this.channel.publish(state);
	}

	private view(): string {
		const ctx = this.ctx;
		if (ctx.steps || ctx.savedName)
			return 'result';
		if (ctx.diff)
			return 'preview';
		if (ctx.mode === 'netpair')
			return 'select-netpair';
		return ctx.mode === 'export' ? 'select-export' : 'select-import';
	}

	private diffViewModel(diff: DiffResult): Record<string, any> {
		const order = new Map(ALL_MODULES.map((key, index) => [key, index]));
		const byModule = new Map<string, any>();
		for (const entry of diff.entries) {
			if (!byModule.has(entry.module)) {
				byModule.set(entry.module, {
					module: entry.module,
					label: MODULE_LABELS[entry.module as ModuleKey] ?? entry.module,
					count: 0,
					entries: [],
				});
			}
			const group = byModule.get(entry.module);
			group.count += 1;
			group.entries.push({
				kind: entry.kind,
				path: entry.path,
				note: entry.note,
				detail: entry.detail,
				fields: (entry.fields || []).slice(0, 200).map(field => ({
					path: field.path,
					left: field.left,
					right: field.right,
				})),
			});
		}
		return {
			summary: diff.summary,
			warnings: diff.warnings,
			skipped: diff.skipped,
			groups: [...byModule.values()].sort(
				(a, b) => (order.get(a.module) ?? 99) - (order.get(b.module) ?? 99),
			),
		};
	}

	// ---------------------------------------------------------------- 指令处理

	private async handle(command: UiCommand): Promise<void> {
		switch (command.type) {
			case 'ready':
				this.channel.claim(command.payload?.nonce);
				this.publish();
				break;
			case 'pickFile':
				await this.pickFile();
				break;
			case 'preview':
				await this.buildPreview();
				break;
			case 'applyImport':
				await this.applyImport();
				break;
			case 'restore':
				await this.doRestore();
				break;
			case 'export':
				await this.doExport(command.payload || {});
				break;
			case 'netpairInput':
				await this.onNetPairInput(command.payload || {});
				break;
			case 'netpairGroup':
				if (this.ctx.netpair) {
					this.ctx.netpair.group = String(command.payload?.group ?? '');
					const groupRules = this.ctx.netpair.rules[this.ctx.netpair.group] || [];
					if (!groupRules.includes(this.ctx.netpair.rule))
						this.ctx.netpair.rule = groupRules[0] ?? '';
					await this.refreshNetPairPreview();
				}
				break;
			case 'netpairRule':
				if (this.ctx.netpair) {
					this.ctx.netpair.rule = String(command.payload?.rule ?? '');
					this.publish();
				}
				break;
			case 'applyNetPair':
				await this.applyNetPair(command.payload || {});
				break;
			case 'npdTableImport':
				await this.npdTableImport(String(command.payload?.group ?? ''));
				break;
			case 'npTableImport':
				await this.npTableImport();
				break;
			case 'restart':
				this.ctx = this.freshCtx(this.ctx.mode);
				this.ctx.lang = await this.resolveLang();
				if (this.ctx.mode === 'netpair')
					this.ctx.netpair = { ...(await this.collectNetPairData()), a: '', b: '', rule: '', classA: '', classB: '' };
				if (this.ctx.mode === 'export')
					await this.loadExportMeta();
				this.publish();
				break;
			case 'close':
				this.channel.stop();
				try {
					await (eda().sys_IFrame as any).closeIFrame(IFRAME_ID);
				}
				catch { /* 忽略 */ }
				break;
			case 'toast':
				toast(String(command.payload?.message ?? ''));
				break;
			default:
				break;
		}
	}

	// ---------------------------------------------------------------- 网络集合规则（直写入口）

	/** 集合文本 → 当前 PCB 上的真实网络（忽略大小写、去重），缺失网络单独返回 */
	private resolveNetList(raw: string, index: { real: (name: string) => string | undefined }): { kept: string[]; missing: string[] } {
		const kept: string[] = [];
		const missing: string[] = [];
		for (const name of parseNetList(raw)) {
			const real = index.real(name);
			if (real === undefined) {
				if (!missing.includes(name))
					missing.push(name);
			}
			else if (!kept.includes(real)) {
				kept.push(real);
			}
		}
		return { kept, missing };
	}

	private async refreshNetPairPreview(): Promise<void> {
		const np = this.ctx.netpair;
		if (!np)
			return;
		const index = await buildNetIndex();
		const a = this.resolveNetList(np.a, index);
		const b = this.resolveNetList(np.b, index);
		np.preview = {
			aCount: a.kept.length,
			bCount: b.kept.length,
			// 只填一个集合时按单集合模式计数（建类或网络规则条目），不再是乘积
			total: a.kept.length && b.kept.length ? a.kept.length * b.kept.length : a.kept.length + b.kept.length,
			missingA: a.missing,
			missingB: b.missing,
		};
		// 只做局部刷新（界面层据此跳过整页重渲染），避免输入框在连续输入时失焦
		this.publish({ npPreviewTick: true });
	}

	private async onNetPairInput(payload: { a?: string; b?: string; rule?: string; classA?: string; classB?: string }): Promise<void> {
		const np = this.ctx.netpair;
		if (!np)
			return;
		if (typeof payload.a === 'string')
			np.a = payload.a;
		if (typeof payload.b === 'string')
			np.b = payload.b;
		if (typeof payload.rule === 'string')
			np.rule = payload.rule;
		if (typeof payload.classA === 'string')
			np.classA = payload.classA;
		if (typeof payload.classB === 'string')
			np.classB = payload.classB;
		await this.refreshNetPairPreview();
	}

	/**
	 * 写入网络集合规则：把弹窗内容构造成一份「仅含网络-网络规则（必要时含网络规则）」的配置集，
	 * 复用导入管线执行 —— 建类冲突回退、单集合建类 / 网络规则语义、缺失网络求交、日志与还原
	 * 与「导出配置 → 导入」路径完全一致。
	 */
	private async applyNetPair(payload: { group?: string; a?: string; b?: string; rule?: string; classA?: string; classB?: string }): Promise<void> {
		const np = this.ctx.netpair;
		if (!np)
			return;
		if (typeof payload.group === 'string' && payload.group)
			np.group = payload.group;
		if (typeof payload.a === 'string')
			np.a = payload.a;
		if (typeof payload.b === 'string')
			np.b = payload.b;
		if (typeof payload.rule === 'string')
			np.rule = payload.rule;
		if (typeof payload.classA === 'string')
			np.classA = payload.classA;
		if (typeof payload.classB === 'string')
			np.classB = payload.classB;
		const group = np.group || np.groups[0];
		if (!group) {
			this.ctx.error = this.t('netpair.error.noGroup');
			this.publish({ view: 'select-netpair' });
			return;
		}
		const rule = String(np.rule || '').trim();
		const groupRules = np.rules[group] || [];
		if (!rule || !groupRules.includes(rule)) {
			this.ctx.error = this.t('netpair.error.noRule');
			this.publish({ view: 'select-netpair' });
			return;
		}
		this.ctx.error = undefined;
		this.publish({ view: 'busy', busyText: this.t('busy.write') });
		try {
			const index = await buildNetIndex();
			const a = this.resolveNetList(np.a, index);
			const b = this.resolveNetList(np.b, index);
			if (!a.kept.length && !b.kept.length) {
				this.ctx.error = this.t('netpair.error.emptySet');
				this.publish({ view: 'select-netpair' });
				return;
			}
			const draft: PairDraft = {
				group,
				rule,
				aNets: a.kept,
				bNets: b.kept,
				aClass: String(np.classA || '').trim() || undefined,
				bClass: String(np.classB || '').trim() || undefined,
			};
			await this.writeNetPairDrafts(group, [draft], this.missingWarningFor(a.missing, b.missing));
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.import')}${String(e?.message || e)}`;
			this.publish({ view: 'select-netpair' });
		}
	}

	/** 缺失网络的人话汇总（单条手输路径用；表格路径由计划的跳过列表覆盖） */
	private missingWarningFor = (missingA: string[], missingB: string[]): string[] => {
		const missingNets = [...missingA, ...missingB].filter((name, i, list) => list.indexOf(name) === i);
		return missingNets.length ? [this.t('netpair.missing', [missingNets.join(', ')])] : [];
	};

	/** 读入模板表格（CSV）：编码兼容 UTF-8 / GBK，取消选择返回空 */
	private async readNetSetTable(): Promise<{ rows?: NetSetTableRow[]; error?: string }> {
		let file: any;
		try {
			file = await (fileSystem().openReadFileDialog as any)(['csv'], false);
		}
		catch (e: any) {
			return { error: `${this.t('error.openDialog')}${String(e?.message || e)}` };
		}
		if (!file)
			return {};
		try {
			let bytes: Uint8Array | undefined;
			if (typeof file.arrayBuffer === 'function') {
				try {
					bytes = new Uint8Array(await file.arrayBuffer());
				}
				catch {
					bytes = undefined;
				}
			}
			const content = bytes ? decodeCsv(bytes) : await file.text();
			const parsed = parseNetSetTable(content);
			if (parsed.errors.length)
				return { error: parsed.errors.join('；') };
			return { rows: parsed.rows };
		}
		catch (e: any) {
			return { error: `${this.t('error.readFile')}${String(e?.message || e)}` };
		}
	}

	/** 导出弹窗：表格导入 → 合并进附加草稿列表（规则键按当前所选分组校验，整表生效或整体拒绝） */
	private async npdTableImport(group: string): Promise<void> {
		const id = ++this.tableImportSeq;
		const result = await this.readNetSetTable();
		if (!result.rows) {
			if (result.error)
				this.ctx.npdTableImported = { id, error: result.error };
			this.publish();
			return;
		}
		if (!group) {
			this.ctx.npdTableImported = { id, error: '请先选择规则分组，再导入表格' };
			this.publish();
			return;
		}
		const rules = (this.ctx.npMeta?.rules || {})[group] || [];
		const badRows = result.rows
			.map((row, index) => ({ row, line: index + 1 }))
			.filter(item => !rules.includes(item.row.rule));
		if (badRows.length) {
			this.ctx.npdTableImported = {
				id,
				error: `第 ${badRows.map(item => item.line).join('、')} 行的规则不在分组「${group}」中（可选：${rules.join('、') || '该分组还没有规则'}），请修正 rule 列后重新导入`,
			};
			this.publish();
			return;
		}
		this.ctx.npdTableImported = { id, drafts: result.rows };
		this.publish();
	}

	/** 网络集合规则弹窗：表格整表一次写入（每行 = 一条附加网络集合规则） */
	private async npTableImport(): Promise<void> {
		const np = this.ctx.netpair;
		if (!np)
			return;
		const result = await this.readNetSetTable();
		if (!result.rows) {
			if (result.error) {
				this.ctx.error = result.error;
				this.publish();
			}
			return;
		}
		const group = np.group || np.groups[0];
		if (!group) {
			this.ctx.error = this.t('netpair.error.noGroup');
			this.publish();
			return;
		}
		const groupRules = np.rules[group] || [];
		const badRows = result.rows
			.map((row, index) => ({ row, line: index + 1 }))
			.filter(item => !groupRules.includes(item.row.rule));
		if (badRows.length) {
			this.ctx.error = `第 ${badRows.map(item => item.line).join('、')} 行的规则不在分组「${group}」中（可选：${groupRules.join('、') || '该分组还没有规则'}），请修正 rule 列后重试`;
			this.publish();
			return;
		}
		const drafts: PairDraft[] = result.rows.map(row => ({ group, ...row }));
		this.ctx.error = undefined;
		this.publish({ view: 'busy', busyText: this.t('busy.write') });
		try {
			await this.writeNetPairDrafts(group, drafts);
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.import')}${String(e?.message || e)}`;
			this.publish({ view: 'select-netpair' });
		}
	}

	/**
	 * 写入一组附加网络集合草稿（手输单条 / 表格多行共用）：构造成「仅含网络-网络规则
	 * （必要时含网络规则）」的配置集，复用导入管线 —— 建类冲突回退、单集合建类 /
	 * 网络规则语义、缺失网络求交、日志与还原与「导出配置 → 导入」路径完全一致。
	 */
	private async writeNetPairDrafts(group: string, drafts: PairDraft[], warnings: string[] = []): Promise<void> {
		try {
			const file: RuleConfigSet = {
				schema: SCHEMA_ID,
				schemaVersion: SCHEMA_VERSION,
				generator: GENERATOR,
				exportedAt: new Date().toISOString(),
				source: {},
				modules: ['netByNetRules'],
				data: {},
			};
			// 导入管线对文件里出现的分组是「整组替换」语义；直写入口要求追加，
			// 因此先把当前 PCB 的全部分组并入文件底稿，再按「网络对 + 规则键」去重。
			const drc = (eda() as any).pcb_Drc;
			const currentGroups = (await drc.getNetByNetRules()) || {};
			file.data.netByNetRules = {};
			for (const key of Object.keys(currentGroups))
				file.data.netByNetRules[key] = JSON.parse(JSON.stringify(currentGroups[key] || []));
			appendPairDrafts(file, drafts);
			const keyOf = (entry: any): string =>
				`${[String(entry.net1?.name ?? '').toLowerCase(), String(entry.net2?.name ?? '').toLowerCase()].sort().join('|')}@${String(entry.rule ?? '').toLowerCase()}`;
			const existingKeys = new Set(((currentGroups[group] || []) as any[]).map(keyOf));
			file.data.netByNetRules[group] = (file.data.netByNetRules[group] || []).filter((entry: any) => {
				if (entry.single)
					return true;
				const isNetRef = (ref: any) => !!ref && ref.type === 'net';
				if (!isNetRef(entry.net1) || !isNetRef(entry.net2))
					return true;
				return !existingKeys.has(keyOf(entry));
			});
			const scope = file.modules.filter(key => key !== 'ruleConfig') as ModuleKey[];
			const outcome = await runImport(file, scope);
			// 编辑器写完规则后会自己弹一条永不消失的进度遮罩，导入结束后主动释放（见 core/overlay.ts）。
			scheduleOverlayCleanup({
				onCleanup: () => toast(this.t('toast.overlayCleared')),
			});
			this.ctx.snapshot = {
				data: JSON.parse(JSON.stringify(outcome.current.data)) as ConfigSetData,
				modules: scope,
				draftClasses: outcome.plan.draftClasses.map(cls => cls.name),
			};
			this.ctx.steps = (outcome.applied?.steps || []).map(step => ({
				label: step.label,
				ok: step.ok,
				verified: step.verified,
				error: step.error,
				detail: this.stepDetail(step, outcome),
			}));
			this.ctx.skippedItems = outcome.plan.skipped.map(item => ({ module: item.module, what: item.what, reason: item.reason }));
			this.ctx.residualSummary = outcome.residual?.summary;
			this.ctx.warnings = warnings;
			this.ctx.restored = false;
			this.ctx.log = this.buildLog(this.t('log.netpairHeader'), `${group} / ${drafts.length} 条`);
			toast(this.t('netpair.toast.done'));
			this.publish({ view: 'result' });
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.import')}${String(e?.message || e)}`;
			this.publish({ view: 'select-netpair' });
		}
	}

	// ---------------------------------------------------------------- 导入三步

	private async pickFile(): Promise<void> {
		this.ctx.error = undefined;
		this.publish({ view: 'busy', busyText: '请在弹出的窗口中选择配置文件…' });
		let file: any;
		try {
			file = await (fileSystem().openReadFileDialog as any)(['json'], false);
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.openDialog')}${String(e?.message || e)}`;
			this.publish();
			return;
		}
		if (!file) {
			this.publish();
			return;
		}
		try {
			const parsed = parseConfigSet(await file.text());
			if (parsed.error || !parsed.file) {
				this.ctx.error = parsed.error || '文件解析失败';
				this.ctx.file = undefined;
				this.publish({ view: 'select-import' });
				return;
			}
			this.ctx.file = parsed.file;
			this.ctx.fileName = file.name;
			this.ctx.fileSize = file.size;
			this.ctx.warnings = parsed.warnings;
			this.ctx.diff = undefined;
			this.ctx.steps = undefined;
			this.ctx.snapshot = undefined;
			this.ctx.restored = undefined;
			this.publish({ view: 'select-import' });
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.readFile')}${String(e?.message || e)}`;
			this.publish({ view: 'select-import' });
		}
	}

	/**
	 * 导入 / 预览的作用域 = 配置文件实际声明的模块。
	 *
	 * 文件没提到的模块一律不动。裸规则配置只含 ruleConfig，若按全模块对比，
	 * 本机已有的网络类 / 差分对 / 等长组会被当成「文件里没有 = 需要清空」而删除。
	 * 真机实测证据见 .probe/p69-diff-detail.json（P-70）。
	 */
	private scopeModules(): ModuleKey[] {
		const declared = (this.ctx.file?.modules || []) as ModuleKey[];
		const scoped = ALL_MODULES.filter(key => declared.includes(key));
		return scoped.length ? scoped : ([...ALL_MODULES] as ModuleKey[]);
	}

	private async buildPreview(): Promise<void> {
		const file = this.ctx.file;
		if (!file)
			return;
		this.publish({ view: 'busy', busyText: this.t('busy.compare') });
		try {
			const index = await buildNetIndex();
			const modules = this.scopeModules();
			const current = await collectModules(modules);
			const plan = buildPlan(file, current.data, index, modules);
			this.ctx.diff = diffPlan(plan, current.data);
			// 顺手留一份「导入前现场」，导入完成后可一键还原
			this.ctx.snapshot = {
				data: JSON.parse(JSON.stringify(current.data)) as ConfigSetData,
				modules,
				draftClasses: plan.draftClasses.map(cls => cls.name),
			};
			this.ctx.restored = undefined;
			this.ctx.error = undefined;
			this.publish({ view: 'preview' });
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.diff')}${String(e?.message || e)}`;
			this.publish({ view: 'preview' });
		}
	}

	private async applyImport(): Promise<void> {
		const file = this.ctx.file;
		if (!file)
			return;
		this.publish({ view: 'busy', busyText: this.t('busy.write') });
		try {
			const outcome = await runImport(file, this.scopeModules());
			// 编辑器写完规则后会自己弹一条永不消失的进度遮罩，导入结束后主动释放（见 core/overlay.ts）。
			scheduleOverlayCleanup({
				onCleanup: () => toast(this.t('toast.overlayCleared')),
			});
			this.ctx.steps = (outcome.applied?.steps || []).map(step => ({
				label: step.label,
				ok: step.ok,
				verified: step.verified,
				error: step.error,
				detail: this.stepDetail(step, outcome),
			}));
			this.ctx.skippedItems = outcome.plan.skipped.map(item => ({ module: item.module, what: item.what, reason: item.reason }));
			this.ctx.residualSummary = outcome.residual?.summary;
			this.ctx.warnings = [...this.ctx.warnings, ...(outcome.diff.warnings || [])];
			this.ctx.restored = false;
			this.ctx.log = this.buildLog();
			this.publish({ view: 'result' });
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.import')}${String(e?.message || e)}`;
			this.publish({ view: 'result' });
		}
	}

	/** 结果步骤的「人话」明细：成功时显示实际改动（来自预览差异统计），失败时保留原始校验差异 */
	private stepDetail(step: { name?: string; ok: boolean; detail?: any }, outcome: { diff: DiffResult; plan: Plan }): string | undefined {
		if (!step.ok) {
			if (Array.isArray(step.detail) && step.detail.length)
				return step.detail.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('；');
			return undefined;
		}
		if (step.name === 'deleteDraftClasses') {
			const names = Array.isArray(step.detail)
				? step.detail.map((item: any) => item?.name).filter(Boolean)
				: [];
			return names.length ? `删除草稿建的网络类 ${names.join('、')}` : undefined;
		}
		if (step.name === 'draftClasses' && Array.isArray(step.detail)) {
			const parts = step.detail.map((item: any) => {
				if (item?.action === 'createDraftClass')
					return `新建网络类 ${item.name}`;
				if (item?.action === 'addDraftNet')
					return `网络类 ${item.name} 追加成员 ${(item.nets || []).join('、')}`;
				return null;
			}).filter(Boolean);
			return parts.length ? parts.join('；') : '无变化';
		}
		const countable = ['ruleConfig', 'netClasses', 'equalLengthGroups', 'differentialPairs', 'netRules', 'netByNetRules'];
		if (!step.name || !countable.includes(step.name))
			return undefined;
		const counts: Record<string, number> = {};
		for (const entry of outcome.diff.entries) {
			if (entry.module !== step.name)
				continue;
			counts[entry.kind] = (counts[entry.kind] || 0) + 1;
		}
		const parts: string[] = [];
		if (counts.added)
			parts.push(`新增 ${counts.added} 条`);
		if (counts.modified)
			parts.push(`修改 ${counts.modified} 条`);
		if (counts.removed)
			parts.push(`删除 ${counts.removed} 条`);
		if (counts.kept)
			parts.push(`保留 ${counts.kept} 条`);
		return parts.length ? parts.join(' / ') : '无变化';
	}

	/**
	 * 一键还原到导入前。
	 *
	 * 平台没有开放规则配置的撤销栈：真机实测 MSG_BUS_PCB.publish('undo') 只回退画布图元，
	 * 规则数值不变（证据 .probe/p155-undo-test2-raw.json、p160-undo-ab2-raw.json），
	 * 因此用「导入前快照 + 反向写入」实现回退，作用域与本次导入完全一致。
	 */
	private async doRestore(): Promise<void> {
		const snapshot = this.ctx.snapshot;
		if (!snapshot)
			return;
		this.ctx.error = undefined;
		this.publish({ view: 'busy', busyText: this.t('busy.write') });
		try {
			const file: RuleConfigSet = {
				schema: SCHEMA_ID,
				schemaVersion: SCHEMA_VERSION,
				generator: GENERATOR,
				exportedAt: new Date().toISOString(),
				source: {},
				modules: snapshot.modules,
				data: snapshot.data,
			};
			// 还原必须是「精确回滚」：管理器允许删除导入时新建的网络类 / 等长组 / 差分对。
			const outcome = await runImport(file, snapshot.modules, { exact: true, deleteClasses: snapshot.draftClasses });
			scheduleOverlayCleanup({
				onCleanup: () => toast(this.t('toast.overlayCleared')),
			});
			this.ctx.steps = (outcome.applied?.steps || []).map(step => ({
				label: step.label,
				ok: step.ok,
				verified: step.verified,
				error: step.error,
				detail: Array.isArray(step.detail) ? step.detail.slice(0, 30) : undefined,
			}));
			this.ctx.residualSummary = outcome.residual?.summary;
			this.ctx.warnings = [...this.ctx.warnings, ...(outcome.diff.warnings || [])];
			this.ctx.snapshot = undefined;
			this.ctx.restored = true;
			this.ctx.log = [...this.ctx.log, `${this.t('log.restore')}${this.t('log.restored')}`];
			toast(this.t('toast.restored'));
			this.publish({ view: 'result' });
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.import')}${String(e?.message || e)}`;
			this.publish({ view: 'result' });
		}
	}

	/** header / fileLabel 供「网络集合规则」直写入口复用同一套日志结构 */
	private buildLog(header: string = this.t('log.importHeader'), fileLabel?: string): string[] {
		const lines: string[] = [];
		lines.push(`${header}  ${formatDateTime(new Date())}`);
		lines.push(`${this.t('log.file')}${fileLabel ?? this.ctx.fileName ?? '-'}`);
		for (const step of this.ctx.steps || []) {
			// 带上该步的实际改动明细（与结果页一致），否则「本机多出的条目不再提示」后日志就没有记录了
			const detail = step.detail ? ` — ${typeof step.detail === 'string' ? step.detail : JSON.stringify(step.detail)}` : '';
			lines.push(`[${step.ok ? this.t('log.ok') : this.t('log.fail')}] ${step.label}${step.error ? ` — ${step.error}` : ''}${detail}`);
		}
		for (const item of this.ctx.skippedItems || []) {
			const label = MODULE_LABELS[item.module as ModuleKey] ?? item.module;
			lines.push(`[跳过] ${label} · ${item.what} — ${item.reason}`);
		}
		const residual = this.ctx.residualSummary;
		if (residual) {
			lines.push(this.t('log.residual', [
				residual.added,
				residual.modified,
				residual.removed,
				residual.kept,
				residual.skipped,
				residual.unsupported,
			]));
		}
		for (const warning of this.ctx.warnings) lines.push(`${this.t('log.hint')}${warning}`);
		return lines;
	}

	// ---------------------------------------------------------------- 导出

	private async doExport(payload: { modules?: string[]; fileName?: string; pairDrafts?: PairDraft[] }): Promise<void> {
		const chosen = (payload.modules && payload.modules.length ? payload.modules : ALL_MODULES) as ModuleKey[];
		const drafts = (payload.pairDrafts || []).filter(draft => draft && Array.isArray(draft.aNets) && Array.isArray(draft.bNets));
		// 用户可能把文件名改成不带扩展名的形式：统一补 .json，避免产出无扩展名 / 双扩展名文件
		const typed = String(payload.fileName || '').trim();
		const name = typed
			? (/\.json$/i.test(typed) ? typed : `${typed}.json`)
			: this.ctx.exportFileName;
		this.ctx.modules = Object.fromEntries(ALL_MODULES.map(key => [key, chosen.includes(key)]));
		this.publish({ view: 'busy', busyText: this.t('busy.export') });
		try {
			const outcome = await runExport(chosen, {});
			appendPairDrafts(outcome.file, drafts);
			if (drafts.length && !chosen.includes('netByNetRules'))
				chosen.push('netByNetRules');
			const blob = new Blob([JSON.stringify(outcome.file, null, '\t')], { type: 'application/json' });
			await (fileSystem() as any).saveFile(blob, name);
			this.ctx.savedName = name;
			// 记住这次勾选，下次导出默认沿用（设置项 lastExportModules）
			this.ctx.settings = { ...this.ctx.settings, lastExportModules: [...chosen] };
			await saveSettings({ lastExportModules: [...chosen] });
			this.ctx.steps = chosen.map(key => ({
				label: MODULE_LABELS[key],
				ok: true,
				detail: this.countModule(outcome.file, key),
			}));
			this.ctx.log = [
				`${this.t('log.exportHeader')}  ${formatDateTime(new Date())}`,
				`${this.t('log.result')}${name}`,
				`${this.t('log.modules')}${chosen.map(key => MODULE_LABELS[key]).join('、')}`,
			];
			this.publish({ view: 'result' });
		}
		catch (e: any) {
			this.ctx.error = `${this.t('error.export')}${String(e?.message || e)}`;
			this.publish({ view: 'result' });
		}
	}

	private countModule(file: RuleConfigSet, key: ModuleKey): string {
		const value: any = (file.data as any)[key];
		if (value === undefined)
			return '无数据';
		if (Array.isArray(value))
			return `${value.length} 条`;
		if (key === 'ruleConfig') {
			const groups = Object.keys(value as any).length;
			let rules = 0;
			for (const top of Object.keys(value as any)) rules += Object.keys((value as any)[top] || {}).length;
			return `${groups} 个分组 / ${rules} 条规则`;
		}
		return `${Object.keys(value as any).length} 个分组`;
	}
}
