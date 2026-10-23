/** 导出时的「附加网络对」草稿：集合原样写入文件，不做当前 PCB 网络校验。 */
import type { RuleConfigSet } from './types';
import { ruleGroupLabel, topByRuleGroup } from './labels';

export interface PairDraft {
	group: string;
	rule: string;
	aNets: string[];
	bNets: string[];
	/** 各集合自己的网络类（可选）：导入时该集合网络加入新建 / 同名网络类 */
	aClass?: string;
	bClass?: string;
}

/**
 * 把附加草稿并入导出文件（不做当前 PCB 网络校验，导入时与目标板求交）：
 * - 两侧集合都有：网络对条目，集合上可各自声明 className；
 * - 只填一个集合 + 类名：仅建类 / 补成员（single 标记），不产生网络对；
 * - 只填一个集合、无类名：作为「网络规则」条目写入文件。
 */
export function appendPairDrafts(file: RuleConfigSet, drafts: PairDraft[]): void {
	if (!drafts.length)
		return;
	file.data.netByNetRules = file.data.netByNetRules || {};
	for (const draft of drafts) {
		if (draft.aNets.length && draft.bNets.length) {
			const list = file.data.netByNetRules[draft.group] || (file.data.netByNetRules[draft.group] = []);
			list.push({
				net1: { type: 'set', nets: [...draft.aNets], className: draft.aClass || undefined },
				net2: { type: 'set', nets: [...draft.bNets], className: draft.bClass || undefined },
				rule: draft.rule,
			});
			continue;
		}
		const nets = draft.aNets.length ? draft.aNets : draft.bNets;
		if (!nets.length)
			continue;
		const className = draft.aNets.length ? draft.aClass : draft.bClass;
		const list = file.data.netByNetRules[draft.group] || (file.data.netByNetRules[draft.group] = []);
		if (className) {
			const side = draft.aNets.length ? 'net1' : 'net2';
			list.push({
				net1: side === 'net1' ? { type: 'set', nets: [...nets], className } : { type: 'set', nets: [] },
				net2: side === 'net2' ? { type: 'set', nets: [...nets], className } : { type: 'set', nets: [] },
				rule: draft.rule,
				single: side,
			});
		}
		else {
			file.data.netRules = file.data.netRules || [];
			for (const net of nets) {
				if (!file.data.netRules.some(entry => entry.type === 'net' && String(entry.name).toLowerCase() === net.toLowerCase()))
					file.data.netRules.push({ type: 'net', name: net });
			}
			if (!file.modules.includes('netRules'))
				file.modules.push('netRules');
		}
	}
	if (!file.modules.includes('netByNetRules') && Object.keys(file.data.netByNetRules).length)
		file.modules.push('netByNetRules');
}

/** 导出预览清单：让用户在弹窗里直接看到这份文件会包含什么 */
export interface ExportSummary {
	ruleConfigGroups: { top: string; group: string; count: number }[];
	ruleConfigCount: number;
	netClassNames: string[];
	netRuleCount: number;
	netRuleGroups: { label: string; total: number; custom: number }[];
	netByNetGroups: Record<string, number>;
	differentialPairCount: number;
	equalLengthGroupCount: number;
}

export function buildExportSummary(data: Record<string, any>): ExportSummary {
	const ruleConfigGroups = Object.entries(data.ruleConfig || {}).flatMap(([top, groups]: [string, any]) =>
		Object.entries(groups || {}).map(([group, rules]: [string, any]) => ({
			top,
			group,
			label: ruleGroupLabel(top, group),
			count: Object.keys(rules || {}).length,
		})),
	);
	const configuredTops: Record<string, string> = {};
	for (const [top, groups] of Object.entries(data.ruleConfig || {})) {
		for (const group of Object.keys((groups as any) || {}))
			configuredTops[group] = top;
	}
	const netRuleStat = new Map<string, { top: string; group: string; total: number; custom: number }>();
	const countNetRuleLeaf = (entry: any): void => {
		for (const [group, value] of Object.entries(entry || {})) {
			if (['type', 'name', 'sub', 'targetNet'].includes(group) || value === undefined || value === null)
				continue;
			const top = topByRuleGroup(group, configuredTops);
			const key = `${top}|${group}`;
			const item = netRuleStat.get(key) || { top, group, total: 0, custom: 0 };
			item.total += 1;
			if (value !== 'default')
				item.custom += 1;
			netRuleStat.set(key, item);
		}
	};
	for (const entry of data.netRules || [])
		countNetRuleLeaf(entry);
	const netRuleGroups = [...netRuleStat.values()]
		.map(item => ({ label: ruleGroupLabel(item.top, item.group), total: item.total, custom: item.custom }))
		;
	return {
		ruleConfigGroups,
		ruleConfigCount: ruleConfigGroups.reduce((total, item) => total + item.count, 0),
		netClassNames: (data.netClasses || []).map((cls: any) => String(cls?.name ?? '')).filter(Boolean),
		netRuleCount: (data.netRules || []).length,
		netRuleGroups,
		netByNetGroups: Object.fromEntries(
			Object.keys(data.netByNetRules || {}).map(group => [
				ruleGroupLabel(configuredTops[group], group),
				(data.netByNetRules[group] || []).length,
			]),
		),
		differentialPairCount: (data.differentialPairs || []).length,
		equalLengthGroupCount: (data.equalLengthGroups || []).length,
	};
}
