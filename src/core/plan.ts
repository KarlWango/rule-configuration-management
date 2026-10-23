/**
 * 计划构建器：把「配置文件」+「本机现状」归一化成一份可执行计划。
 *
 * 这里集中处理四类归一化：
 *  1. 网络名大小写不敏感匹配（写回 PCB 真实网络名）；
 *  2. 载荷补齐（规则管理必须四个顶层分类齐全；net-by-net 必须所有分组键齐全）；
 *  3. 网络规则条目补全（以本机条目为底稿合并文件值，保证派生键 sub / Differential Pair 不被清空）；
 *  4. 不可行项记录（缺失网络、版本不支持的分组、无法删除的条目）。
 */
import type { NetIndex } from './netindex';
import type {
	ConfigSetData,
	DiffPairEntry,
	EqualLengthGroupEntry,
	ModuleKey,
	NetByNetEntry,
	NetByNetRules,
	NetClassEntry,
	NetRuleEntry,
	RuleConfigData,
	RuleConfigSet,
} from './types';
import { filterNets } from './netindex';
import { clone, isPlainObject } from './util';

export interface SkippedItem { module: ModuleKey; what: string; reason: string }

export interface Plan {
	modules: ModuleKey[];
	ruleConfig?: {
		payload: RuleConfigData;
		/** 计划中真正要覆盖的分组：top / group */
		targeted: { top: string; group: string }[];
	};
	netRules: {
		netEntries: NetRuleEntry[];
		/**
		 * 属于网络类 / 等长组的网络：EDA 会把成员网络的顶层条目移入所属条目的 sub，
		 * 两者不能并存，因此这些网络的规则要并入 sub，而不能作为顶层条目提交。
		 */
		memberEntries: NetRuleEntry[];
		/** 网络名（小写）→ 所属网络类 / 等长组名称 */
		memberOwner: Record<string, string>;
		classEntries: NetRuleEntry[];
		groupEntries: NetRuleEntry[];
	};
	netClasses: NetClassEntry[];
	/** 附加网络对草稿声明的网络类（目标板冲突检查通过后才会出现），随网络-网络规则步骤一起写入 */
	draftClasses: { name: string; nets: string[] }[];
	differentialPairs: DiffPairEntry[];
	equalLengthGroups: EqualLengthGroupEntry[];
	netByNetRules: NetByNetRules;
	missingNets: string[];
	skipped: SkippedItem[];
	/**
	 * 还原模式的目标清单（仅「一键还原」时存在）。
	 *
	 * 普通导入是「只增不删」，但还原必须让管理器（网络类 / 等长组 / 差分对）
	 * 精确回到快照状态，因此这里保留「文件里声明了哪些对象、各自有哪些成员」，
	 * 供执行层删除本机多出来的对象与成员。
	 */
	exact?: ExactTargets;
}

export interface ExactTargets {
	/** 网络类名（小写）→ 文件中声明的成员 */
	netClasses: Record<string, string[]>;
	/** 等长组名（小写）→ 文件中声明的成员 */
	equalLengthGroups: Record<string, string[]>;
	/** 差分对名（小写） */
	differentialPairs: string[];
}

export function netRuleKey(entry: NetRuleEntry): string {
	return `${entry.type}|${String(entry.name).toLowerCase()}`;
}

function sameKey(a: string, b: string): boolean {
	return String(a).toLowerCase() === String(b).toLowerCase();
}

/** 集合侧展示名：具名集合用名称 + 求交后的网络数，非集合引用直接显示名称 */
function describeSetSide(ref: any, side: string, refs: string[]): string {
	if (!ref || ref.type !== 'set')
		return String(ref?.name ?? `集合${side}`);
	return `${ref.name || `集合${side}`}（${refs.length} 个网络）`;
}

/** 集合展开来源：展示标签 + 集合成员（供差异预览展开核对；JSON 序列化自动丢弃） */
interface SetSource {
	label: string;
	aNets?: string[];
	bNets?: string[];
}

/** 给展开后的网络对打隐藏来源标记（不可枚举，JSON 序列化自动丢弃，不进写入载荷） */
function tagSetSource(entry: NetByNetEntry, src: SetSource): NetByNetEntry {
	Object.defineProperty(entry, '_src', { value: src, enumerable: false });
	return entry;
}

