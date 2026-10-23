/**
 * 导入执行引擎。
 *
 * 执行顺序（顺序即正确性）：
 *   1. 规则管理（裸 config，必须四个顶层分类齐全）
 *   2. 网络类（新建缺失的网络类 / 追加重名类成员；不删除本机已有网络类）
 *   3. 等长网络组（新建缺失的等长组 / 追加成员；不删除本机已有等长组）
 *   4. 差分对（新建缺失的差分对 / 改网络；不删除、不做「先删后建」）
 *   5. 网络规则（普通网络 + 网络类 + 等长组，一次性完整提交）
 *   6. 网络-网络规则（必须包含所有分组键）
 *   7. 终检：回读整篇，确认前面各步没有互相破坏
 *
 * 每一步写完都会回读校验：这些接口在载荷不合法时会「静默忽略并返回 undefined」，
 * 因此不能用返回值判断成败，必须回读。
 *
 * 关键实测结论：
 *  - overwriteCurrentRuleConfiguration 必须带齐 Spacing / Physics / Plane / Expansion 四个顶层分类；
 *  - overwriteNetRules 会「整篇重写」网络规则文档：载荷里缺失的网络类 / 等长组条目会被直接摧毁，
 *    所以普通网络、网络类、等长组必须放在同一次调用里提交；
 *  - 网络规则条目必须提交完整（含 sub / Differential Pair 等派生键），否则这些键会被清空；
 *  - overwriteNetByNetRules 必须带齐本机已有的所有分组键，否则整篇被忽略；
 *  - 产品策略「三个管理器只增不删」：本机已有、配置文件里没有的网络类 / 等长网络组 / 差分对一律保留；
 *    差分对改网络走 modifyDifferentialPairPositiveNet / NegativeNet，绝不 delete + create。
 */
import type { Plan } from './plan';
import type { NetRuleEntry } from './types';
import type { FieldDiff } from './util';
import { drc } from './eda';
import { mergeNetRuleEntry, netRuleKey } from './plan';
import { clone, compareValues, isPlainObject } from './util';

export interface ApplyStep {
	name: string;
	label: string;
	ok: boolean;
	skipped?: boolean;
	returned?: any;
	error?: string;
	verified?: boolean;
	detail?: any;
}

export interface ApplyResult {
	steps: ApplyStep[];
	ok: boolean;
	failed?: string;
}

const SILENTLY_IGNORED = '接口返回 undefined：载荷被静默忽略（通常缺少必需的顶层键或结构不符）';

function sameName(a: string, b: string): boolean {
	return String(a).toLowerCase() === String(b).toLowerCase();
}

async function readNetRules(): Promise<NetRuleEntry[]> {
	try {
		return ((await drc().getNetRules()) || []) as NetRuleEntry[];
	}
	catch {
		return [];
	}
}

/** 比较用：剔除由差分对管理器决定的派生键 */
function stripDerived(entry: NetRuleEntry): any {
	const copy: any = clone(entry);
	delete copy['Differential Pair'];
	return copy;
}

async function verifyNetRuleEntries(expected: NetRuleEntry[]): Promise<{ ok: boolean; diffs: FieldDiff[] }> {
	const current = await readNetRules();
	const map = new Map(current.map(entry => [netRuleKey(entry), entry]));
	const diffs: FieldDiff[] = [];
	for (const entry of expected) {
		const present = map.get(netRuleKey(entry));
		if (!present) {
			diffs.push({ path: `${entry.type}|${entry.name}`, left: '存在', right: '缺失' });
			continue;
		}
		const local: FieldDiff[] = [];
		compareValues('', stripDerived(entry), stripDerived(present), undefined, local);
		for (const item of local) diffs.push({ ...item, path: `${entry.name}.${item.path}` });
	}
	return { ok: diffs.length === 0, diffs };
}

/**
 * 构造网络规则载荷。
 *
 * overwriteNetRules 是「整篇重写」而不是「按条目合并」：载荷里没有的条目会被直接摧毁。
 * 所以载荷必须是「管理器步骤执行完后的本机全量快照」再叠加文件覆盖值：
 *   1) 本机条目作底稿，网络类 / 等长组的成员规则先把文件值并入对应 sub 元素；
 *   2) 计划目标覆盖上去（保留本机派生键）；
 *   3) 其余本机条目原样带回，任何漏带都会造成破坏。
 */
