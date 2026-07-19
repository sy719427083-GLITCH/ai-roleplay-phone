const definition = (value) => Object.freeze({
  reservationPolicy: "exclusive",
  durationMs: Object.freeze({ min: 45_000, max: 120_000 }),
  participants: Object.freeze({ min: 1, max: 1 }),
  propState: Object.freeze({ category: "none", variants: Object.freeze([]) }),
  semanticFallback: Object.freeze({ subject: "当前任务", summary: "正在推进手头工作", insightOrResult: "完成一个清晰的下一步" }),
  ...value,
  targetAnchors: Object.freeze([...value.targetAnchors]),
  clips: Object.freeze({ ...value.clips }),
});

const desk = (id, status, clipId, options = {}) => definition({
  id,
  sceneId: "office",
  targetAnchors: ["$actor:seat-approach"],
  clips: { actor: clipId },
  status,
  travelStatus: "前往工位",
  propState: { category: options.category || "desk", variants: Object.freeze(options.variants || []) },
  semanticFallback: options.semanticFallback || { subject: "桌面任务", summary: "在工位上专注处理", insightOrResult: "整理出明确的处理结果" },
  ...options,
});

export const OFFICE_ACTIVITY_MANIFEST = Object.freeze({
  working: desk("working", "工作中", "working", { category: "computer", variants: ["laptop", "monitor"], semanticFallback: { subject: "项目任务", summary: "在工位推进项目任务", insightOrResult: "完成当前优先事项" } }),
  slacking: desk("slacking", "摸鱼中", "slacking", { category: "leisure", variants: ["phone", "comic", "handheld"] }),
  gaming: desk("gaming", "游戏中", "gaming", { category: "game", variants: ["handheld", "keyboard"] }),
  reading: desk("reading", "阅读中", "reading", { category: "book", variants: ["paperback", "hardcover", "magazine"], semanticFallback: { subject: "项目资料", summary: "整理关键段落", insightOrResult: "明确下一步" } }),
  watchingSeries: desk("watchingSeries", "追剧中", "watching-series", { category: "screen", variants: ["tablet", "phone-landscape"] }),
  watchingShortVideo: desk("watchingShortVideo", "看短视频中", "watching-short-video", { category: "phone", variants: ["phone-portrait-light", "phone-portrait-dark"] }),
  phoneCall: desk("phoneCall", "通话中", "phone-call", { category: "phone", variants: ["phone"] }),
  videoMeeting: desk("videoMeeting", "视频会议中", "video-meeting", { category: "meeting", variants: ["camera", "monitor"] }),
  onlineTraining: desk("onlineTraining", "培训中", "online-training", { category: "training", variants: ["slide-deck"] }),
  stickyPlanning: desk("stickyPlanning", "规划中", "sticky-planning", { category: "stationery", variants: ["sticky-notes", "marker"] }),
  tidyDesk: desk("tidyDesk", "整理桌面中", "tidy-desk", { category: "stationery", variants: ["folders", "wipes"] }),
  deskRest: desk("deskRest", "工位休息中", "desk-rest", { category: "rest", variants: ["eye-mask"] }),
  printing: definition({ id: "printing", sceneId: "office", targetAnchors: ["printer:front"], clips: { actor: "printing" }, status: "打印中", travelStatus: "前往打印机", propState: { category: "documents", variants: ["printout"] }, semanticFallback: { subject: "打印文件", summary: "正在领取打印材料", insightOrResult: "文件已备齐" } }),
  filing: definition({ id: "filing", sceneId: "office", targetAnchors: ["file-cabinet:front"], clips: { actor: "filing" }, status: "归档中", travelStatus: "前往档案柜", propState: { category: "documents", variants: ["folder"] }, semanticFallback: { subject: "资料归档", summary: "按项目分类文件", insightOrResult: "资料更易查找" } }),
  whiteboardWork: definition({ id: "whiteboardWork", sceneId: "office", targetAnchors: ["whiteboard:1", "whiteboard:2", "whiteboard:3"], clips: { actor: "whiteboard-writing", host: "whiteboard-writing", visitor: "whiteboard-discussing" }, status: "白板讨论中", travelStatus: "前往白板", participants: { min: 2, max: 3 }, propState: { category: "whiteboard", variants: ["marker", "sticky-notes"] }, semanticFallback: { subject: "方案梳理", summary: "围绕白板拆解问题", insightOrResult: "形成可执行的分工" } }),
  reporting: definition({ id: "reporting", sceneId: "office", targetAnchors: ["boss:visitor-front", "boss:seat-approach"], clips: { actor: "reporting", host: "reporting", visitor: "listening" }, status: "汇报中", travelStatus: "前往主管工位", participants: { min: 2, max: 2 }, rolePolicy: "employeeHostBossVisitor", propState: { category: "report", variants: ["report"] }, semanticFallback: { subject: "项目进度", summary: "汇总当前进展与风险", insightOrResult: "确认下一阶段重点" } }),
  screenCollaboration: definition({ id: "screenCollaboration", sceneId: "office", targetAnchors: ["$actor:seat-approach", "$actor:visitor-front"], clips: { actor: "screen-collaboration-host", host: "screen-collaboration-host", visitor: "screen-collaboration-visitor" }, status: "屏幕协作中", travelStatus: "前往协作工位", participants: { min: 2, max: 2 }, propState: { category: "screen", variants: ["shared-screen"] }, semanticFallback: { subject: "屏幕协作", summary: "一起核对屏幕内容", insightOrResult: "解决当前操作问题" } }),
  documentDelivery: definition({ id: "documentDelivery", sceneId: "office", targetAnchors: ["boss:visitor-front", "boss:seat-approach"], clips: { actor: "document-submit", host: "document-submit", visitor: "document-sign" }, status: "文件递交中", travelStatus: "前往签收工位", participants: { min: 2, max: 2 }, rolePolicy: "employeeHostBossVisitor", propState: { category: "documents", variants: ["contract"] }, semanticFallback: { subject: "待签文件", summary: "递交文件并确认内容", insightOrResult: "完成签收流程" } }),
  documentSigning: definition({ id: "documentSigning", sceneId: "office", targetAnchors: ["boss:seat-approach"], clips: { actor: "document-sign" }, status: "签署中", travelStatus: "前往签署工位", requiredActorIds: ["boss"], propState: { category: "documents", variants: ["contract", "pen"] }, semanticFallback: { subject: "签署文件", summary: "核对条款后签署", insightOrResult: "完成审批节点" } }),
  computerHelp: definition({ id: "computerHelp", sceneId: "office", targetAnchors: ["$actor:seat-approach", "$actor:visitor-front"], clips: { actor: "computer-help-host", host: "computer-help-host", visitor: "computer-help-visitor" }, status: "电脑协助中", travelStatus: "前往同事工位", participants: { min: 2, max: 2 }, propState: { category: "computer", variants: ["keyboard", "mouse"] }, semanticFallback: { subject: "电脑问题", summary: "一起检查操作设置", insightOrResult: "恢复正常工作" } }),
  parcelReceive: definition({ id: "parcelReceive", sceneId: "office", targetAnchors: ["delivery"], clips: { actor: "parcel-receive" }, status: "收取快递中", travelStatus: "前往门口", propState: { category: "parcel", variants: ["parcel"] }, semanticFallback: { subject: "办公室快递", summary: "在门口确认并收取包裹", insightOrResult: "包裹已签收" } }),
  stretching: desk("stretching", "拉伸中", "stretching", { category: "exercise", variants: ["none"] }),
  eating: definition({ id: "eating", sceneId: "lounge", targetAnchors: ["dining:seat-1", "dining:seat-2", "dining:seat-3", "dining:seat-4"], clips: { actor: "eating" }, status: "用餐中", travelStatus: "前往休息区", propState: { category: "meal", variants: ["bento", "rice", "noodles", "sandwich"] }, semanticFallback: { subject: "午餐", summary: "在餐桌前好好吃饭", insightOrResult: "补充体力后继续工作" } }),
  drinking: definition({ id: "drinking", sceneId: "lounge", targetAnchors: ["pantry:coffee", "pantry:water"], clips: { actor: "drinking" }, status: "喝饮料中", travelStatus: "前往茶水区", propState: { category: "drink", variants: ["coffee", "water"] }, semanticFallback: { subject: "饮品", summary: "在茶水区稍作停留", insightOrResult: "恢复一点精神" } }),
  watchingTv: definition({ id: "watchingTv", sceneId: "lounge", targetAnchors: ["tv:view"], clips: { actor: "watching-tv" }, status: "看电视中", travelStatus: "前往电视区", propState: { category: "television", variants: ["news", "show"] }, semanticFallback: { subject: "电视节目", summary: "在休息区看一会儿电视", insightOrResult: "短暂转换了注意力" } }),
  sofaRest: definition({ id: "sofaRest", sceneId: "lounge", targetAnchors: ["sofa:visitor-2"], clips: { actor: "sofa-rest" }, status: "沙发休息中", travelStatus: "前往沙发区", propState: { category: "rest", variants: ["cushion"] }, semanticFallback: { subject: "短暂休息", summary: "在沙发上放松片刻", insightOrResult: "恢复专注力" } }),
  quietRest: definition({ id: "quietRest", sceneId: "lounge", targetAnchors: ["sofa:visitor-2"], clips: { actor: "quiet-rest" }, status: "安静休息中", travelStatus: "前往安静区", propState: { category: "rest", variants: ["none"] }, semanticFallback: { subject: "安静片刻", summary: "暂时离开屏幕和噪音", insightOrResult: "理清了思绪" } }),
  diningChat: definition({ id: "diningChat", sceneId: "lounge", targetAnchors: ["dining:seat-1", "dining:seat-2"], clips: { actor: "dining-chat", host: "dining-chat", visitor: "dining-listen" }, status: "餐桌聊天中", travelStatus: "前往餐桌", participants: { min: 2, max: 2 }, propState: { category: "conversation", variants: ["meal"] }, semanticFallback: { subject: "用餐闲聊", summary: "边吃边交换近况", insightOrResult: "彼此更了解当前状态" } }),
  sofaChat: definition({ id: "sofaChat", sceneId: "lounge", targetAnchors: ["sofa:visitor-2", "tv:view"], clips: { actor: "sofa-chat", host: "sofa-chat", visitor: "sofa-listen" }, status: "沙发聊天中", travelStatus: "前往沙发区", participants: { min: 2, max: 2 }, propState: { category: "conversation", variants: ["coffee"] }, semanticFallback: { subject: "休息聊天", summary: "在沙发边聊聊近况", insightOrResult: "缓和了工作节奏" } }),
  chatting: definition({ id: "chatting", sceneId: "office", targetAnchors: ["whiteboard:1", "whiteboard:2", "whiteboard:3"], clips: { actor: "chatting", host: "chatting", visitor: "listening" }, status: "交流中", travelStatus: "前往交流区", participants: { min: 2, max: 4 }, propState: { category: "conversation", variants: ["project", "lunch", "weekend"] }, semanticFallback: { subject: "办公室交流", summary: "围绕手头话题交换看法", insightOrResult: "找到可继续讨论的方向" } }),
});

export function getActivityDefinition(id) {
  return OFFICE_ACTIVITY_MANIFEST[id] ?? null;
}
