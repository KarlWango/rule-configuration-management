import { applyPlan } from '../core/apply';
import { Channel } from '../core/bridge';
import { collectModules } from '../core/collect';
import { diffPlan } from '../core/diff';
/** 开发用探针入口：把内核挂到全局，供 API 网关（桥接）直接驱动。 */
import { setEdaApi } from '../core/eda';
import { parseConfigSet, runExport, runImport } from '../core/engine';
import { buildNetIndex } from '../core/netindex';
import { scheduleOverlayCleanup } from '../core/overlay';
import { appendPairDrafts, buildExportSummary } from '../core/pairDrafts';
import { buildPlan } from '../core/plan';
import { runSelfTest } from '../core/selfTest';
import { clearSettings, loadSettings, peekSettings, saveSettings } from '../core/settings';
import { decodeCsv, parseNetSetTable } from '../core/tableImport';
import { fallbackText, text } from '../core/text';
import { Wizard } from '../flow';

(globalThis as any).__rcm = {
	setEdaApi,
	buildNetIndex,
	collectModules,
	runExport,
	runImport,
	appendPairDrafts,
	buildExportSummary,
	parseConfigSet,
	buildPlan,
	diffPlan,
	applyPlan,
	runSelfTest,
	scheduleOverlayCleanup,
	loadSettings,
	saveSettings,
	clearSettings,
	peekSettings,
	text,
	fallbackText,
	decodeCsv,
	parseNetSetTable,
	Wizard,
	Channel,
	version: '0.1.0-dev',
};
