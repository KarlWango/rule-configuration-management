/** 通用比较与归一化工具（含单位换算与数值容差）。 */

export const MM_PER_MIL = 0.0254;

/** 内置数值容差：5e-5 mm ≈ 0.05 µm，足以吸收 mil / 4 位小数的存储误差 */
export const BASE_TOLERANCE_MM = 5e-5;

/** 不参与比较的元字段（V4 导出新增，V3.2 回读不存在） */
export const META_KEYS = new Set([
	'isRule',
	'categorayKey',
	'redStar',
	'copperRuleName',
	'planeRuleName',
]);

/** 集合输入解析：支持 / , ， ; ； 与空白符分隔（固定格式，不做表达式解析） */
export function parseNetList(raw: string): string[] {
	return String(raw || '')
		.split(/[/,，;；\s]+/)
		.map(item => item.trim())
		.filter(item => item.length > 0);
}

export function clone<T>(value: T): T {
	return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export function toMm(value: number, unit?: string): number {
	return unit === 'mil' ? value * MM_PER_MIL : value;
}

export function numbersClose(left: number, right: number, unit?: string): boolean {
	if (!Number.isFinite(left) || !Number.isFinite(right))
		return left === right;
	const a = toMm(left, unit);
	const b = toMm(right, unit);
	if (a === b)
		return true;
	// 浮点往返噪声（如 0.1759966 存储后回读成 0.17599659999999998）：
	// 12 位有效数字内相等即视为同一个值，不受「严格容差 = 0」影响
	if (Number(a.toPrecision(12)) === Number(b.toPrecision(12)))
		return true;
	const diff = Math.abs(a - b);
	if (diff <= BASE_TOLERANCE_MM)
		return true;
	const magnitude = Math.max(Math.abs(a), Math.abs(b));
	return magnitude > 1 && diff / magnitude <= 1e-6;
}

export function isPlainObject(value: any): boolean {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export interface FieldDiff { path: string; left: any; right: any }

/** 逐字段比较（数值带容差），返回差异列表；left=目标值，right=当前值 */
export function compareValues(path: string, left: any, right: any, unit: string | undefined, out: FieldDiff[]): void {
	if (META_KEYS.has(path.split('.').pop() || ''))
		return;
	if (isPlainObject(left) && isPlainObject(right)) {
		const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
		for (const key of keys) {
			if (META_KEYS.has(key))
				continue;
			compareValues(path ? `${path}.${key}` : key, left[key], right[key], unit, out);
		}
		return;
	}
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) {
			out.push({ path: `${path}.length`, left: left.length, right: right.length });
			return;
		}
		for (let i = 0; i < left.length; i++) compareValues(`${path}[${i}]`, left[i], right[i], unit, out);
		return;
	}
	if (typeof left === 'number' && typeof right === 'number') {
		if (!numbersClose(left, right, unit))
			out.push({ path, left, right });
		return;
	}
	if (left !== right)
		out.push({ path, left, right });
}

/** 剔除元字段后做严格结构比较 */
export function stripMeta<T>(value: T): T {
	if (Array.isArray(value))
		return value.map(item => stripMeta(item)) as unknown as T;
	if (isPlainObject(value)) {
		const out: Record<string, any> = {};
		for (const [key, item] of Object.entries(value as Record<string, any>)) {
			if (META_KEYS.has(key))
				continue;
			out[key] = stripMeta(item);
		}
		return out as T;
	}
	return value;
}

export function shortValue(value: any, max = 64): string {
	let text: string;
	try {
		text = typeof value === 'string' ? value : JSON.stringify(value);
	}
	catch {
		text = String(value);
	}
	if (text === undefined)
		text = 'undefined';
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function nowIso(): string {
	return new Date().toISOString();
}

/** 规则条目单位：优先取条目自带 unit */
export function ruleUnit(item: any): string | undefined {
	if (isPlainObject(item) && typeof item.unit === 'string')
		return item.unit;
	return undefined;
}

/** 从规则配置中探测 PCB 当前单位（用于文件元信息） */
export function detectUnit(config: any): string | undefined {
	if (!isPlainObject(config))
		return undefined;
	for (const top of Object.keys(config)) {
		for (const group of Object.keys(config[top] || {})) {
			for (const rule of Object.keys(config[top][group] || {})) {
				const unit = ruleUnit(config[top][group][rule]);
				if (unit)
					return unit;
			}
		}
	}
	return undefined;
}
