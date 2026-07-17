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

const ACTIVITY_CONTEXT_LABELS = {
  slacking: {
    phone: "手机消息",
    comic: "漫画《午休侦探》",
    handheld: "掌机游戏",
  },
  eating: {
    bento: "便当",
    rice: "米饭",
    noodles: "面条",
    sandwich: "三明治",
  },
  reading: {
    paperback: "《小王子》",
    hardcover: "《沉思录》",
    magazine: "《城市生活》杂志",
  },
  watchingSeries: {
    "phone-landscape": "《周一未完》",
    tablet: "《深夜办公室》",
    "second-screen": "《风起之后》",
  },
  watchingShortVideo: {
    "phone-portrait-light": "通勤收纳技巧",
    "phone-portrait-dark": "深夜街头美食",
  },
};

const ACTIVITY_DEFAULT_CONTEXT = {
  working: "本周项目清单",
  slacking: "手机消息",
  eating: "便当",
  gaming: "办公室益智小游戏",
  reading: "《小王子》",
  watchingSeries: "《深夜办公室》",
  watchingShortVideo: "通勤收纳技巧",
  chatting: "办公室日常",
};

export function getOfficeActivityContext(event = {}) {
  const activityType = asString(event.activityType);
  const propVariant = asString(event.propVariant);
  const conversationTopic = asString(event.conversationTopic);
  const contextLabel = activityType === "chatting"
    ? conversationTopic || ACTIVITY_DEFAULT_CONTEXT.chatting
    : ACTIVITY_CONTEXT_LABELS[activityType]?.[propVariant]
      || ACTIVITY_DEFAULT_CONTEXT[activityType]
      || "当前活动";

  return { propVariant, conversationTopic, contextLabel };
}

const ACTIVITY_LOCAL_COPY = {
  working: {
    subject: ({ name, contextLabel }) => `${name}的${contextLabel}`,
    summary: ({ name, personality, contextLabel }) => `${name}按${personality}的节奏推进${contextLabel}。`,
    insightOrResult: ({ personality }) => `保持${personality}的专注感，把最重要的任务先收口。`,
  },
  slacking: {
    subject: ({ name, contextLabel }) => `${name}在看${contextLabel}`,
    summary: ({ name, personality, contextLabel }) => `${name}带着${personality}的状态翻了翻${contextLabel}，给脑子换了口气。`,
    insightOrResult: ({ personality }) => `就算是${personality}的人，也需要一点留白才能继续往前。`,
  },
  eating: {
    subject: ({ name, contextLabel }) => `${name}的${contextLabel}时间`,
    summary: ({ name, personality, contextLabel }) => `${name}吃着${contextLabel}整理情绪，连胃口都透着${personality}。`,
    insightOrResult: ({ personality }) => `吃饱之后，带着${personality}的劲头回去继续。`,
  },
  gaming: {
    subject: ({ name, contextLabel }) => `${name}玩的${contextLabel}`,
    summary: ({ name, personality, contextLabel }) => `${name}在${contextLabel}里释放压力，手感和${personality}一样稳定。`,
    insightOrResult: ({ personality }) => `这一局提醒自己，${personality}也可以是一种放松方式。`,
  },
  reading: {
    subject: ({ name, contextLabel }) => `${name}在读${contextLabel}`,
    summary: ({ name, personality, contextLabel }) => `${name}安静翻着${contextLabel}，把${personality}慢慢沉进字里行间。`,
    insightOrResult: ({ personality }) => `读完之后留下一个念头: 先用${personality}的方式处理可控之事。`,
  },
  watchingSeries: {
    subject: ({ name, contextLabel }) => `${name}在看${contextLabel}`,
    summary: ({ name, personality, contextLabel }) => `${name}一边追${contextLabel}，一边用${personality}的眼光吐槽角色选择。`,
    insightOrResult: ({ personality }) => `剧情再乱，也能用${personality}的视角理出重点。`,
  },
  watchingShortVideo: {
    subject: ({ name, contextLabel }) => `${name}刷到${contextLabel}`,
    summary: ({ name, personality, contextLabel }) => `${name}连刷几条${contextLabel}短视频，注意力也带着${personality}的偏好乱跳。`,
    insightOrResult: ({ personality }) => `停下来时发现，${personality}决定了真正会记住什么。`,
  },
  chatting: {
    subject: ({ name, contextLabel }) => `${name}聊起“${contextLabel}”`,
    summary: ({ name, personality, contextLabel }) => `${name}围绕“${contextLabel}”聊下去，语气里都是${personality}的痕迹。`,
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
    conversationTopic: String(input.conversationTopic || ""),
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
  const { contextLabel } = getOfficeActivityContext(event);
  const tokens = { name, personality, contextLabel };

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
      if (filters.actorId) {
        const participantIds = Array.isArray(event.participantIds)
          ? event.participantIds.map(String)
          : [];
        if (event.actorId !== filters.actorId && !participantIds.includes(filters.actorId)) return false;
      }
      if (filters.activityType && event.activityType !== filters.activityType) return false;
      return true;
    })
    .sort((left, right) => asNumber(right.startedAt) - asNumber(left.startedAt));
}
