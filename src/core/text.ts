/**
 * 文案层：扩展侧（toast / 日志 / 对话框 / 忙碌提示）的多语言输出。
 *
 * 优先级：平台多语言（locales/<lang>.json，经 SYS_I18n.text 读取）→ 内置表 → 标签本身。
 * 内置表与 locales 内容保持一致，这样即使平台未加载语言包也能正常显示。
 */
import type { LangTag } from './settings';
import extensionConfig from '../../extension.json' with { type: 'json' };
import { eda } from './eda';

type Pair = Record<LangTag, string>;

// 平台多语言占位符是 ${1} 形式，不是模板字符串，该规则在此为误报
/* eslint-disable no-template-curly-in-string */
const RESIDUAL_TEMPLATE: Pair = {
	'zh-Hans': '剩余差异：新增 ${1} / 修改 ${2} / 删除 ${3} / 保留 ${4} / 跳过 ${5} / 不支持 ${6}',
	'en': 'Remaining differences: added ${1} / modified ${2} / removed ${3} / kept ${4} / skipped ${5} / unsupported ${6}',
};
/* eslint-enable no-template-curly-in-string */

// 新增的网络对规则文案沿用 ${1} 占位符，与平台多语言格式一致
/* eslint-disable no-template-curly-in-string */
const TABLE: Record<string, Pair> = {
	'window.title': { 'zh-Hans': '规则配置管理', 'en': 'Rule Configuration Manager' },
	'window.title.export': { 'zh-Hans': '导出设计规则配置', 'en': 'Export Design Rule Configuration' },
	'window.title.import': { 'zh-Hans': '导入设计规则配置', 'en': 'Import Design Rule Configuration' },
	'window.title.netpair': { 'zh-Hans': '网络集合规则', 'en': 'Net-set Rules' },
	'busy.pickFile': { 'zh-Hans': '请在弹出的窗口中选择配置文件…', 'en': 'Choose a configuration file in the dialog…' },
	'busy.compare': { 'zh-Hans': '正在比对当前 PCB 与配置文件…', 'en': 'Comparing the current PCB with the configuration file…' },
	'busy.export': { 'zh-Hans': '正在读取当前 PCB 规则…', 'en': 'Reading the current PCB rules…' },
	'busy.write': { 'zh-Hans': '正在写入规则，请勿操作…', 'en': 'Writing rules, please wait…' },
	'toast.noWindow': { 'zh-Hans': '无法打开规则配置管理窗口', 'en': 'Unable to open the Rule Configuration window' },
	'toast.overlayCleared': { 'zh-Hans': '已释放编辑器残留的进度遮罩，界面可以正常操作了', 'en': 'Released the editor leftover progress overlay; the UI is usable again' },
	'toast.restored': { 'zh-Hans': '已还原到导入前的状态', 'en': 'Rolled back to the state before import' },
	'error.openDialog': { 'zh-Hans': '打开文件选择窗口失败：', 'en': 'Failed to open the file picker: ' },
	'error.readFile': { 'zh-Hans': '读取文件失败：', 'en': 'Failed to read the file: ' },
	'error.diff': { 'zh-Hans': '差异比对失败：', 'en': 'Diff failed: ' },
	'error.import': { 'zh-Hans': '导入失败：', 'en': 'Import failed: ' },
	'error.export': { 'zh-Hans': '导出失败：', 'en': 'Export failed: ' },
	'log.importHeader': { 'zh-Hans': '规则配置导入日志', 'en': 'Rule configuration import log' },
	'log.exportHeader': { 'zh-Hans': '规则配置导出日志', 'en': 'Rule configuration export log' },
	'log.file': { 'zh-Hans': '配置文件：', 'en': 'Configuration file: ' },
	'log.result': { 'zh-Hans': '导出文件：', 'en': 'Exported file: ' },
	'log.modules': { 'zh-Hans': '模块：', 'en': 'Modules: ' },
	'log.ok': { 'zh-Hans': '成功', 'en': 'OK' },
	'log.fail': { 'zh-Hans': '失败', 'en': 'failed' },
	'log.residual': RESIDUAL_TEMPLATE,
	'log.hint': { 'zh-Hans': '提示：', 'en': 'Note: ' },
	'log.restore': { 'zh-Hans': '还原：', 'en': 'Rollback: ' },
	'log.restored': { 'zh-Hans': '已按导入前的快照还原', 'en': 'Restored from the pre-import snapshot' },
	'module.netByNetRules': { 'zh-Hans': '网络-网络规则', 'en': 'Net-to-net rules' },
	'log.netpairHeader': { 'zh-Hans': '网络集合规则写入日志', 'en': 'Net-set rule write log' },
	'log.netpairGroup': { 'zh-Hans': '分组：${1}', 'en': 'Group: ${1}' },
	'log.netpairRule': { 'zh-Hans': '规则名：${1}', 'en': 'Rule: ${1}' },
	'log.netpairSets': { 'zh-Hans': '集合A ${1} 个网络（缺失 ${2}） / 集合B ${3} 个网络（缺失 ${4}）', 'en': 'Set A ${1} nets (missing ${2}) / Set B ${3} nets (missing ${4})' },
	'log.netpairExpand': { 'zh-Hans': '展开 ${1} × ${2} = ${3} 对，新增 ${4} 条（重复跳过 ${5}，缺失网络 ${6} 个）', 'en': 'Expanded ${1} × ${2} = ${3} pairs; added ${4} (duplicates skipped ${5}, missing nets ${6})' },
	'netpair.error.noGroup': { 'zh-Hans': '当前 PCB 没有可用的网络-网络规则分组', 'en': 'No net-to-net rule group is available on this PCB' },
	'netpair.error.noRule': { 'zh-Hans': '请从所选分组中选择规则（该分组必须已有规则）', 'en': 'Pick a rule from the selected group (the group must already have rules)' },
	'netpair.error.emptySet': { 'zh-Hans': '集合为空：请至少为一个集合填写网络名（当前 PCB 上没有任何匹配的网络）', 'en': 'Empty sets: enter nets in at least one set (no matching net exists on this PCB)' },
	'netpair.error.verify': { 'zh-Hans': '回读校验未通过：部分网络对没有被编辑器接受', 'en': 'Verification failed: some pairs were not accepted by the editor' },
	'netpair.missing': { 'zh-Hans': '以下网络在当前 PCB 不存在，已跳过：${1}', 'en': 'These nets do not exist on this PCB and were skipped: ${1}' },
	'netpair.toast.done': { 'zh-Hans': '网络集合规则已写入', 'en': 'Net-set rules written' },
	'netpair.toast.verifyFailed': { 'zh-Hans': '网络集合规则写入后校验未通过，请查看日志', 'en': 'Verification failed after writing; see the log' },
	'about.title': { 'zh-Hans': '关于', 'en': 'About' },
};
/* eslint-enable no-template-curly-in-string */

