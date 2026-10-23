/**
 * 主线程 ↔ 内联框架（IFrame）的通信通道。
 *
 * 实测（P-17）：IFrame 以 blob: 载入，与编辑器同源，可直接共享 localStorage。
 * 因此用 localStorage 做 RPC：
 *   主线程 → UI ：写 `rcm:host`（信封 `{ seq, state }`，seq 单调递增）
 *   UI → 主线程：写 `rcm:ui`（指令，单调递增 id）
 * storage 事件只在对侧触发且 blob IFrame 下不保证送达，故另加轮询兜底。
 */

export const HOST_KEY = 'rcm:host';
export const UI_KEY = 'rcm:ui';
const POLL_MS = 200;

export interface UiCommand {
	id: number;
	type: string;
	payload?: any;
	/** 发送方的归属令牌：只有持有当前 IFrame 的实例才处理指令，防止残留实例重复执行 */
	owner?: string;
}

function store(): Storage | undefined {
	try {
		return (globalThis as any).localStorage as Storage | undefined;
	}
	catch {
		return undefined;
	}
}

export class Channel {
	private seq = 0;
	private lastCommandId = 0;
	private timer?: ReturnType<typeof setInterval>;
	private listener?: (ev: any) => void;
	private readonly owner = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	private pendingHandshake?: string;

	constructor(private readonly onCommand: (command: UiCommand) => void) {}

	start(): void {
		const g = globalThis as any;
		if (typeof g.addEventListener === 'function') {
			this.listener = (ev: any) => {
				if (ev?.key === UI_KEY)
					this.drain();
			};
			g.addEventListener('storage', this.listener);
		}
		this.timer = setInterval(() => this.drain(), POLL_MS);
		this.drain();
	}

	stop(): void {
		const g = globalThis as any;
		if (this.timer !== undefined)
			clearInterval(this.timer);
		this.timer = undefined;
		if (this.listener && typeof g.removeEventListener === 'function')
			g.removeEventListener('storage', this.listener);
		this.listener = undefined;
	}

	/** 清空两侧信箱：每次打开窗口都从干净状态开始 */
	reset(): void {
		const s = store();
		try {
			s?.removeItem(HOST_KEY);
			s?.removeItem(UI_KEY);
		}
		catch { /* 忽略 */ }
		this.seq = 0;
		this.lastCommandId = 0;
	}

	private drain(): void {
		const s = store();
		if (!s)
			return;
		let raw: string | null = null;
		try {
			raw = s.getItem(UI_KEY);
		}
		catch {
			return;
		}
		if (!raw)
			return;
		let command: UiCommand;
		try {
			command = JSON.parse(raw);
		}
		catch {
			return;
		}
		if (!command || typeof command.id !== 'number' || command.id <= this.lastCommandId)
			return;
		// ready 是首次握手（UI 还没拿到 owner）；其余指令必须来自当前持有的 IFrame
		if (command.type !== 'ready' && command.owner !== this.owner)
			return;
		this.lastCommandId = command.id;
		try {
			this.onCommand(command);
		}
		catch { /* 忽略单条指令异常，避免打断轮询 */ }
	}

	/**
	 * 发布界面状态。
	 * 必须用 `{ seq, state }` 信封：界面侧按 `msg.state` 取状态、
	 * 按外层 `msg.seq` 去重（P-21 回归：早期直接写裸状态对象，界面收到空状态）。
	 */
	publish(state: Record<string, any>): void {
		this.seq += 1;
		const handshake = this.pendingHandshake;
		this.pendingHandshake = undefined;
		try {
			store()?.setItem(HOST_KEY, JSON.stringify({ seq: this.seq, state, owner: this.owner, handshake }));
		}
		catch { /* 忽略 */ }
	}

	/** UI 的 ready 携带随机 nonce：下一次 publish 带回该 nonce，UI 据此认主 */
	claim(nonce?: string): void {
		this.pendingHandshake = typeof nonce === 'string' && nonce ? nonce : undefined;
	}
}