/**
 * 派生键：由管理器（网络类 / 等长组 / 差分对）决定，文件值不能覆盖。
 * 实测：成员网络加入网络类后其顶层条目的 sub 会变化；加入差分对后会多出
 * `Differential Pair` 键。若按文件原值提交，这些派生键会被清空。
 */
const DERIVED_KEYS = ['sub', 'Differential Pair'];

/** 以本机条目为底稿、文件条目为覆盖，得到完整可提交条目 */
export function mergeNetRuleEntry(base: NetRuleEntry | undefined, target: NetRuleEntry): NetRuleEntry {
	const out: any = base ? { ...clone(base), ...clone(target) } : clone(target);
	if (base) {
		for (const key of DERIVED_KEYS) {
			if ((base as any)[key] !== undefined)
				out[key] = clone((base as any)[key]);
			else delete out[key];
		}
	}
	return out as NetRuleEntry;
}

function resolveClasses(file: RuleConfigSet): NetClassEntry[] {
	const fromModule = file.data.netClasses;
	if (fromModule && fromModule.length) {
		return fromModule.map(c => ({ name: c.name, nets: clone(c.nets || []) }));
	}
	return (file.data.netRules || [])
		.filter(entry => entry.type === 'netClass')
		.map(entry => ({ name: entry.name, nets: (entry.sub || []).map((s: any) => s.name) }));
}

function resolveGroups(file: RuleConfigSet): EqualLengthGroupEntry[] {
	const fromModule = file.data.equalLengthGroups;
	if (fromModule && fromModule.length) {
		return fromModule.map(g => ({ name: g.name, nets: clone(g.nets || []) }));
	}
	return (file.data.netRules || [])
		.filter(entry => entry.type === 'equalLengthGroup')
		.map(entry => ({ name: entry.name, nets: (entry.sub || []).map((s: any) => s.name) }));
}