export const EXT_TEXT_TAGS = Object.keys(TABLE);

/** 内置回退（平台文案不可用时使用） */
export function fallbackText(tag: string, lang: LangTag, args: any[] = []): string {
	const pair = TABLE[tag];
	if (!pair)
		return tag;
	return format(pair[lang] ?? pair['zh-Hans'], args);
}

function format(text: string, args: any[]): string {
	return text.replace(/\$\{(\d+)\}/g, (_, index) => {
		const value = args[Number(index) - 1];
		return value === undefined ? '' : String(value);
	});
}

/** 输出文案；lang 为 undefined 时跟随编辑器当前语言 */
export function text(tag: string, lang?: LangTag, args: any[] = []): string {
	try {
		// 显式传本扩展 UUID 作为命名空间：脚本 / 调试通道等上下文的默认命名空间
		// 不是本扩展，不传命名空间就取不到 locales/ 里的词条。language 传 undefined
		// 表示「跟随编辑器当前语言」。
		const value = (eda() as any).sys_I18n?.text?.(tag, extensionConfig.uuid, lang, ...args);
		if (typeof value === 'string' && value && value !== tag)
			return value;
	}
	catch { /* 平台不可用时退回内置表 */ }
	return fallbackText(tag, lang ?? 'zh-Hans', args);
}
