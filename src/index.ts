/**
 * 规则配置管理 · 扩展入口。
 *
 * UI 走内联框架（IFrame）+ localStorage 通道，见 src/flow.ts 与 src/core/bridge.ts。
 * 注意：`eda` 在本运行环境中是词法全局变量（不是 globalThis 的属性），
 * 因此这里显式注入给内核的访问器，内核层不直接依赖全局解析。
 */
import extensionConfig from '../extension.json' with { type: 'json' };
import { setEdaApi } from './core/eda';
import { Wizard } from './flow';

let wizard: Wizard | undefined;

function ensureWizard(): Wizard {
	// 惰性初始化：不依赖 activate 一定被调用
	if (!wizard) {
		setEdaApi(eda);
		wizard = new Wizard();
	}
	return wizard;
}

export function activate(): void {
	ensureWizard();
}

/** 菜单：导入设计规则配置 */
export async function importRuleConfig(): Promise<void> {
	await ensureWizard().open('import');
}

/** 菜单：导出设计规则配置 */
export async function exportRuleConfig(): Promise<void> {
	await ensureWizard().open('export');
}

/** 菜单：网络集合规则（集合输入框，写入网络-网络规则 / 网络类 / 网络规则） */
export async function netPairRules(): Promise<void> {
	await ensureWizard().open('netpair');
}

/** 菜单：关于 */
export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		`${extensionConfig.displayName} v${extensionConfig.version}\n${extensionConfig.description ?? ''}`,
		'关于',
	);
}
