/**
 * EDA API 访问器。
 *
 * 注意：`eda` 在运行上下文中是词法全局变量，不一定是 `globalThis` 的属性，
 * 因此按「显式注入 → globalThis 属性 → 间接 eval」三级解析。
 */
let injected: any;

export function setEdaApi(instance: any): void {
	injected = instance;
}

function resolveEda(): any {
	if (injected)
		return injected;
	const g = globalThis as any;
	if (g.eda) {
		injected = g.eda;
		return injected;
	}
	try {
		// 第三级兜底：`eda` 在本运行环境里是词法全局变量，不是 globalThis 的属性，
		// 只能通过间接 eval 才能在严格模式下读到它。这是该环境唯一的可行手段。
		// eslint-disable-next-line no-eval
		const found = (0, eval)('typeof eda === "undefined" ? undefined : eda');
		if (found) {
			injected = found;
			return injected;
		}
	}
	catch { /* 忽略解析失败 */ }
	return undefined;
}

export function eda(): any {
	const found = resolveEda();
	if (!found)
		throw new Error('EDA API 不可用：本代码必须在嘉立创EDA扩展运行时中执行');
	return found;
}

export const drc = (): any => eda().pcb_Drc;
export const netApi = (): any => eda().pcb_Net;
export const fileSystem = (): any => eda().sys_FileSystem;
export const messageBox = (): any => eda().sys_MessageBox;
export const dialog = (): any => eda().sys_Dialog;

export function toast(message: string): void {
	try {
		eda().sys_ToastMessage.showMessage(message);
	}
	catch { /* 忽略提示失败 */ }
}

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
