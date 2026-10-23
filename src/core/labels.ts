/** 导出摘要用的内置规则分类中文名；遇到平台新增名称时回退显示原始键。 */
const RULE_TOP_LABELS: Record<string, string> = {
	'Spacing': '间距',
	'Physics': '物理',
	'Plane': '平面',
	'Expansion': '扩展',
	'Copper Analysis': '铜皮分析',
	'Drill Hole Analysis': '钻孔分析',
	'Silkscreen Analysis': '丝印分析',
	'Solder Mask Analysis': '阻焊分析',
};

const RULE_GROUP_LABELS: Record<string, string> = {
	'Safe Spacing': '安全间距',
	'Other Spacing': '其他间距',
	'Creepage Distance': '爬电距离',
	'Copper Safe Spacing': '铜皮安全间距',
	'Plane Safe Spacing': '平面安全间距',
	'Track': '导线',
	'Net Length Range': '网络长度范围',
	'Net Length Tolerance': '网络长度容差',
	'Differential Pair': '差分对',
	'Blind/Buried Via': '盲埋孔',
	'Via Size': '过孔大小',
	'Height': '高度',
	'Plane Zone': '内电层',
	'Copper Zone': '铺铜',
	'Solder Mask Expansion': '阻焊扩展',
	'Paste Mask Expansion': '钢网扩展',
	'Acute Angle': '锐角',
	'Hole Falls on Pad': '孔落在焊盘上',
	'Bare Track Ends': '裸露走线末端',
	'Pad Hole Ring': '焊盘孔环',
	'Track Neckdown': '走线颈缩',
	'Short Circuit Prompt': '短路提示',
	'Minimum Copper Width': '最小铜宽',
	'No Connected Vias': '未连接过孔',
	'Hole Size': '孔径',
	'NPTH to Copper': 'NPTH到铜',
	'Silkscreen to Pad': '丝印到焊盘',
	'Silkscreen to Hole': '丝印到孔',
	'Silkscreen Line Width': '丝印线宽',
	'Solder Mask Bridge': '阻焊桥',
	'SMask Opening Copper': '阻焊开窗铜皮',
	'Pad Negative Opening': '焊盘负片开窗',
};

/** 网络规则字段里存在、但当前规则配置未列出的分组归属。 */
const RULE_GROUP_TOPS: Record<string, string> = {
	'Copper Safe Spacing': 'Spacing',
	'Plane Safe Spacing': 'Spacing',
	'Safe Spacing': 'Spacing',
	'Other Spacing': 'Spacing',
	'Creepage Distance': 'Spacing',
	'Track': 'Physics',
	'Net Length Range': 'Physics',
	'Net Length Tolerance': 'Physics',
	'Differential Pair': 'Physics',
	'Blind/Buried Via': 'Physics',
	'Via Size': 'Physics',
	'Height': 'Physics',
	'Plane Zone': 'Plane',
	'Copper Zone': 'Plane',
	'Solder Mask Expansion': 'Expansion',
	'Paste Mask Expansion': 'Expansion',
	'Acute Angle': 'Copper Analysis',
	'Hole Falls on Pad': 'Copper Analysis',
	'Bare Track Ends': 'Copper Analysis',
	'Pad Hole Ring': 'Copper Analysis',
	'Track Neckdown': 'Copper Analysis',
	'Short Circuit Prompt': 'Copper Analysis',
	'Minimum Copper Width': 'Copper Analysis',
	'No Connected Vias': 'Drill Hole Analysis',
	'Hole Size': 'Drill Hole Analysis',
	'NPTH to Copper': 'Drill Hole Analysis',
	'Silkscreen to Pad': 'Silkscreen Analysis',
	'Silkscreen to Hole': 'Silkscreen Analysis',
	'Silkscreen Line Width': 'Silkscreen Analysis',
	'Solder Mask Bridge': 'Solder Mask Analysis',
	'SMask Opening Copper': 'Solder Mask Analysis',
	'Pad Negative Opening': 'Solder Mask Analysis',
};

export function ruleGroupLabel(top: string | undefined, group: string): string {
	const topLabel = RULE_TOP_LABELS[top || ''] ?? RULE_TOP_LABELS[RULE_GROUP_TOPS[group] ?? ''] ?? top ?? '';
	const groupLabel = RULE_GROUP_LABELS[group] ?? group;
	return groupLabel ? `${topLabel}-${groupLabel}` : topLabel;
}

export function topByRuleGroup(group: string, configuredTops: Record<string, string> = {}): string {
	return configuredTops[group] ?? RULE_GROUP_TOPS[group] ?? '';
}
