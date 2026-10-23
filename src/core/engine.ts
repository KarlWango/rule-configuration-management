import type { ApplyResult } from './apply';
/** 内核对外接口：导出 / 预览 / 导入（含残差复核）。 */
import type { BuildMeta, CollectResult } from './collect';
import type { DiffResult } from './diff';
import type { Plan } from './plan';
import type { ModuleKey, RuleConfigSet } from './types';
import { applyPlan } from './apply';
import { buildConfigSet, collectModules } from './collect';
import { diffPlan } from './diff';
import { buildNetIndex } from './netindex';
import { buildPlan } from './plan';
import { ALL_MODULES, SCHEMA_ID, SCHEMA_VERSION } from './types';

export interface ExportOutcome { file: RuleConfigSet; collected: CollectResult }

export async function runExport(modules: ModuleKey[] = [...ALL_MODULES], meta: BuildMeta = {}): Promise<ExportOutcome> {
	const collected = await collectModules(modules);
	return { file: buildConfigSet(collected, modules, meta), collected };
}

export interface ImportOutcome {
	plan: Plan;
	diff: DiffResult;
	current: CollectResult;
	applied?: ApplyResult;
	residual?: DiffResult;
	after?: CollectResult;
}

export async function runImport(
	file: RuleConfigSet,
	modules: ModuleKey[] = [...ALL_MODULES],
	options: { dryRun?: boolean; exact?: boolean; deleteClasses?: string[] } = {},
): Promise<ImportOutcome> {
	// 安全网：只处理文件实际声明的模块，杜绝「文件没提 = 需要清空」的破坏性推断。
	const declared = (file.modules || []) as ModuleKey[];
	const scope = declared.length ? modules.filter(key => declared.includes(key)) : modules;
	// 网络-网络规则需要按规则键校验（不存在的键会被编辑器当成默认规则），因此顺带读取规则配置用于校验。
	const collectScope: ModuleKey[] = scope.includes('netByNetRules') && !scope.includes('ruleConfig')
		? [...scope, 'ruleConfig']
		: scope;
	// 附加草稿可能声明「新建网络类」，需要本机网络类成员做冲突检查
	if (scope.includes('netByNetRules') && !scope.includes('netClasses'))
		collectScope.push('netClasses');
	const index = await buildNetIndex();
	const current = await collectModules(collectScope);
	// exact = 还原模式：管理器（网络类 / 等长组 / 差分对）按快照精确对齐，允许删除本机多出的对象。
	const plan = buildPlan(file, current.data, index, scope, { exact: options.exact });
	const diff = diffPlan(plan, current.data);
	if (options.dryRun)
		return { plan, diff, current };
	const applied = await applyPlan(plan, { deleteClasses: options.deleteClasses });
	const after = await collectModules(collectScope);
	const residual = diffPlan(buildPlan(file, after.data, index, scope, { exact: options.exact }), after.data);
	return { plan, diff, current, applied, residual, after };
}

export interface ParseOutcome { file?: RuleConfigSet; error?: string; warnings: string[] }

/** 解析并校验交换文件；兼容「裸 config」与完整 ConfigSet 两种形态。 */
export function parseConfigSet(text: string): ParseOutcome {
	const warnings: string[] = [];
	let raw: any;
	try {
		raw = JSON.parse(text);
	}
	catch (e: any) {
		return { error: `JSON 解析失败：${String(e?.message || e)}`, warnings };
	}
	if (!raw || typeof raw !== 'object')
		return { error: '文件内容不是对象', warnings };
	if (raw.schema === SCHEMA_ID) {
		if (raw.schemaVersion !== SCHEMA_VERSION) {
			warnings.push(`文件 schemaVersion=${raw.schemaVersion}，当前程序支持 ${SCHEMA_VERSION}，将按兼容模式读取。`);
		}
		if (!raw.data || typeof raw.data !== 'object')
			return { error: '文件缺少 data 字段', warnings };
		const modules: ModuleKey[] = Array.isArray(raw.modules) && raw.modules.length ? raw.modules : [...ALL_MODULES];
		return { file: { ...raw, modules } as RuleConfigSet, warnings };
	}
	// 兼容：嘉立创EDA 内置「导出配置」的裸 config 结构
	const looksLikeConfig = ['Spacing', 'Physics', 'Plane', 'Expansion'].some(key => key in raw);
	if (looksLikeConfig) {
		warnings.push('检测到嘉立创EDA 内置导出的裸规则配置，已按「仅规则管理」模块导入。');
		return {
			file: {
				schema: SCHEMA_ID,
				schemaVersion: SCHEMA_VERSION,
				generator: { name: 'easyeda-builtin-export', version: 'unknown' },
				exportedAt: new Date().toISOString(),
				source: { unit: undefined },
				modules: ['ruleConfig'],
				data: { ruleConfig: raw },
			},
			warnings,
		};
	}
	return { error: '无法识别的文件结构（既不是本扩展的配置集，也不是规则管理配置）', warnings };
}