function buildNetRulesPayload(plan: Plan, live: NetRuleEntry[]): NetRuleEntry[] {
	const memberByNet = new Map<string, NetRuleEntry>();
	for (const entry of plan.netRules.memberEntries) memberByNet.set(String(entry.name).toLowerCase(), entry);
	const ownerOf = plan.netRules.memberOwner;

	const payload: NetRuleEntry[] = [];
	const indexByKey = new Map<string, number>();
	const put = (entry: NetRuleEntry): void => {
		indexByKey.set(netRuleKey(entry), payload.length);
		payload.push(entry);
	};

	// 1) 本机条目作底稿：成员网络的规则并入所属条目的 sub
	for (const entry of live) {
		if (entry.type === 'netClass' || entry.type === 'equalLengthGroup') {
			const sub = (entry.sub || []).map((item: any) => {
				const lower = String(item.name).toLowerCase();
				const override = ownerOf[lower] && sameName(ownerOf[lower], entry.name) ? memberByNet.get(lower) : undefined;
				return override ? mergeNetRuleEntry(item, override) : clone(item);
			});
			put({ ...clone(entry), sub } as NetRuleEntry);
		}
		else {
			put(clone(entry));
		}
	}

	// 2) 计划目标覆盖
	const targets = [...plan.netRules.netEntries, ...plan.netRules.classEntries, ...plan.netRules.groupEntries];
	for (const target of targets) {
		const key = netRuleKey(target);
		const at = indexByKey.get(key);
		if (at === undefined) {
			indexByKey.set(key, payload.length);
			payload.push(mergeNetRuleEntry(undefined, target));
		}
		else {
			payload[at] = mergeNetRuleEntry(payload[at], target);
		}
	}
	return payload;
}

