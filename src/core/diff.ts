/** 差异引擎：把「可执行计划」与「本机现状」折算成人类可读的差异条目。 */
import type { Plan } from './plan';
import type { ConfigSetData, ModuleKey, NetRuleEntry } from './types';
import type { FieldDiff } from './util';
import { netRuleKey } from './plan';
import { MODULE_LABELS } from './types';
import { compareValues, ruleUnit } from './util';

export type DiffKind = 'added' | 'modified' | 'removed' | 'kept' | 'skipped' | 'unsupported';

export interface DiffEntry {
	module: ModuleKey;
	kind: DiffKind;
	path: string;
	note?: string;
	/** 展开核对用的明细行（如集合成员清单），预览树里点击行后显示 */
	detail?: string[];
	fields?: FieldDiff[];
}

export interface DiffResult {
	entries: DiffEntry[];
	summary: Record<DiffKind, number>;
	warnings: string[];
	skipped: { module: ModuleKey; what: string; reason: string }[];
}

function emptySummary(): Record<DiffKind, number> {
	return { added: 0, modified: 0, removed: 0, kept: 0, skipped: 0, unsupported: 0 };
}

function sameName(a: string, b: string): boolean {
	return String(a).toLowerCase() === String(b).toLowerCase();
}

function sameStringSet(a: string[], b: string[]): boolean {
	if (a.length !== b.length)
		return false;
	const set = new Set(b.map(x => x.toLowerCase()));
	return a.every(x => set.has(x.toLowerCase()));
}

