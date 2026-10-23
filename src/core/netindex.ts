/** 网络名匹配：大小写不敏感，并映射回 PCB 上的真实网络名。 */
import { netApi } from './eda';

export interface NetIndex {
	names: string[];
	has: (name: string) => boolean;
	real: (name: string) => string | undefined;
}

export async function buildNetIndex(): Promise<NetIndex> {
	let names: string[] = [];
	try {
		names = (await netApi().getAllNetsName()) || [];
	}
	catch {
		try {
			names = (await netApi().getAllNetName()) || [];
		}
		catch {
			names = [];
		}
	}
	const map = new Map<string, string>();
	for (const name of names) map.set(String(name).toLowerCase(), String(name));
	return {
		names,
		has: (name: string) => map.has(String(name).toLowerCase()),
		real: (name: string) => map.get(String(name).toLowerCase()),
	};
}

/** 过滤网络列表：返回可用的真实网络名与缺失网络名 */
export function filterNets(nets: string[] | undefined, index: NetIndex): { kept: string[]; missing: string[] } {
	const kept: string[] = [];
	const missing: string[] = [];
	for (const name of nets || []) {
		const real = index.real(name);
		if (real === undefined)
			missing.push(name);
		else if (!kept.includes(real))
			kept.push(real);
	}
	return { kept, missing };
}