export async function applyPlan(plan: Plan, options: { deleteClasses?: string[] } = {}): Promise<ApplyResult> {
	const api = drc();
	const steps: ApplyStep[] = [];
	const push = (step: ApplyStep): void => {
		steps.push(step);
	};

	// ---------- 1. 规则管理 ----------
	if (plan.ruleConfig) {
		const step: ApplyStep = { name: 'ruleConfig', label: '规则管理', ok: true };
		try {
			const returned = await api.overwriteCurrentRuleConfiguration(plan.ruleConfig.payload);
			step.returned = returned;
			if (typeof returned === 'undefined') {
				step.ok = false;
				step.error = SILENTLY_IGNORED;
			}
			else {
				const after: any = await api.getCurrentRuleConfiguration();
				const cfg = (after && (after.config ?? after)) || {};
				const diffs: FieldDiff[] = [];
				for (const { top, group } of plan.ruleConfig.targeted) {
					const target = plan.ruleConfig.payload[top][group] || {};
					const present = (cfg[top] || {})[group] || {};
					for (const rule of Object.keys(target)) {
						const local: FieldDiff[] = [];
						compareValues('', target[rule], present[rule], undefined, local);
						if (!(rule in present))
							local.push({ path: rule, left: '存在', right: '缺失' });
						for (const item of local) diffs.push({ ...item, path: `${top} / ${group} / ${rule}${item.path ? `.${item.path}` : ''}` });
					}
				}
				step.verified = diffs.length === 0;
				step.detail = diffs.slice(0, 20);
				if (diffs.length) {
					step.ok = false;
					step.error = '回读校验未通过';
				}
			}
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	// ---------- 1.5 清理附加草稿建的网络类（一键还原专用） ----------
	if (options.deleteClasses && options.deleteClasses.length) {
		const step: ApplyStep = { name: 'deleteDraftClasses', label: '清理草稿网络类', ok: true, detail: [] as any[] };
		try {
			const detail: any[] = [];
			for (const name of options.deleteClasses)
				detail.push({ action: 'delete', name, ok: await api.deleteNetClass(name) });
			step.detail = detail;
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	// ---------- 2. 网络类 ----------
	if (plan.modules.includes('netClasses')) {
		const step: ApplyStep = { name: 'netClasses', label: '网络类', ok: true, detail: [] as any[] };
		try {
			const current = ((await api.getAllNetClasses()) || []) as any[];
			const detail: any[] = [];
			// 普通导入：本机已有、配置文件里没有的网络类保留不删，只记录为保留。
			// 还原模式：必须删掉导入时新建的网络类 / 把成员精确对齐，否则回不到导入前的状态。
			for (const cls of current) {
				const declared = plan.exact ? plan.exact.netClasses[String(cls.name).toLowerCase()] : undefined;
				if (plan.exact && declared === undefined) {
					// 老版本没有删除接口时降级：保留对象并如实记录，避免整步抛出异常
					detail.push(typeof api.deleteNetClass === 'function'
						? { action: 'delete', name: cls.name, ok: await api.deleteNetClass(cls.name) }
						: { action: 'unsupported', name: cls.name, note: '当前 EDA 版本缺少删除网络类的接口，保留本机对象' });
					continue;
				}
				if (plan.exact && declared) {
					const extra = ((cls.nets || []) as string[]).filter(net => !declared.some(x => sameName(x, net)));
					if (extra.length)
						detail.push({ action: 'removeNet', name: cls.name, nets: extra, ok: await api.removeNetFromNetClass(cls.name, extra) });
					continue;
				}
				if (!plan.netClasses.some(target => sameName(target.name, cls.name)))
					detail.push({ action: 'keep', name: cls.name, ok: true });
			}
			for (const target of plan.netClasses) {
				const present = current.find(cls => sameName(cls.name, target.name));
				if (!present) {
					detail.push({ action: 'create', name: target.name, nets: target.nets, ok: await api.createNetClass(target.name, target.nets, null) });
					continue;
				}
				const presentNets = (present.nets || []) as string[];
				const toAdd = target.nets.filter(net => !presentNets.some(x => sameName(x, net)));
				// 不把本机多出的成员移出网络类：只追加，不删除。
				if (toAdd.length)
					detail.push({ action: 'addNet', name: target.name, nets: toAdd, ok: await api.addNetToNetClass(target.name, toAdd) });
			}
			step.detail = detail;
			const after = ((await api.getAllNetClasses()) || []) as any[];
			// 普通导入：本机可能保留配置文件之外的多余网络类，只要求「不少于」且目标类成员齐全。
			// 还原模式：要求精确一致 —— 不能有多余的网络类，且目标类成员完全相等。
			const targetsMatch = (list: any[]): boolean => plan.netClasses.every((target) => {
				const present = list.find(cls => sameName(cls.name, target.name));
				return !!present && target.nets.length === (present.nets || []).length
					&& target.nets.every(net => (present.nets as string[]).some(x => sameName(x, net)));
			});
			const ok = plan.exact
				? after.every(cls => plan.exact!.netClasses[String(cls.name).toLowerCase()] !== undefined) && targetsMatch(after)
				: after.length >= plan.netClasses.length && targetsMatch(after);
			step.verified = ok;
			if (!ok) {
				step.ok = false;
				step.error = '回读校验未通过';
			}
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	// ---------- 2.5 附加草稿建的网络类（先于网络规则写入：成员规则值要并入类成员） ----------
	if (plan.draftClasses.length) {
		const step: ApplyStep = { name: 'draftClasses', label: '网络类（附加网络集合草稿）', ok: true, detail: [] as any[] };
		try {
			const detail: any[] = [];
			const classes = ((await api.getAllNetClasses()) || []) as any[];
			for (const draft of plan.draftClasses) {
				const present = classes.find(cls => sameName(cls.name, draft.name));
				if (!present) {
					detail.push({ action: 'createDraftClass', name: draft.name, nets: draft.nets, ok: await api.createNetClass(draft.name, draft.nets, null) });
					continue;
				}
				const presentNets = (present.nets || []) as string[];
				const toAdd = draft.nets.filter(net => !presentNets.some(x => sameName(x, net)));
				if (toAdd.length)
					detail.push({ action: 'addDraftNet', name: draft.name, nets: toAdd, ok: await api.addNetToNetClass(draft.name, toAdd) });
			}
			step.detail = detail;
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	// ---------- 3. 等长网络组 ----------
	if (plan.modules.includes('equalLengthGroups')) {
		const step: ApplyStep = { name: 'equalLengthGroups', label: '等长网络组', ok: true, detail: [] as any[] };
		try {
			const current = ((await api.getAllEqualLengthNetGroups()) || []) as any[];
			const detail: any[] = [];
			// 普通导入：本机已有、配置文件里没有的等长网络组保留不删，只记录为保留。
			// 还原模式：必须删掉导入时新建的等长组 / 把成员精确对齐。
			for (const group of current) {
				const declared = plan.exact ? plan.exact.equalLengthGroups[String(group.name).toLowerCase()] : undefined;
				if (plan.exact && declared === undefined) {
					detail.push(typeof api.deleteEqualLengthNetGroup === 'function'
						? { action: 'delete', name: group.name, ok: await api.deleteEqualLengthNetGroup(group.name) }
						: { action: 'unsupported', name: group.name, note: '当前 EDA 版本缺少删除等长网络组的接口，保留本机对象' });
					continue;
				}
				if (plan.exact && declared) {
					const extra = ((group.nets || []) as string[]).filter(net => !declared.some(x => sameName(x, net)));
					if (extra.length)
						detail.push({ action: 'removeNet', name: group.name, nets: extra, ok: await api.removeNetFromEqualLengthNetGroup(group.name, extra) });
					continue;
				}
				if (!plan.equalLengthGroups.some(target => sameName(target.name, group.name)))
					detail.push({ action: 'keep', name: group.name, ok: true });
			}
			for (const target of plan.equalLengthGroups) {
				const present = current.find(group => sameName(group.name, target.name));
				if (!present) {
					detail.push({ action: 'create', name: target.name, nets: target.nets, ok: await api.createEqualLengthNetGroup(target.name, target.nets, null) });
					continue;
				}
				const presentNets = (present.nets || []) as string[];
				const toAdd = target.nets.filter(net => !presentNets.some(x => sameName(x, net)));
				// 不把本机多出的成员移出等长网络组：只追加，不删除。
				if (toAdd.length)
					detail.push({ action: 'addNet', name: target.name, nets: toAdd, ok: await api.addNetToEqualLengthNetGroup(target.name, toAdd) });
			}
			step.detail = detail;
			const after = ((await api.getAllEqualLengthNetGroups()) || []) as any[];
			const groupsMatch = (list: any[]): boolean => plan.equalLengthGroups.every((target) => {
				const present = list.find(group => sameName(group.name, target.name));
				return !!present && target.nets.length === (present.nets || []).length
					&& target.nets.every(net => (present.nets as string[]).some(x => sameName(x, net)));
			});
			// 普通导入：本机多余的等长网络组会被保留；还原模式要求精确一致。
			const ok = plan.exact
				? after.every(group => plan.exact!.equalLengthGroups[String(group.name).toLowerCase()] !== undefined) && groupsMatch(after)
				: after.length >= plan.equalLengthGroups.length && groupsMatch(after);
			step.verified = ok;
			if (!ok) {
				step.ok = false;
				step.error = '回读校验未通过';
			}
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	// ---------- 4. 差分对 ----------
	if (plan.modules.includes('differentialPairs')) {
		const step: ApplyStep = { name: 'differentialPairs', label: '差分对', ok: true, detail: [] as any[] };
		try {
			const current = ((await api.getAllDifferentialPairs()) || []) as any[];
			const detail: any[] = [];
			// 普通导入：本机已有、配置文件里没有的差分对保留不删，只记录为保留。
			// 还原模式：必须删掉导入时新建的差分对。
			for (const pair of current) {
				if (plan.exact && !plan.exact.differentialPairs.includes(String(pair.name).toLowerCase())) {
					detail.push(typeof api.deleteDifferentialPair === 'function'
						? { action: 'delete', name: pair.name, ok: await api.deleteDifferentialPair(pair.name) }
						: { action: 'unsupported', name: pair.name, note: '当前 EDA 版本缺少删除差分对的接口，保留本机对象' });
					continue;
				}
				if (!plan.differentialPairs.some(target => sameName(target.name, pair.name)))
					detail.push({ action: 'keep', name: pair.name, ok: true });
			}
			for (const target of plan.differentialPairs) {
				const present = current.find(pair => sameName(pair.name, target.name));
				if (!present) {
					detail.push({ action: 'create', name: target.name, ok: await api.createDifferentialPair(target.name, target.positiveNet, target.negativeNet) });
					continue;
				}
				const netChanged = !sameName(present.positiveNet, target.positiveNet) || !sameName(present.negativeNet, target.negativeNet);
				if (!netChanged)
					continue;
				// 已存在同名差分对：只改网络，绝不删除重建（删除是不可恢复操作）。
				const canModify = typeof api.modifyDifferentialPairPositiveNet === 'function' && typeof api.modifyDifferentialPairNegativeNet === 'function';
				if (!canModify) {
					detail.push({ action: 'unsupported', name: target.name, note: '当前 EDA 版本缺少修改差分对网络的接口，保留本机原值' });
					continue;
				}
				if (!sameName(present.positiveNet, target.positiveNet))
					detail.push({ action: 'modifyPositiveNet', name: target.name, net: target.positiveNet, ok: await api.modifyDifferentialPairPositiveNet(target.name, target.positiveNet) });
				if (!sameName(present.negativeNet, target.negativeNet))
					detail.push({ action: 'modifyNegativeNet', name: target.name, net: target.negativeNet, ok: await api.modifyDifferentialPairNegativeNet(target.name, target.negativeNet) });
			}
			step.detail = detail;
			const after = ((await api.getAllDifferentialPairs()) || []) as any[];
			const pairsMatch = (list: any[]): boolean => plan.differentialPairs.every((target) => {
				const present = list.find(pair => sameName(pair.name, target.name));
				return !!present && sameName(present.positiveNet, target.positiveNet) && sameName(present.negativeNet, target.negativeNet);
			});
			// 普通导入：本机多余的差分对会被保留；还原模式要求精确一致。
			const ok = plan.exact
				? after.every(pair => plan.exact!.differentialPairs.includes(String(pair.name).toLowerCase())) && pairsMatch(after)
				: after.length >= plan.differentialPairs.length && pairsMatch(after);
			step.verified = ok;
			if (!ok) {
				step.ok = false;
				step.error = '回读校验未通过';
			}
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	// ---------- 5. 网络规则（一次性完整提交） ----------
	if (plan.modules.includes('netRules')) {
		const liveBefore = await readNetRules();
		const payload = buildNetRulesPayload(plan, liveBefore);
		if (payload.length) {
			const step: ApplyStep = { name: 'netRules', label: '网络规则（网络 / 网络类 / 等长组）', ok: true };
			try {
				const byType: Record<string, number> = {};
				for (const entry of payload) byType[entry.type] = (byType[entry.type] || 0) + 1;
				step.detail = { 提交条目数: payload.length, 按类型: byType };
				const returned = await api.overwriteNetRules(payload);
				step.returned = returned;
				if (typeof returned === 'undefined') {
					step.ok = false;
					step.error = SILENTLY_IGNORED;
				}
				else {
					const result = await verifyNetRuleEntries(payload);
					step.verified = result.ok;
					if (!result.ok) {
						step.ok = false;
						step.error = '回读校验未通过';
						step.detail = result.diffs.slice(0, 20);
					}
				}
			}
			catch (e: any) {
				step.ok = false;
				step.error = String(e?.message || e);
			}
			push(step);
		}
	}

	// ---------- 6. 网络-网络规则 ----------
	if (plan.modules.includes('netByNetRules')) {
		const step: ApplyStep = { name: 'netByNetRules', label: '网络-网络规则', ok: true };
		try {
			const returned = await api.overwriteNetByNetRules(plan.netByNetRules);
			step.returned = returned;
			if (typeof returned === 'undefined') {
				step.ok = false;
				step.error = SILENTLY_IGNORED;
			}
			else {
				const after: any = (await api.getNetByNetRules()) || {};
				const diffs: string[] = [];
				for (const group of Object.keys(plan.netByNetRules)) {
					const expect = (plan.netByNetRules[group] || []).map(entry => `${entry.net1.name}|${entry.net2.name}|${entry.rule}`).sort();
					const actual = (after[group] || []).map((entry: any) => `${entry.net1.name}|${entry.net2.name}|${entry.rule}`).sort();
					if (JSON.stringify(expect) !== JSON.stringify(actual))
						diffs.push(`${group}: 期望 ${expect.length} 条，实际 ${actual.length} 条`);
				}
				step.verified = diffs.length === 0;
				step.detail = diffs;
				if (diffs.length) {
					step.ok = false;
					step.error = '回读校验未通过';
				}
			}
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	// ---------- 7. 终检 ----------
	// 这一步专门防「步骤之间互相破坏」：例如写入网络规则时顺手摧毁了刚刚建好的网络类。
	{
		const step: ApplyStep = { name: 'finalCheck', label: '终检', ok: true };
		try {
			const problems: string[] = [];
			if (plan.modules.includes('netClasses')) {
				const live = ((await api.getAllNetClasses()) || []) as any[];
				if (live.length < plan.netClasses.length)
					problems.push(`网络类数量：期望至少 ${plan.netClasses.length}，实际 ${live.length}`);
				for (const target of plan.netClasses) {
					const present = live.find(cls => sameName(cls.name, target.name));
					if (!present) {
						problems.push(`网络类 ${target.name} 缺失`);
						continue;
					}
					const nets = (present.nets || []) as string[];
					if (!target.nets.every(net => nets.some(x => sameName(x, net)))) {
						problems.push(`网络类 ${target.name} 成员缺失：期望包含 ${target.nets.join(',')}，实际 ${nets.join(',')}`);
					}
				}
			}
			if (plan.modules.includes('equalLengthGroups')) {
				const live = ((await api.getAllEqualLengthNetGroups()) || []) as any[];
				if (live.length < plan.equalLengthGroups.length)
					problems.push(`等长网络组数量：期望至少 ${plan.equalLengthGroups.length}，实际 ${live.length}`);
				for (const target of plan.equalLengthGroups) {
					const present = live.find(group => sameName(group.name, target.name));
					if (!present) {
						problems.push(`等长网络组 ${target.name} 缺失`);
						continue;
					}
					const nets = (present.nets || []) as string[];
					if (!target.nets.every(net => nets.some(x => sameName(x, net)))) {
						problems.push(`等长网络组 ${target.name} 成员缺失：期望包含 ${target.nets.join(',')}，实际 ${nets.join(',')}`);
					}
				}
			}
			if (plan.modules.includes('differentialPairs')) {
				const live = ((await api.getAllDifferentialPairs()) || []) as any[];
				if (live.length < plan.differentialPairs.length)
					problems.push(`差分对数量：期望至少 ${plan.differentialPairs.length}，实际 ${live.length}`);
				for (const target of plan.differentialPairs) {
					const present = live.find(pair => sameName(pair.name, target.name));
					if (!present) {
						problems.push(`差分对 ${target.name} 缺失`);
						continue;
					}
					if (!sameName(present.positiveNet, target.positiveNet) || !sameName(present.negativeNet, target.negativeNet)) {
						problems.push(`差分对 ${target.name} 网络不符：期望 ${target.positiveNet}/${target.negativeNet}，实际 ${present.positiveNet}/${present.negativeNet}`);
					}
				}
			}
			if (plan.modules.includes('netRules')) {
				const live = await readNetRules();
				const keys = new Set(live.map(netRuleKey));
				const expected = [...plan.netRules.netEntries, ...plan.netRules.classEntries, ...plan.netRules.groupEntries];
				for (const entry of expected) {
					if (!keys.has(netRuleKey(entry)))
						problems.push(`网络规则条目缺失：${entry.type} ${entry.name}`);
				}
			}
			if (plan.draftClasses.length) {
				const liveClasses = ((await api.getAllNetClasses()) || []) as any[];
				for (const draft of plan.draftClasses) {
					const present = liveClasses.find(cls => sameName(cls.name, draft.name));
					if (!present) {
						problems.push(`网络类 ${draft.name} 缺失（附加网络集合草稿）`);
						continue;
					}
					const nets = (present.nets || []) as string[];
					if (!draft.nets.every(net => nets.some(x => sameName(x, net))))
						problems.push(`网络类 ${draft.name} 成员缺失：期望包含 ${draft.nets.join(',')}，实际 ${nets.join(',')}`);
				}
			}
			if (plan.modules.includes('netByNetRules')) {
				const live: any = (await api.getNetByNetRules()) || {};
				for (const group of Object.keys(plan.netByNetRules)) {
					const expect = (plan.netByNetRules[group] || []).length;
					const actual = (live[group] || []).length;
					if (expect !== actual)
						problems.push(`网络-网络规则 ${group}：期望 ${expect} 条，实际 ${actual} 条`);
				}
			}
			step.detail = problems.slice(0, 40);
			step.verified = problems.length === 0;
			if (problems.length) {
				step.ok = false;
				step.error = '终检发现不一致';
			}
		}
		catch (e: any) {
			step.ok = false;
			step.error = String(e?.message || e);
		}
		push(step);
	}

	const failed = steps.find(step => !step.ok);
	return { steps, ok: !failed, failed: failed?.name };
}

export function toPlainStep(step: ApplyStep): Record<string, any> {
	return {
		name: step.name,
		label: step.label,
		ok: step.ok,
		verified: step.verified,
		error: step.error,
		returned: isPlainObject(step.returned) ? 'object' : step.returned,
		detailCount: Array.isArray(step.detail) ? step.detail.length : undefined,
	};
}
