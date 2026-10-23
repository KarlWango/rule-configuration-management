import type { ConfigSetData, ModuleKey, RuleConfigSet } from './types';
/** 采集：从当前 PCB 读取各模块状态。 */
import { drc } from './eda';
import { ALL_MODULES, SCHEMA_ID, SCHEMA_VERSION } from './types';
import { clone, detectUnit, nowIso } from './util';

export interface CollectResult {
	data: ConfigSetData;
	errors: Record<string, string>;
	ruleConfigName?: string;
	unit?: string;
	collectedAt: string;
}

async function safe<T>(key: string, errors: Record<string, string>, fn: () => Promise<T>): Promise<T | undefined> {
	try {
		return await fn();
	}
	catch (e: any) {
		errors[key] = String(e?.message || e);
		return undefined;
	}
}

export async function collectModules(modules: ModuleKey[] = [...ALL_MODULES]): Promise<CollectResult> {
	const errors: Record<string, string> = {};
	const data: ConfigSetData = {};
	const api = drc();

	if (modules.includes('ruleConfig')) {
		const cur: any = await safe('ruleConfig', errors, () => api.getCurrentRuleConfiguration());
		if (cur)
			data.ruleConfig = clone(cur.config ?? cur);
	}
	if (modules.includes('netRules')) {
		const value = await safe('netRules', errors, () => api.getNetRules());
		if (value)
			data.netRules = clone(value as any[]);
	}
	if (modules.includes('netByNetRules')) {
		const value = await safe('netByNetRules', errors, () => api.getNetByNetRules());
		if (value)
			data.netByNetRules = clone(value as any);
	}
	if (modules.includes('netClasses')) {
		const value = await safe('netClasses', errors, () => api.getAllNetClasses());
		if (value)
			data.netClasses = (value as any[]).map(c => ({ name: c.name, nets: clone(c.nets || []) }));
	}
	if (modules.includes('differentialPairs')) {
		const value = await safe('differentialPairs', errors, () => api.getAllDifferentialPairs());
		if (value) {
			data.differentialPairs = (value as any[]).map(p => ({ name: p.name, positiveNet: p.positiveNet, negativeNet: p.negativeNet }));
		}
	}
	if (modules.includes('equalLengthGroups')) {
		const value = await safe('equalLengthGroups', errors, () => api.getAllEqualLengthNetGroups());
		if (value)
			data.equalLengthGroups = (value as any[]).map(g => ({ name: g.name, nets: clone(g.nets || []) }));
	}

	const ruleConfigName = await safe('ruleConfigName', errors, () => api.getCurrentRuleConfigurationName());
	return {
		data,
		errors,
		ruleConfigName: (ruleConfigName as any) ?? undefined,
		unit: detectUnit(data.ruleConfig),
		collectedAt: nowIso(),
	};
}

export interface BuildMeta {
	pcbName?: string;
	edaVersion?: string;
	generator?: { name: string; version: string };
}

export function buildConfigSet(collected: CollectResult, modules: ModuleKey[], meta: BuildMeta = {}): RuleConfigSet {
	const data: ConfigSetData = {};
	for (const key of modules) {
		const value = (collected.data as any)[key];
		if (value !== undefined)
			(data as any)[key] = clone(value);
	}
	return {
		schema: SCHEMA_ID,
		schemaVersion: SCHEMA_VERSION,
		generator: meta.generator || { name: 'rule-configuration-management', version: '1.0.0' },
		edaVersion: meta.edaVersion,
		exportedAt: nowIso(),
		source: { pcb: meta.pcbName, unit: collected.unit, ruleConfigName: collected.ruleConfigName },
		modules: [...modules],
		data,
	};
}
