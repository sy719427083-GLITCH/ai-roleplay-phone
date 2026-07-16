const cloneValue = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const asString = (value) => String(value || "");
const asNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const getPrimarySnapshot = (event = {}) => {
  const [firstSnapshot] = Array.isArray(event.profileSnapshots) ? event.profileSnapshots : [];
  return firstSnapshot && typeof firstSnapshot === "object" ? firstSnapshot : {};
};

const ACTIVITY_LOCAL_COPY = {
  working: {
    subject: ({ name }) => `${name}的待办清单`,
    summary: ({ name, personality }) => `${name}按${personality}的节奏推进手头工作。`,
    insightOrResult: ({ personality }) => `保持${personality}的专注感，把最重要的任务先收口。`,
  },
  slacking: {
    subject: ({ name }) => `${name}的摸鱼片刻`,
    summary: ({ name, personality }) => `${name}带着${personality}的状态短暂放空，给脑子换了口气。`,
    insightOrResult: ({ personality }) => `就算是${personality}的人，也需要一点留白才能继续往前。`,
  },
  eating: {
    subject: ({ name }) => `${name}的午餐时间`,
    summary: ({ name, personality }) => `${name}边吃边整理情绪，连胃口都透着${personality}。`,
    insightOrResult: ({ personality }) => `吃饱之后，带着${personality}的劲头回去继续。`,
  },
  gaming: {
    subject: ({ name }) => `${name}的游戏局`,
    summary: ({ name, personality }) => `${name}在短暂游戏里释放压力，手感和${personality}一样稳定。`,
    insightOrResult: ({ personality }) => `这一局提醒自己，${personality}也可以是一种放松方式。`,
  },
  reading: {
    subject: ({ name }) => `${name}在读的一页`,
    summary: ({ name, personality }) => `${name}安静翻书，把${personality}慢慢沉进字里行间。`,
    insightOrResult: ({ personality }) => `读完之后留下一个念头: 先用${personality}的方式处理可控之事。`,
  },
  watchingSeries: {
    subject: ({ name }) => `${name}追到的新一集`,
    summary: ({ name, personality }) => `${name}一边追剧情，一边用${personality}的眼光吐槽角色选择。`,
    insightOrResult: ({ personality }) => `剧情再乱，也能用${personality}的视角理出重点。`,
  },
  watchingShortVideo: {
    subject: ({ name }) => `${name}刷到的短视频`,
    summary: ({ name, personality }) => `${name}连刷几条短视频，注意力也带着${personality}的偏好乱跳。`,
    insightOrResult: ({ personality }) => `停下来时发现，${personality}决定了真正会记住什么。`,
  },
  chatting: {
    subject: ({ name }) => `${name}刚聊到的话题`,
    summary: ({ name, personality }) => `${name}顺着话头聊下去，语气里都是${personality}的痕迹。`,
    insightOrResult: ({ personality }) => `一句闲聊也会暴露一个人最自然的${personality}。`,
  },
};

export const OFFICE_ACTIVITY_TYPES = [
  "working",
  "slacking",
  "eating",
  "gaming",
  "reading",
  "watchingSeries",
  "watchingShortVideo",
  "chatting",
];

export const ACTIVITY_DEFINITIONS = {
  working: { status: "工作中", title: "工作记录" },
  slacking: { status: "摸鱼中", title: "摸鱼记录" },
  eating: { status: "吃饭中", title: "用餐记录" },
  gaming: { status: "游戏中", title: "游戏记录" },
  reading: { status: "看书中", title: "阅读记录" },
  watchingSeries: { status: "刷剧中", title: "追剧记录" },
  watchingShortVideo: { status: "看抖音中", title: "短视频记录" },
  chatting: { status: "闲聊中", title: "聊天记录" },
};

export function createOfficeActivityEvent(input = {}) {
  const definition = ACTIVITY_DEFINITIONS[input.activityType] || ACTIVITY_DEFINITIONS.working;
  return {
    eventId: String(input.eventId || ""),
    workSessionId: String(input.workSessionId || ""),
    actorId: String(input.actorId || ""),
    participantIds: [...new Set(input.participantIds || [input.actorId].filter(Boolean))],
    profileSnapshots: cloneValue(input.profileSnapshots || []),
    activityType: input.activityType,
    movementPhase: String(input.movementPhase || "active"),
    status: definition.status,
    title: definition.title,
    subject: "",
    summary: "",
    insightOrResult: "",
    propVariant: String(input.propVariant || ""),
    conversationId: String(input.conversationId || ""),
    startedAt: Number(input.startedAt || 0),
    endedAt: 0,
    requestSequence: Number(input.requestSequence || 0),
    detailStatus: "pending",
  };
}

export function mergeOfficeActivityDetail(event, detail = {}) {
  if (!event || typeof event !== "object") return event;
  if (event.eventId !== asString(detail.eventId)) return event;
  if (event.activityType !== detail.activityType) return event;
  if (event.requestSequence !== asNumber(detail.requestSequence)) return event;

  return {
    ...event,
    title: asString(detail.title) || event.title,
    subject: asString(detail.subject),
    summary: asString(detail.summary),
    insightOrResult: asString(detail.insightOrResult),
    detailStatus: "complete",
  };
}

export function createLocalActivityDetail(event = {}) {
  const definition = ACTIVITY_DEFINITIONS[event.activityType] || ACTIVITY_DEFINITIONS.working;
  const snapshot = getPrimarySnapshot(event);
  const name = asString(snapshot.name) || asString(event.actorId) || "同事";
  const personality = asString(snapshot.personality) || "自然";
  const copy = ACTIVITY_LOCAL_COPY[event.activityType] || ACTIVITY_LOCAL_COPY.working;
  const tokens = { name, personality };

  return {
    eventId: asString(event.eventId),
    activityType: event.activityType,
    requestSequence: asNumber(event.requestSequence),
    title: definition.title,
    subject: copy.subject(tokens),
    summary: copy.summary(tokens),
    insightOrResult: copy.insightOrResult(tokens),
  };
}

export function filterOfficeActivityEvents(events = [], filters = {}) {
  return [...events]
    .filter((event) => {
      if (filters.workSessionId && event.workSessionId !== filters.workSessionId) return false;
      if (filters.actorId && event.actorId !== filters.actorId) return false;
      if (filters.activityType && event.activityType !== filters.activityType) return false;
      return true;
    })
    .sort((left, right) => asNumber(right.startedAt) - asNumber(left.startedAt));
}
