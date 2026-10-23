import type { ModuleKey, RuleConfigSet } from './types';
import type { FieldDiff } from './util';
import { collectModules } from './collect';
import { runExport, runImport } from './engine';
import { ALL_MODULES } from './types';
/**
 * M2 自检：导出 → 幂等导入 → 变异导入 → 回滚还原，全流程在真实 PCB 上验证。
 * 结果会写入同源 localStorage 键 `rcm:selftest`，便于外部读取。
 */
import { clone, compareValues, nowIso } from './util';

const RESULT_KEY = 'rcm:selftest';

export interface SelfTestReport {
	startedAt: string;
	finishedAt?: string;
	steps: { name: string; ok: boolean; detail?: any; error?: string }[];
	[key: string]: any;
}

function mutate(file: RuleConfigSet): RuleConfigSet {
	const out = clone(file);
	const cfg = out.data.ruleConfig;
	if (cfg?.Spacing?.['Safe Spacing']?.copperThickness1oz) {
		const rule = cfg.Spacing['Safe Spacing'].copperThickness1oz;
		if (rule.tables?.['1']?.content?.[0])
			rule.tables['1'].content[0][0] += 0.1;
	}
	const netRules = out.data.netRules || [];
	const txp = netRules.find(entry => entry.type === 'net' && String(entry.name).toLowerCase() === 'tx_p');
	if (txp)
		txp.Track = 'copperThickness2oz';

	out.data.netClasses = [
		...(out.data.netClasses || []),
		{ name: 'SELFTEST_CLS', nets: ['gnd', 'vcc_3v3'] },
	];
	out.data.differentialPairs = [
		...(out.data.differentialPairs || []),
		{ name: 'SELFTEST_DP', positiveNet: 'tx_p', negativeNet: 'tx_n' },
	];
	out.data.equalLengthGroups = [
		...(out.data.equalLengthGroups || []),
		{ name: 'SELFTEST_ELG', nets: ['rx_p', 'rx_n'] },
	];
	const nbn = out.data.netByNetRules || (out.data.netByNetRules = {});
	nbn['Safe Spacing'] = [
		...(nbn['Safe Spacing'] || []),
		{ net1: { type: 'net', name: 'vcc_3v3' }, net2: { type: 'net', name: 'tx_p' }, rule: 'copperThickness1oz' },
	];
	return out;
}

async function verifyMutations(): Promise<{ ok: boolean; checks: Record<string, any> }> {
	const collected = await collectModules([...ALL_MODULES]);
	const checks: Record<string, any> = {};
	const cls = (collected.data.netClasses || []).find(c => c.name === 'SELFTEST_CLS');
	checks.netClass = cls ? cls.nets : null;
	const pair = (collected.data.differentialPairs || []).find(p => p.name === 'SELFTEST_DP');
	checks.diffPair = pair ? `${pair.positiveNet}/${pair.negativeNet}` : null;
	const group = (collected.data.equalLengthGroups || []).find(g => g.name === 'SELFTEST_ELG');
	checks.equalLengthGroup = group ? group.nets : null;
	const nbn = (collected.data.netByNetRules || {})['Safe Spacing'] || [];
	checks.netByNetCount = nbn.length;
	const txp = (collected.data.netRules || []).find(entry => entry.type === 'net' && String(entry.name).toLowerCase() === 'tx_p');
	checks.txPTrack = txp?.Track ?? null;
	const ok = !!cls && !!pair && !!group && nbn.length === 2 && checks.txPTrack === 'copperThickness2oz';
	return { ok, checks };
}

function diffAgainstSnapshot(snapshot: RuleConfigSet, currentModuleData: any): FieldDiff[] {
	const diffs: FieldDiff[] = [];
	const target = snapshot.data;
	const modules = snapshot.modules as ModuleKey[];
	for (const module of modules) {
		const local: FieldDiff[] = [];
		compareValues('', (target as any)[module], (currentModuleData as any)[module], undefined, local);
		for (const item of local) diffs.push({ ...item, path: `${module}.${item.path}` });
	}
	return diffs;
}

export async function runSelfTest(): Promise<SelfTestReport> {
	const report: SelfTestReport = { startedAt: nowIso(), steps: [] };
	let snapshot: RuleConfigSet | undefined;
	const step = (name: string, ok: boolean, detail?: any, error?: string): void => {
		report.steps.push({ name, ok, detail, error });
	};
	try {
		const exported = await runExport();
		snapshot = exported.file;
		step('export', true, {
			modules: snapshot.modules,
			ruleConfigGroups: Object.keys(snapshot.data.ruleConfig || {}).map(top => `${top}:${Object.keys(snapshot!.data.ruleConfig![top]).length}`),
			netRules: snapshot.data.netRules?.length ?? 0,
			netClasses: snapshot.data.netClasses?.length ?? 0,
			differentialPairs: snapshot.data.differentialPairs?.length ?? 0,
			equalLengthGroups: snapshot.data.equalLengthGroups?.length ?? 0,
			netByNet: Object.keys(snapshot.data.netByNetRules || {}),
			unit: snapshot.source.unit,
		});
		report.snapshotSize = JSON.stringify(snapshot).length;

		// A. 幂等：用刚导出的文件导入自身
		const roundTrip = await runImport(snapshot, [...ALL_MODULES]);
		report.roundTrip = { diff: roundTrip.diff.summary, residual: roundTrip.residual?.summary, applied: roundTrip.applied?.ok, failedStep: roundTrip.applied?.failed };
		report.roundTripEntries = roundTrip.diff.entries.slice(0, 60);
		step('idempotent-import', roundTrip.applied?.ok === true && (roundTrip.residual?.summary.added ?? 1) === 0
		&& (roundTrip.residual?.summary.modified ?? 1) === 0 && (roundTrip.residual?.summary.removed ?? 1) === 0, {
			diff: roundTrip.diff.summary,
			residual: roundTrip.residual?.summary,
		});

		// B. 变异导入
		const mutated = mutate(snapshot);
		const mutant = await runImport(mutated, [...ALL_MODULES]);
		const verified = await verifyMutations();
		report.mutated = { diff: mutant.diff.summary, residual: mutant.residual?.summary, applied: mutant.applied?.ok, failedStep: mutant.applied?.failed, checks: verified.checks };
		report.mutatedSteps = mutant.applied?.steps?.map(s => ({ name: s.name, ok: s.ok, verified: s.verified, error: s.error }));
		step('mutated-import', mutant.applied?.ok === true && verified.ok, verified.checks);
	}
	catch (e: any) {
		step('run', false, undefined, String(e?.message || e));
	}
	finally {
		if (snapshot) {
			try {
				const restore = await runImport(snapshot, [...ALL_MODULES]);
				const after = await collectModules([...ALL_MODULES]);
				const diffs = diffAgainstSnapshot(snapshot, after.data);
				report.restore = {
					applied: restore.applied?.ok,
					residual: restore.residual?.summary,
					diffCount: diffs.length,
					diffSample: diffs.slice(0, 20),
				};
				step('rollback', restore.applied?.ok === true && diffs.length === 0, report.restore);
			}
			catch (e: any) {
				step('rollback', false, undefined, String(e?.message || e));
			}
		}
	}
	report.finishedAt = nowIso();
	report.ok = report.steps.every(item => item.ok);
	try {
		(globalThis as any).localStorage?.setItem(RESULT_KEY, JSON.stringify(report));
	}
	catch { /* 忽略持久化失败 */ }
	return report;
}
