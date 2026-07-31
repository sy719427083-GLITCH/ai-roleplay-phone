export const OFFICE_PROJECT_TASKS = Object.freeze([
  { id: "slides", label: "做 PPT", keywords: ["ppt", "演示", "汇报", "品牌", "设计", "展示"] },
  { id: "spreadsheet", label: "做表格", keywords: ["表格", "台账", "清单", "统计", "excel"] },
  { id: "proposal", label: "写项目方案", keywords: ["方案", "策划", "规划", "设计", "建设"] },
  { id: "materials", label: "整理项目资料", keywords: ["资料", "素材", "归档", "整理", "迁移"] },
  { id: "collect-data", label: "收集项目数据", keywords: ["采集", "收集", "调研", "数据源"] },
  { id: "analyze-data", label: "分析项目数据", keywords: ["分析", "指标", "趋势", "模型", "数据"] },
  { id: "report", label: "制作项目报表", keywords: ["报表", "看板", "报告", "可视化"] },
  { id: "budget", label: "核对项目预算", keywords: ["预算", "金额", "成本", "采购", "报价"] },
  { id: "deliverable", label: "编写交付文档", keywords: ["交付", "文档", "说明书", "手册"] },
  { id: "qa", label: "检查项目成果", keywords: ["验收", "检查", "测试", "质量", "校验", "成果"] },
]);

const WORK_ACTIVITY_IDS = new Set(["working", "reporting", "printing"]);

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function getProjectText(project) {
  return [
    project?.name,
    project?.description,
    ...(Array.isArray(project?.scopeItems) ? project.scopeItems : []),
    project?.deliverables,
    project?.acceptanceCriteria,
  ].filter((value) => typeof value === "string" && value.trim()).join(" ").toLocaleLowerCase("zh-CN");
}

export function hasRunningOfficeProject(context) {
  return Boolean(context?.status === "running" && context.project?.id && getProjectText(context.project));
}

export function isOfficeProjectWorkActivity(activity) {
  return WORK_ACTIVITY_IDS.has(activity);
}

export function selectOfficeProjectTask({ project, profileId = "", intervalKey = "", usedLabels = new Set() }) {
  const text = getProjectText(project);
  const scored = OFFICE_PROJECT_TASKS.map((task, index) => ({
    ...task,
    score: task.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 12 : 0), 1)
      + ((hashString(`${project?.id}:${profileId}:${intervalKey}:${task.id}`) + index) % 7),
  })).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return scored.find((task) => !usedLabels.has(task.label)) || scored[0];
}

export function normalizeProjectOfficePlan(plan, {
  occupants = [], projectContext = null, intervalKey = "", now = Date.now(),
} = {}) {
  const next = {
    ...plan,
    characters: Object.fromEntries(Object.entries(plan?.characters || {}).map(([id, item]) => [id, { ...item }])),
  };
  const running = hasRunningOfficeProject(projectContext);
  const usedLabels = new Set();
  for (const occupant of occupants) {
    const profileId = occupant.profile.id;
    const current = next.characters[profileId];
    if (!current || !isOfficeProjectWorkActivity(current.activity)) continue;
    if (!running) {
      next.characters[profileId] = {
        ...current,
        activity: "idle",
        label: "待命中",
        destination: `${occupant.slotId}-home`,
        startsAt: current.startsAt ?? now,
      };
      continue;
    }
    if (current.activity === "printing") continue;
    const task = selectOfficeProjectTask({
      project: projectContext.project,
      profileId,
      intervalKey,
      usedLabels,
    });
    usedLabels.add(task.label);
    next.characters[profileId] = {
      ...current,
      activity: "working",
      label: task.label,
      destination: `${occupant.slotId}-home`,
    };
  }
  return next;
}