export function buildPlan(
	file: RuleConfigSet,
	current: ConfigSetData,
	index: NetIndex,
	modules: ModuleKey[],
	options: { exact?: boolean } = {},
): Plan {
	const plan: Plan = {
		modules,
		netRules: { netEntries: [], memberEntries: [], memberOwner: {}, classEntries: [], groupEntries: [] },
		netClasses: [],
		draftClasses: [],
		differentialPairs: [],
		equalLengthGroups: [],
		netByNetRules: {},
		missingNets: [],
		skipped: [],
	};
	const skip = (module: ModuleKey, what: string, reason: string): void => {
		plan.skipped.push({ module, what, reason });
	};
	const miss = (name: string): void => {
		if (!plan.missingNets.includes(name))
			plan.missingNets.push(name);
	};

	// ---------- 规则管理 ----------
	if (modules.includes('ruleConfig') && file.data.ruleConfig) {
		const payload = clone(current.ruleConfig || {});
		const targeted: { top: string; group: string }[] = [];
		const fileCfg = file.data.ruleConfig;
		for (const top of Object.keys(fileCfg)) {
			// 本机没有的顶层分类 / 分组：默认状态下本来就不存在，无法新增，静默忽略
			if (!isPlainObject(payload[top]))
				continue;
			for (const group of Object.keys(fileCfg[top] || {})) {
				if (!isPlainObject(payload[top][group]))
					continue;
				payload[top][group] = clone(fileCfg[top][group]);
				targeted.push({ top, group });
			}
		}
		plan.ruleConfig = { payload, targeted };
	}

	// ---------- 网络类 ----------
	const fileNetRules = file.data.netRules || [];
	const classScope = modules.includes('netClasses');
	const groupScope = modules.includes('equalLengthGroups');

	// 还原模式：记下文件（即导入前快照）里声明的对象与成员，执行层据此删除本机多出的部分。
	if (options.exact) {
		const exact: ExactTargets = { netClasses: {}, equalLengthGroups: {}, differentialPairs: [] };
		if (classScope) {
			for (const cls of resolveClasses(file))
				exact.netClasses[String(cls.name).toLowerCase()] = cls.nets.map(String);
		}
		if (groupScope) {
			for (const group of resolveGroups(file))
				exact.equalLengthGroups[String(group.name).toLowerCase()] = group.nets.map(String);
		}
		if (modules.includes('differentialPairs')) {
			for (const pair of file.data.differentialPairs || [])
				exact.differentialPairs.push(String(pair.name).toLowerCase());
		}
		plan.exact = exact;
	}
	if (classScope) {
		for (const cls of resolveClasses(file)) {
			const { kept, missing } = filterNets(cls.nets, index);
			missing.forEach(miss);
			if (!kept.length) {
				skip('netClasses', `网络类 ${cls.name}`, `成员网络全部缺失：${missing.join(', ')}`);
				continue;
			}
			if (missing.length)
				skip('netClasses', `网络类 ${cls.name}`, `跳过缺失网络：${missing.join(', ')}`);
			plan.netClasses.push({ name: cls.name, nets: kept });
		}
	}

	// ---------- 等长网络组 ----------
	if (groupScope) {
		for (const group of resolveGroups(file)) {
			const { kept, missing } = filterNets(group.nets, index);
			missing.forEach(miss);
			if (!kept.length) {
				skip('equalLengthGroups', `等长网络组 ${group.name}`, `成员网络全部缺失：${missing.join(', ')}`);
				continue;
			}
			if (missing.length)
				skip('equalLengthGroups', `等长网络组 ${group.name}`, `跳过缺失网络：${missing.join(', ')}`);
			plan.equalLengthGroups.push({ name: group.name, nets: kept });
		}
	}

	// ---------- 差分对（缺任一网络整对跳过） ----------
	if (modules.includes('differentialPairs')) {
		for (const pair of file.data.differentialPairs || []) {
			const positive = index.real(pair.positiveNet);
			const negative = index.real(pair.negativeNet);
			if (!positive || !negative) {
				const missing = [positive ? null : pair.positiveNet, negative ? null : pair.negativeNet].filter((x): x is string => !!x);
				missing.forEach(miss);
				skip('differentialPairs', `差分对 ${pair.name}`, `整对跳过（缺失网络：${missing.join(', ')}）`);
				continue;
			}
			plan.differentialPairs.push({ name: pair.name, positiveNet: positive, negativeNet: negative });
		}
	}

	// ---------- 网络规则 ----------
	// ---------- 附加草稿建类预演（先于网络规则：成员网络的顶层条目要按「类成员」处理） ----------
	if (modules.includes('netByNetRules')) {
		/** 当前 PCB 的网络类成员归属（小写网络名 → 类名）：草稿建类前做冲突检查 */
		const currentClassOwner = new Map<string, string>();
		for (const cls of current.netClasses || []) {
			for (const net of cls.nets || [])
				currentClassOwner.set(String(net).toLowerCase(), String(cls.name));
		}
		if (!currentClassOwner.size) {
			for (const entry of current.netRules || []) {
				if (entry.type !== 'netClass')
					continue;
				for (const sub of (entry.sub || []) as any[]) {
					if (sub && sub.name)
						currentClassOwner.set(String(sub.name).toLowerCase(), String(entry.name));
				}
			}
		}
		const planDraftClass = (name: string, nets: string[]): void => {
			const conflict = nets
				.map(net => ({ net, owner: currentClassOwner.get(net.toLowerCase()) }))
				.find(item => item.owner && !sameKey(item.owner, name));
			if (conflict) {
				skip('netByNetRules', `网络类 ${name}`, `网络 ${conflict.net} 已属于网络类「${conflict.owner}」，无法加入该网络类；相关网络对改为逐条展开`);
				return;
			}
			// 先到先得：同一批导入里，前面的附加定义已把该网络划入别的草稿类时，后面的定义不再生效
			const draftConflict = nets
				.map((net) => {
					const owner = plan.draftClasses.find(draft => !sameKey(draft.name, name) && draft.nets.some(item => sameKey(item, net)));
					return owner ? { net, owner: owner.name } : undefined;
				})
				.find((item): item is { net: string; owner: string } => !!item);
			if (draftConflict) {
				skip('netByNetRules', `网络类 ${name}`, `网络 ${draftConflict.net} 已在本批附加规则中加入网络类「${draftConflict.owner}」，该侧不再建类；相关网络对改为逐条展开`);
				return;
			}
			let draft = plan.draftClasses.find(item => sameKey(item.name, name));
			if (!draft) {
				draft = { name, nets: [] };
				plan.draftClasses.push(draft);
			}
			for (const net of nets) {
				if (!draft.nets.some(x => sameKey(x, net)))
					draft.nets.push(net);
			}
		};
		for (const group of Object.keys(file.data.netByNetRules || {})) {
			for (const entry of file.data.netByNetRules![group]) {
				const isSet = (ref: any): boolean => !!ref && ref.type === 'set';
				const legacy = entry.netClass && typeof entry.netClass === 'object' ? entry.netClass.name : undefined;
				if (entry.single && isSet(entry.net1) && isSet(entry.net2)) {
					const sideRef = entry.single === 'net1' ? entry.net1 : entry.net2;
					const className = (sideRef as any).className;
					if (className) {
						const kept = filterNets((sideRef as any).nets, index).kept;
						if (kept.length)
							planDraftClass(className, kept);
						else
							skip('netByNetRules', `网络类 ${className}`, '成员网络在当前 PCB 全部缺失');
					}
					continue;
				}
				const leftClass = (isSet(entry.net1) ? (entry.net1 as any).className : undefined) || legacy;
				const rightClass = (isSet(entry.net2) ? (entry.net2 as any).className : undefined) || legacy;
				if (!leftClass && !rightClass)
					continue;
				const leftNets = isSet(entry.net1) ? filterNets((entry.net1 as any).nets, index).kept : [];
				const rightNets = isSet(entry.net2) ? filterNets((entry.net2 as any).nets, index).kept : [];
				const hasSideClass = (isSet(entry.net1) && (entry.net1 as any).className) || (isSet(entry.net2) && (entry.net2 as any).className);
				if (legacy && !hasSideClass) {
					const union = [...leftNets];
					for (const net of rightNets) {
						if (!union.some(x => sameKey(x, net)))
							union.push(net);
					}
					if (leftNets.length && rightNets.length)
						planDraftClass(legacy, union);
					continue;
				}
				if (leftClass && leftNets.length)
					planDraftClass(leftClass, leftNets);
				if (rightClass && rightNets.length)
					planDraftClass(rightClass, rightNets);
			}
		}
	}

	// 实测：overwriteNetRules 会整篇重写网络规则文档 —— 载荷里没有的网络类 / 等长组条目
	// 会被直接摧毁，且成员网络不能同时保留顶层条目。因此这里要：
	//   a. 以本机条目为底稿合并文件值（保留 sub / Differential Pair 等派生键）；
	//   b. 把成员网络的规则并入所属条目的 sub；
	//   c. 不修改的管理器范围，原样回传已有条目。
	if (modules.includes('netRules')) {
		const liveByKey = new Map<string, NetRuleEntry>((current.netRules || []).map(entry => [netRuleKey(entry), entry]));
		const fileKeys = new Set<string>();
		const plainEntries = new Map<string, NetRuleEntry>();

		// 第一遍：普通网络条目（顺带完成网络名大小写不敏感匹配）
		for (const entry of fileNetRules) {
			if (entry.type !== 'net')
				continue;
			const real = index.real(entry.name);
			const key = `net|${String(entry.name).toLowerCase()}`;
			if (!real) {
				miss(entry.name);
				skip('netRules', `网络规则 ${entry.name}`, 'PCB 上不存在该网络');
				continue;
			}
			const realKey = `net|${String(real).toLowerCase()}`;
			plainEntries.set(realKey, mergeNetRuleEntry(liveByKey.get(realKey), { ...clone(entry), name: real } as NetRuleEntry));
			fileKeys.add(key);
		}

		// 成员归属：同一网络同时属于网络类与等长组时以网络类为准
		const membership = new Map<string, string>();
		for (const group of plan.equalLengthGroups) {
			for (const net of group.nets) membership.set(net.toLowerCase(), group.name);
		}
		for (const cls of plan.netClasses) {
			for (const net of cls.nets) membership.set(net.toLowerCase(), cls.name);
		}
		// 附加草稿建的网络类（后于文件网络类创建，成员归属以草稿为准）
		for (const draft of plan.draftClasses) {
			for (const net of draft.nets)
				membership.set(net.toLowerCase(), draft.name);
		}

		for (const entry of plainEntries.values()) {
			const lower = String(entry.name).toLowerCase();
			const owner = membership.get(lower);
			if (owner) {
				plan.netRules.memberEntries.push(entry);
				plan.netRules.memberOwner[lower] = owner;
			}
			else {
				plan.netRules.netEntries.push(entry);
			}
		}

		// 第二遍：网络类 / 等长组条目（sub 里回填成员网络的规则值）
		for (const entry of fileNetRules) {
			if (entry.type === 'net')
				continue;
			if (entry.type !== 'netClass' && entry.type !== 'equalLengthGroup') {
				skip('netRules', `网络规则 ${entry.name}`, `未知条目类型 ${entry.type}`);
				continue;
			}
			const key = netRuleKey(entry);
			const isClass = entry.type === 'netClass';
			const known = isClass
				? plan.netClasses.some(cls => sameKey(cls.name, entry.name))
				: plan.equalLengthGroups.some(group => sameKey(group.name, entry.name));
			if (!known && (isClass ? classScope : groupScope))
				continue;
			if (!known && !liveByKey.has(key)) {
				skip('netRules', `${isClass ? '网络类' : '等长组'}规则 ${entry.name}`, '本机不存在该分类，无法新增');
				continue;
			}
			const sub = (entry.sub || [])
				.filter((item: any) => index.has(item.name))
				.map((item: any) => {
					const real = index.real(item.name) as string;
					const plain = plainEntries.get(`net|${real.toLowerCase()}`);
					return plain ? mergeNetRuleEntry(item, plain) : { ...clone(item), name: real };
				});
			const merged = mergeNetRuleEntry(liveByKey.get(key), { ...clone(entry), sub } as NetRuleEntry);
			if (isClass)
				plan.netRules.classEntries.push(merged);
			else plan.netRules.groupEntries.push(merged);
			fileKeys.add(key);
		}

		// 本机多出、文件里没有的条目
		for (const entry of current.netRules || []) {
			if (fileKeys.has(netRuleKey(entry)))
				continue;
			if (entry.type === 'net') {
				// 实测（P-40）：普通网络条目即使不在载荷里也会原样保留，无法删除。
				// 实际执行时网络类 / 等长组步骤会把这些成员网络并回所属条目，因此不再记录与提示。
				continue;
			}
			const inScope = entry.type === 'netClass' ? classScope : groupScope;
			if (inScope) {
				// 由管理器步骤负责删除，不再进入载荷
				continue;
			}
			// 本次不修改该类管理器 → 必须原样回传，否则整篇写入会把它清掉
			if (entry.type === 'netClass')
				plan.netRules.classEntries.push(clone(entry));
			else if (entry.type === 'equalLengthGroup')
				plan.netRules.groupEntries.push(clone(entry));
		}
	}
	// ---------- 网络-网络规则 ----------
	if (modules.includes('netByNetRules')) {
		const currentGroups = current.netByNetRules || {};
		const fileGroups = file.data.netByNetRules || {};
		const allGroups = new Set([...Object.keys(currentGroups), ...Object.keys(fileGroups)]);
		const classNames = new Set([
			...plan.netClasses.map(cls => cls.name),
			...(current.netRules || []).filter(entry => entry.type === 'netClass').map(entry => entry.name),
			...plan.draftClasses.map(draft => draft.name),
		]);
		const resolveRef = (ref: any): string | undefined => {
			if (!ref || !ref.name)
				return undefined;
			if (ref.type === 'net')
				return index.real(ref.name);
			if (ref.type === 'netClass')
				return classNames.has(ref.name) ? ref.name : undefined;
			return index.real(ref.name);
		};
		/** 集合引用：与当前 PCB 网络求交（忽略大小写），缺失网络单独汇总 */
		const resolveSet = (ref: any): string[] => {
			const { kept, missing } = filterNets(ref?.nets || [], index);
			if (missing.length) {
				const label = ref?.name ? `集合 ${ref.name}` : '网络集合';
				skip('netByNetRules', label, `跳过缺失网络：${missing.join(', ')}`);
			}
			return kept;
		};
		/** 分组对应的规则键集合：本机现有 + 本次导入会写入的（同一批导入里「规则管理」步骤会先建好这些规则）；取不到时返回 undefined 表示无法校验 */
		const groupRuleKeys = (group: string): Set<string> | undefined => {
			const keys = new Set<string>();
			let found = false;
			const collect = (cfg: Record<string, any> | undefined): void => {
				for (const top of Object.keys(cfg || {})) {
					const groupCfg = (cfg || {})[top]?.[group];
					if (isPlainObject(groupCfg)) {
						for (const key of Object.keys(groupCfg))
							keys.add(key.toLowerCase());
						found = true;
					}
				}
			};
			collect(current.ruleConfig);
			if (modules.includes('ruleConfig'))
				collect(file.data.ruleConfig);
			if (!found)
				return undefined;
			return keys;
		};
		/** 同一分组里引用不存在规则的条目会全部变成默认规则，这里按「分组 + 规则名」汇总提示 */
		const unknownRuleNoted = new Set<string>();
		for (const group of allGroups) {
			const fileList = fileGroups[group];
			if (!fileList) {
				plan.netByNetRules[group] = clone(currentGroups[group] || []);
				continue;
			}
			const out: NetByNetEntry[] = [];
			const knownRules = groupRuleKeys(group);
			/** 草稿类是否已通过预演（冲突检查在建类预演中完成） */
			const isPlannedClass = (name: string): boolean => plan.draftClasses.some(draft => sameKey(draft.name, name));
			for (const entry of fileList) {
				const isSet = (ref: any): boolean => !!ref && ref.type === 'set';
				const leftRefs: string[] = isSet(entry.net1) ? resolveSet(entry.net1) : [resolveRef(entry.net1)].filter((x): x is string => !!x);
				const rightRefs: string[] = isSet(entry.net2) ? resolveSet(entry.net2) : [resolveRef(entry.net2)].filter((x): x is string => !!x);
				const label = `${isSet(entry.net1) ? (entry.net1.name || '集合A') : entry.net1?.name} ↔ ${isSet(entry.net2) ? (entry.net2.name || '集合B') : entry.net2?.name}`;
				// 附加草稿的单侧模式：只建类 / 补成员（建类与冲突提示已在预演阶段完成），不产生网络对
				if (entry.single)
					continue;
				if (knownRules && !knownRules.has(String(entry.rule ?? '').toLowerCase())) {
					const ruleName = String(entry.rule ?? '');
					const noteKey = `${group}|${ruleName.toLowerCase()}`;
					if (!unknownRuleNoted.has(noteKey)) {
						unknownRuleNoted.add(noteKey);
						skip('netByNetRules', `分组 ${group} 的规则「${ruleName}」`, '规则管理中不存在该规则（导入后会变成默认规则），请先在规则管理中创建同名规则');
					}
					continue;
				}
				if (!leftRefs.length || !rightRefs.length) {
					const names = [
						...leftRefs.length ? [] : [isSet(entry.net1) ? (entry.net1.name || '集合A') : entry.net1?.name],
						...rightRefs.length ? [] : [isSet(entry.net2) ? (entry.net2.name || '集合B') : entry.net2?.name],
					].filter((x): x is string => !!x);
					skip('netByNetRules', label, `引用的网络/网络类不存在或为空：${names.join(', ')}`);
					continue;
				}
				// 附加草稿的「建类」模式：类名与集合一一对应（兼容 1.3.0 的两侧共用 netClass 字段）。
				// 任一网络已属于其他网络类时该侧回退为普通网络，按下方通用逻辑逐条展开，并如实提示。
				const legacyClass = entry.netClass && typeof entry.netClass === 'object' && entry.netClass.name ? entry.netClass.name : undefined;
				const leftClass = (isSet(entry.net1) ? (entry.net1 as any).className : undefined) || legacyClass;
				const rightClass = (isSet(entry.net2) ? (entry.net2 as any).className : undefined) || legacyClass;
				if (leftClass || rightClass) {
					const leftIsClass = !!leftClass && isPlannedClass(leftClass);
					const rightIsClass = !!rightClass && isPlannedClass(rightClass);
					if (leftIsClass && rightIsClass) {
						out.push({
							net1: { type: 'netClass', name: leftClass! },
							net2: { type: 'netClass', name: rightClass! },
							rule: entry.rule,
						});
						continue;
					}
					if (leftIsClass) {
						for (const right of rightRefs) {
							out.push(tagSetSource({ net1: { type: 'netClass', name: leftClass! }, net2: { type: 'net', name: right }, rule: entry.rule }, {
								label: `${leftClass} ↔ ${describeSetSide(entry.net2, 'B', rightRefs)}`,
								bNets: isSet(entry.net2) ? rightRefs : undefined,
							}));
						}
						continue;
					}
					if (rightIsClass) {
						for (const left of leftRefs) {
							out.push(tagSetSource({ net1: { type: 'net', name: left }, net2: { type: 'netClass', name: rightClass! }, rule: entry.rule }, {
								label: `${describeSetSide(entry.net1, 'A', leftRefs)} ↔ ${rightClass}`,
								aNets: isSet(entry.net1) ? leftRefs : undefined,
							}));
						}
						continue;
					}
				}
				// 集合引用：按笛卡尔积展开为具体网络对；文件里保留集合原样，便于复用到其他 PCB。
				// 展开项带隐藏来源标记（_src，JSON 序列化自动丢弃），差异预览按来源合并展示。
				const hasSetRef = isSet(entry.net1) || isSet(entry.net2);
				const srcLabel = hasSetRef
					? `${describeSetSide(entry.net1, 'A', leftRefs)} ↔ ${describeSetSide(entry.net2, 'B', rightRefs)}`
					: undefined;
				const srcMembers = hasSetRef
					? {
							aNets: isSet(entry.net1) ? leftRefs : undefined,
							bNets: isSet(entry.net2) ? rightRefs : undefined,
						}
					: undefined;
				for (const left of leftRefs) {
					for (const right of rightRefs) {
						const pair: NetByNetEntry = {
							net1: isSet(entry.net1) ? { type: 'net', name: left } : { ...clone(entry.net1), name: left },
							net2: isSet(entry.net2) ? { type: 'net', name: right } : { ...clone(entry.net2), name: right },
							rule: entry.rule,
						};
						if (srcLabel)
							tagSetSource(pair, { label: srcLabel, ...srcMembers });
						out.push(pair);
					}
				}
			}
			// 编辑器语义：一对网络只挂一个规则，同对后写覆盖先写（实测写入同对两条异规则时仅保留后者）。
			// 这里在计划层按网络对去重并保留最后一条；被覆盖的规则在跳过日志中如实说明。
			const pairKeyOf = (entry: NetByNetEntry): string =>
				[String(entry.net1?.name ?? '').toLowerCase(), String(entry.net2?.name ?? '').toLowerCase()].sort().join('|');
			const lastIndexOfPair = new Map<string, number>();
			for (let index = 0; index < out.length; index++)
				lastIndexOfPair.set(pairKeyOf(out[index]), index);
			if (lastIndexOfPair.size !== out.length) {
				const kept = out.filter((entry, index) => lastIndexOfPair.get(pairKeyOf(entry)) === index);
				for (let index = 0; index < out.length; index++) {
					const entry = out[index];
					const lastIndex = lastIndexOfPair.get(pairKeyOf(entry));
					if (lastIndex === undefined || lastIndex === index)
						continue;
					const finalEntry = out[lastIndex];
					if (String(finalEntry.rule) !== String(entry.rule)) {
						skip('netByNetRules', `网络对 ${group} · ${entry.net1.name} ↔ ${entry.net2.name}`, `被多条集合/条目定义分配了不同规则（${entry.rule}、${finalEntry.rule}），按编辑器语义保留后面的「${finalEntry.rule}」`);
					}
				}
				plan.netByNetRules[group] = kept;
			}
			else {
				plan.netByNetRules[group] = out;
			}
		}
	}

	return plan;
}
