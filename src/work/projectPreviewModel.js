const SAMPLE_PROJECTS = [
  { id: "pet-portrait", name: "宠物头像绘制", duration: "3 天", amount: "¥800", description: "为社区宠物店绘制一组温暖的宣传头像。", difficulty: "简单" },
  { id: "brand-poster", name: "品牌活动海报", duration: "5 天", amount: "¥1,500", description: "完成夏日新品活动的主视觉与海报排版。", difficulty: "中等" },
  { id: "store-redesign", name: "小店页面改版", duration: "7 天", amount: "¥2,400", description: "优化独立咖啡店的移动端商品浏览体验。", difficulty: "中等" },
  { id: "app-prototype", name: "习惯养成应用原型", duration: "10 天", amount: "¥4,000", description: "制作可演示的任务打卡应用交互原型。", difficulty: "困难" },
  { id: "data-dashboard", name: "经营数据看板", duration: "14 天", amount: "¥6,800", description: "为连锁门店设计清晰易读的数据分析看板。", difficulty: "困难" },
];

export function createProjectPreviewState() {
  return { projects: SAMPLE_PROJECTS, startedProjectId: null, revision: 0 };
}

export function startPreviewProject(state, projectId) {
  if (state.startedProjectId || !state.projects.some((project) => project.id === projectId)) return state;
  return { ...state, startedProjectId: projectId };
}

export function refreshPreviewProjects(state) {
  if (state.startedProjectId) return state;
  return {
    ...state,
    projects: [...state.projects.slice(1), state.projects[0]],
    revision: state.revision + 1,
  };
}
