/**
 * 扩展设置项：通过 eda.sys_Storage 的用户配置持久化（跨会话保留）。
 *
 * sys_Storage 只在扩展运行时可用，且不同版本容量/行为有差异，
 * 因此这里做「内存兜底」：任何一步失败都不抛错，只退回默认值，
 * 保证设置读写永远不会打断导入 / 导出主流程。
 */
import { eda } from './eda';

export type LangTag = 'zh-Hans' | 'en';
export type UiLanguage = 'auto' | LangTag;

export interface Settings {
	/** 上次导出勾选的模块（按模块 key 记录）；null = 还没记录过 */
	lastExportModules: string[] | null;
	/** 界面语言：auto 跟随编辑器 */
	uiLanguage: UiLanguage;
}

export const DEFAULT_SETTINGS: Settings = {
	lastExportModules: null,
	uiLanguage: 'auto',
};

/** 存储键：单键存整个对象，避免平台对多键写入的兼容差异 */
const STORAGE_KEY = 'settings';

let cache: Settings | undefined;
let writable = true;

function storage(): any {
	return (eda() as any).sys_Storage;
}

function normalize(raw: any): Settings {
	const out: Settings = { ...DEFAULT_SETTINGS };
	if (!raw || typeof raw !== 'object')
		return out;
	if (Array.isArray(raw.lastExportModules))
		out.lastExportModules = raw.lastExportModules.map((key: any) => String(key));
	else if (raw.lastExportModules === null)
		out.lastExportModules = null;
	if (raw.uiLanguage === 'zh-Hans' || raw.uiLanguage === 'en' || raw.uiLanguage === 'auto')
		out.uiLanguage = raw.uiLanguage;
	return out;
}

/** 读取设置（带内存缓存；平台不可用时返回默认值） */
export function loadSettings(): Settings {
	if (cache)
		return cache;
	try {
		const raw = storage()?.getExtensionUserConfig?.(STORAGE_KEY);
		cache = normalize(raw);
	}
	catch {
		writable = false;
		cache = { ...DEFAULT_SETTINGS };
	}
	return cache;
}

/** 合并写入设置；返回是否写盘成功（失败也不抛错） */
export async function saveSettings(patch: Partial<Settings>): Promise<boolean> {
	const next = { ...loadSettings(), ...patch };
	cache = normalize(next);
	if (!writable)
		return false;
	try {
		const result = await storage().setExtensionUserConfig(STORAGE_KEY, cache);
		return result !== false;
	}
	catch {
		writable = false;
		return false;
	}
}

/** 清除全部扩展设置（恢复默认） */
export async function clearSettings(): Promise<boolean> {
	cache = { ...DEFAULT_SETTINGS };
	if (!writable)
		return false;
	try {
		return (await storage().deleteExtensionUserConfig(STORAGE_KEY)) !== false;
	}
	catch {
		return false;
	}
}

/** 供探针 / 自检使用：当前缓存快照 */
export function peekSettings(): Settings {
	return { ...loadSettings() };
}
