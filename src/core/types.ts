/** 交换文件格式与各模块数据模型。 */

export const ALL_MODULES = [
	'ruleConfig',
	'netRules',
	'netByNetRules',
	'netClasses',
	'differentialPairs',
	'equalLengthGroups',
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
	ruleConfig: '规则管理',
	netRules: '网络规则',
	netByNetRules: '网络-网络规则',
	netClasses: '网络类',
	differentialPairs: '差分对',
	equalLengthGroups: '等长网络组',
};

export interface NetClassEntry { name: string; nets: string[] }
export interface DiffPairEntry { name: string; positiveNet: string; negativeNet: string }
export interface EqualLengthGroupEntry { name: string; nets: string[] }
export interface NetRuleEntry { [key: string]: any }
export interface NetByNetNamedRef { type: string; name: string }

/**
 * 网络集合引用：配置文件里可以声明一组网络名（固定格式，不做表达式解析），
 * 导入时与当前 PCB 网络求交后展开为具体网络对。
 */
export interface NetByNetSetRef { type: 'set'; name?: string; nets: string[]; className?: string }
export type NetByNetNetRef = NetByNetNamedRef | NetByNetSetRef;
export interface NetByNetEntry {
	net1: NetByNetNetRef;
	net2: NetByNetNetRef;
	rule: string;
	/** 兼容 1.3.0：两侧集合共用一个网络类（新草稿改为在集合上各自声明 className） */
	netClass?: { name: string; nets: string[] };
	/** 附加草稿的单侧模式：只填一个集合，仅建类 / 写网络规则，不产生网络对 */
	single?: 'net1' | 'net2';
}
export type NetByNetRules = Record<string, NetByNetEntry[]>;

/** 规则管理配置：顶层分类 → 分组 → 规则键 → 规则内容 */
export interface RuleConfigData { [topLevel: string]: { [group: string]: { [rule: string]: any } } }

export interface ConfigSetData {
	ruleConfig?: RuleConfigData;
	netRules?: NetRuleEntry[];
	netByNetRules?: NetByNetRules;
	netClasses?: NetClassEntry[];
	differentialPairs?: DiffPairEntry[];
	equalLengthGroups?: EqualLengthGroupEntry[];
}

export interface RuleConfigSet {
	schema: string;
	schemaVersion: number;
	generator: { name: string; version: string };
	edaVersion?: string;
	exportedAt: string;
	source: { pcb?: string; unit?: string; ruleConfigName?: string };
	modules: ModuleKey[];
	data: ConfigSetData;
}

export const SCHEMA_ID = 'easyeda-eda-rule-config-set';
export const SCHEMA_VERSION = 1;

/** 网络规则条目的 type 实测有 3 种 */
export const NET_RULE_TYPES = ['net', 'netClass', 'equalLengthGroup'] as const;
