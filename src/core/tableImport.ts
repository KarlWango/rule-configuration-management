/** 附加网络集合 CSV 表格导入：模板表头 setA / setB / classA / classB / rule（大小写不敏感，列序随意）。 */
import type { PairDraft } from './pairDrafts';
import { parseNetList } from './util';

/** 一行模板数据（不含规则分组：分组由界面当前选择的 chips 决定） */
export type NetSetTableRow = Omit<PairDraft, 'group'>;

export interface TableParseResult {
	rows: NetSetTableRow[];
	errors: string[];
}

/**
 * 表格解码：优先严格 UTF-8；失败时回退 GBK（Excel 默认「CSV」保存为 ANSI 编码，
 * 用户另存为「CSV UTF-8」则是 UTF-8，两种都要能读）。
 */
export function decodeCsv(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	}
	catch {
		try {
			return new TextDecoder('gbk').decode(bytes);
		}
		catch {
			return new TextDecoder('utf-8').decode(bytes);
		}
	}
}

/** 单行 CSV 拆分：支持双引号包裹与 "" 转义；未加引号的单元格按原样读取 */
function splitCsvLine(line: string): string[] {
	const cells: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i++;
				}
				else {
					inQuotes = false;
				}
			}
			else {
				current += ch;
			}
		}
		else if (ch === '"') {
			inQuotes = true;
		}
		else if (ch === ',') {
			cells.push(current);
			current = '';
		}
		else {
			current += ch;
		}
	}
	cells.push(current);
	return cells;
}

const HEADER_KEYS = ['seta', 'setb', 'classa', 'classb', 'rule'];

export function parseNetSetTable(text: string): TableParseResult {
	const errors: string[] = [];
	const rows: NetSetTableRow[] = [];
	const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
	let header: Record<string, number> | undefined;
	let dataLine = 0;
	for (const raw of lines) {
		if (!raw.trim())
			continue;
		const cells = splitCsvLine(raw).map(cell => cell.trim());
		if (!header) {
			header = {};
			cells.forEach((name, index) => {
				const key = name.toLowerCase();
				if (HEADER_KEYS.includes(key))
					header![key] = index;
			});
			const parsedHeader = header;
			if (parsedHeader.rule === undefined || (parsedHeader.seta === undefined && parsedHeader.setb === undefined)) {
				errors.push('表头不符合模板：至少需要 setA / setB 之一与 rule 列（大小写不敏感，列序随意）');
				return { rows, errors };
			}
			continue;
		}
		dataLine++;
		const parsedHeader = header;
		const cell = (key: string): string => (parsedHeader[key] === undefined ? '' : cells[parsedHeader[key]] || '');
		const aNets = parseNetList(cell('seta'));
		const bNets = parseNetList(cell('setb'));
		const rule = cell('rule');
		if (!aNets.length && !bNets.length) {
			errors.push(`第 ${dataLine} 行：集合A / 集合B 至少一个需要填写网络名`);
			continue;
		}
		if (!rule) {
			errors.push(`第 ${dataLine} 行：规则列（rule）为空`);
			continue;
		}
		rows.push({ rule, aNets, bNets, aClass: cell('classa') || undefined, bClass: cell('classb') || undefined });
	}
	if (!header)
		errors.push('表格内容为空');
	return { rows, errors };
}