export function diffPlan(plan: Plan, current: ConfigSetData): DiffResult {
	const entries: DiffEntry[] = [];
	const warnings: string[] = [];
	const add = (entry: DiffEntry): void => {
		entries.push(entry);
	};

	// ---------- 规则管理 ----------
	if (plan.ruleConfig) {
		const currentCfg = current.ruleConfig || {};
		for (const { top, group } of plan.ruleConfig.targeted) {
			const target = plan.ruleConfig.payload[top][group] || {};
			const present = (currentCfg[top] || {})[group] || {};
			for (const rule of Object.keys(target)) {
				const path = `${top} / ${group} / ${rule}`;
				if (!(rule in present)) {
					add({ module: 'ruleConfig', kind: 'added', path });
					continue;
				}
				const fields: FieldDiff[] = [];
				compareValues('', target[rule], present[rule], ruleUnit(target[rule]) ?? ruleUnit(present[rule]), fields);
				if (fields.length)
					add({ module: 'ruleConfig', kind: 'modified', path, fields });
			}
			for (const rule of Object.keys(present)) {
				if (!(rule in target))
					add({ module: 'ruleConfig', kind: 'removed', path: `${top} / ${group} / ${rule}`, note: '将随分组覆盖被删除' });
			}
		}
	}

	// ---------- 网络规则 ----------
	if (plan.modules.includes('netRules')) {
		const currentMap = new Map<string, NetRuleEntry>((current.netRules || []).map(entry => [netRuleKey(entry), entry]));
		const compareEntry = (entry: NetRuleEntry, label: string): void => {
			const present = currentMap.get(netRuleKey(entry));
			if (!present) {
				add({ module: 'netRules', kind: 'added', path: label });
				return;
			}
			const fields: FieldDiff[] = [];
			compareValues('', entry, present, undefined, fields);
			if (fields.length)
				add({ module: 'netRules', kind: 'modified', path: label, fields });
		};
		for (const entry of plan.netRules.netEntries) compareEntry(entry, `网络规则 ${entry.name}`);
		for (const entry of plan.netRules.classEntries) compareEntry(entry, `网络类规则 ${entry.name}`);
		for (const entry of plan.netRules.groupEntries) compareEntry(entry, `等长组规则 ${entry.name}`);
		for (const entry of plan.netRules.memberEntries) {
			const owner = plan.netRules.memberOwner[String(entry.name).toLowerCase()] || '';
			add({ module: 'netRules', kind: 'kept', path: `网络规则 ${entry.name}`, note: `该网络属于「${owner}」，规则将并入该条目的成员列表` });
		}
	}

	// ---------- 网络类 ----------
	if (plan.modules.includes('netClasses')) {
		const currentClasses = current.netClasses || [];
		for (const cls of plan.netClasses) {
			const present = currentClasses.find(c => sameName(c.name, cls.name));
			if (!present) {
				add({ module: 'netClasses', kind: 'added', path: `网络类 ${cls.name}`, note: `成员：${cls.nets.join(', ')}` });
			}
			else if (!sameStringSet(cls.nets, present.nets)) {
				const toAdd = cls.nets.filter(net => !(present.nets || []).some(x => sameName(x, net)));
				const keptMembers = (present.nets || []).filter(net => !cls.nets.some(x => sameName(x, net)));
				const note = [
					toAdd.length ? `新增成员：${toAdd.join(', ')}` : '',
					keptMembers.length ? `本机多出的成员保留：${keptMembers.join(', ')}` : '',
				].filter(Boolean).join('；');
				if (note)
					add({ module: 'netClasses', kind: 'modified', path: `网络类 ${cls.name}`, note });
				if (keptMembers.length)
					warnings.push(`网络类「${cls.name}」里本机多出的成员（${keptMembers.join(', ')}）按规则不移出该类。`);
			}
		}
	}

	// ---------- 差分对 ----------
	// ---------- 附加草稿声明的网络类（不依赖「网络类」模块勾选，始终随网络-网络规则展示） ----------
	for (const cls of plan.draftClasses) {
		const present = (current.netClasses || []).find(c => sameName(c.name, cls.name));
		if (!present) {
			add({ module: 'netClasses', kind: 'added', path: `网络类 ${cls.name}`, note: `成员：${cls.nets.join(', ')}（附加网络对草稿）` });
		}
		else {
			const toAdd = cls.nets.filter(net => !(present.nets || []).some(x => sameName(x, net)));
			if (toAdd.length)
				add({ module: 'netClasses', kind: 'modified', path: `网络类 ${cls.name}`, note: `新增成员：${toAdd.join(', ')}（附加网络对草稿）` });
		}
	}

	// ---------- 差分对 ----------
	if (plan.modules.includes('differentialPairs')) {
		const currentPairs = current.differentialPairs || [];
		for (const pair of plan.differentialPairs) {
			const present = currentPairs.find(p => sameName(p.name, pair.name));
			if (!present) {
				add({ module: 'differentialPairs', kind: 'added', path: `差分对 ${pair.name}`, note: `${pair.positiveNet} / ${pair.negativeNet}` });
			}
			else if (!sameName(present.positiveNet, pair.positiveNet) || !sameName(present.negativeNet, pair.negativeNet)) {
				add({ module: 'differentialPairs', kind: 'modified', path: `差分对 ${pair.name}`, note: `${present.positiveNet}/${present.negativeNet} → ${pair.positiveNet}/${pair.negativeNet}（只改网络，不删除重建）` });
			}
		}
	}

	// ---------- 等长网络组 ----------
	if (plan.modules.includes('equalLengthGroups')) {
		const currentGroups = current.equalLengthGroups || [];
		for (const group of plan.equalLengthGroups) {
			const present = currentGroups.find(g => sameName(g.name, group.name));
			if (!present) {
				add({ module: 'equalLengthGroups', kind: 'added', path: `等长网络组 ${group.name}`, note: `成员：${group.nets.join(', ')}` });
			}
			else if (!sameStringSet(group.nets, present.nets)) {
				const toAdd = group.nets.filter(net => !(present.nets || []).some(x => sameName(x, net)));
				const keptMembers = (present.nets || []).filter(net => !group.nets.some(x => sameName(x, net)));
				const note = [
					toAdd.length ? `新增成员：${toAdd.join(', ')}` : '',
					keptMembers.length ? `本机多出的成员保留：${keptMembers.join(', ')}` : '',
				].filter(Boolean).join('；');
				if (note)
					add({ module: 'equalLengthGroups', kind: 'modified', path: `等长网络组 ${group.name}`, note });
				if (keptMembers.length)
					warnings.push(`等长网络组「${group.name}」里本机多出的成员（${keptMembers.join(', ')}）按规则不移出该组。`);
			}
		}
	}

	// ---------- 网络-网络规则 ----------
	if (plan.modules.includes('netByNetRules')) {
		const currentGroups = current.netByNetRules || {};
		const keyOf = (entry: any): string => `${String(entry.net1?.name).toLowerCase()}|${String(entry.net2?.name).toLowerCase()}`;
		// 集合展开产生的对按来源合并展示：一行 = 一条附加网络集合规则（写入仍是展开后的对）
		interface SrcBucket { kind: 'added' | 'modified'; group: string; src: string; rule?: string; firstNote?: string; count: number; detail: string[] }
		const srcBuckets = new Map<string, SrcBucket>();
		const bucketKey = (group: string, kind: string, src: { label: string }): string => `${group}|${kind}|${src.label}`;
		const sourceDetail = (src: { label: string; aNets?: string[]; bNets?: string[] }): string[] => {
			const lines: string[] = [];
			if (src.aNets)
				lines.push(`集合A成员（${src.aNets.length}）：${src.aNets.join(', ')}`);
			if (src.bNets)
				lines.push(`集合B成员（${src.bNets.length}）：${src.bNets.join(', ')}`);
			return lines;
		};
		for (const group of Object.keys(plan.netByNetRules)) {
			const target = plan.netByNetRules[group] || [];
			const present = currentGroups[group] || [];
			if (!(group in currentGroups)) {
				if (target.length)
					add({ module: 'netByNetRules', kind: 'added', path: `${group} (${target.length} 条)` });
				continue;
			}
			const presentMap = new Map(present.map(entry => [keyOf(entry), entry]));
			const targetKeys = new Set(target.map(entry => keyOf(entry)));
			for (const entry of target) {
				const label = `${group} · ${entry.net1.name} ↔ ${entry.net2.name}`;
				const src = (entry as any)._src as { label: string; aNets?: string[]; bNets?: string[] } | undefined;
				const hit = presentMap.get(keyOf(entry));
				if (!hit) {
					if (src) {
						const key = bucketKey(group, 'added', src);
						const bucket = srcBuckets.get(key);
						if (bucket)
							bucket.count += 1;
						else
							srcBuckets.set(key, { kind: 'added', group, src: src.label, rule: entry.rule, count: 1, detail: sourceDetail(src) });
					}
					else {
						add({ module: 'netByNetRules', kind: 'added', path: label, note: `规则：${entry.rule}` });
					}
				}
				else if (hit.rule !== entry.rule) {
					if (src) {
						const key = bucketKey(group, 'modified', src);
						const bucket = srcBuckets.get(key);
						if (bucket)
							bucket.count += 1;
						else
							srcBuckets.set(key, { kind: 'modified', group, src: src.label, firstNote: `${hit.rule} → ${entry.rule}`, count: 1, detail: sourceDetail(src) });
					}
					else {
						add({ module: 'netByNetRules', kind: 'modified', path: label, note: `${hit.rule} → ${entry.rule}` });
					}
				}
			}
			for (const entry of present) {
				if (!targetKeys.has(keyOf(entry))) {
					add({ module: 'netByNetRules', kind: 'removed', path: `${group} · ${entry.net1.name} ↔ ${entry.net2.name}`, note: '将删除该条目' });
				}
			}
			for (const bucket of srcBuckets.values()) {
				add({
					module: 'netByNetRules',
					kind: bucket.kind,
					path: `${bucket.group} · ${bucket.src}`,
					note: bucket.kind === 'added'
						? `规则：${bucket.rule}（展开 ${bucket.count} 对）`
						: `规则：${bucket.firstNote}${bucket.count > 1 ? ` 等（共 ${bucket.count} 对）` : ''}`,
					detail: bucket.detail.length ? bucket.detail : undefined,
				});
			}
			srcBuckets.clear();
		}
	}

	// ---------- 跳过项 ----------
	for (const item of plan.skipped) {
		add({ module: item.module, kind: 'skipped', path: item.what, note: item.reason });
	}

	const summary = emptySummary();
	for (const entry of entries) summary[entry.kind] += 1;
	return { entries, summary, warnings, skipped: plan.skipped };
}

export function describeModule(module: ModuleKey): string {
	return MODULE_LABELS[module] || module;
}
