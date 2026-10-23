/**
 * 清理编辑器残留的进度遮罩。
 *
 * 真机实测（V3.2.196，证据 .probe/tools/p125-repro-progress2.js）：
 * “覆写设计规则配置”这个接口本身 8 ms 就返回 true，但约 5~7 秒后编辑器会自己
 * 弹出一条**没有标题**的底部进度条（固定停在 50%）并盖一层灰色遮罩，
 * 之后永远不消失，整块画布点不动。该进度条不是本扩展创建的
 * （eda.sys_LoadingAndProgressBar.showProgressBar 的钩子日志为空），
 * 属于编辑器内部行为，因此只能在导入结束后主动把它释放掉。
 *
 * 只清理“没有标题”的进度条，避免误伤用户自己触发的、带标题的正常任务。
 */
import { eda } from './eda';

/** 进度条容器：id 形如 progress-barwin_progress_0，编号会变，用前缀匹配。 */
function findBars(): HTMLElement[] {
	try {
		return Array.from(document.querySelectorAll<HTMLElement>('[id^="progress-barwin_progress"]'))
			.filter(el => el.offsetParent !== null || el.querySelector('[class*="progressbar-value"]'));
	}
	catch {
		return [];
	}
}

/** 带标题的进度条是别的任务在用，不动；标题为空才认为是残留。 */
function isOrphan(bar: HTMLElement): boolean {
	const title = bar.querySelector('[class^="message-p-msg"]') || bar.querySelector('[class*="message-p-msg"]');
	if (!title)
		return false;
	return String(title.textContent || '').trim() === '';
}

export interface OverlayCleanupOptions {
	rounds?: number;
	intervalMs?: number;
	onCleanup?: (count: number) => void;
}

/**
 * 在导入结束后的一段时间里反复巡检并释放残留进度条。
 * 编辑器是延迟弹出的，所以必须跨若干秒轮询，而不是写完后立刻清一次。
 */
export function scheduleOverlayCleanup(options: OverlayCleanupOptions = {}): void {
	const rounds = options.rounds ?? 18;
	const intervalMs = options.intervalMs ?? 1000;
	let left = rounds;
	let cleaned = 0;
	const tick = (): void => {
		try {
			for (const bar of findBars()) {
				if (!isOrphan(bar))
					continue;
				eda().sys_LoadingAndProgressBar.destroyProgressBar();
				cleaned += 1;
			}
		}
		catch { /* 编辑器版本差异时静默跳过 */ }
		if (cleaned > 0 && !findBars().length) {
			try {
				options.onCleanup?.(cleaned);
			}
			catch { /* 忽略回调异常 */ }
			return;
		}
		left -= 1;
		if (left > 0)
			setTimeout(tick, intervalMs);
	};
	setTimeout(tick, intervalMs);
}
