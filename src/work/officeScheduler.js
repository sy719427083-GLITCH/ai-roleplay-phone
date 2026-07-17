import { claimAnchor, findOfficeRoute } from "./officeNavigation.js";

export const MODE_WEIGHTS = {
  focus: {
    working: 58,
    reading: 12,
    slacking: 4,
    eating: 7,
    gaming: 3,
    watchingSeries: 3,
    watchingShortVideo: 3,
    chatting: 10,
  },
  free: {
    working: 25,
    reading: 10,
    slacking: 12,
    eating: 12,
    gaming: 9,
    watchingSeries: 8,
    watchingShortVideo: 9,
    chatting: 15,
  },
  rest: {
    working: 6,
    reading: 12,
    slacking: 14,
    eating: 18,
    gaming: 12,
    watchingSeries: 12,
    watchingShortVideo: 12,
    chatting: 14,
  },
};

const ACTIVITY_ORDER = [
  "working",
  "reading",
  "slacking",
  "eating",
  "gaming",
  "watchingSeries",
  "watchingShortVideo",
  "chatting",
];
const BREAK_ANCHORS = ["break-1", "break-2"];
const CHAT_ANCHORS = ["chat-1", "chat-2", "chat-3", "chat-4"];
const CHAT_ANCHOR_CONFLICTS = {
  "chat-1": new Set(["chat-2"]),
  "chat-2": new Set(["chat-1"]),
  "chat-3": new Set(["chat-4"]),
  "chat-4": new Set(["chat-3"]),
};
const MEALS = ["bento", "rice", "noodles", "sandwich"];
const SLACK_PROPS = ["phone", "comic", "handheld"];
const BOOK_PROPS = ["paperback", "hardcover", "magazine"];
const SERIES_PROPS = ["phone-landscape", "tablet", "second-screen"];
const SHORT_VIDEO_PROPS = ["phone-portrait-light", "phone-portrait-dark"];
const TOPICS = ["项目进度", "午饭时间", "周末安排", "办公室日常"];
const INTERRUPTIBLE_PHASES = new Set(["idle", "working"]);
const BLOCKED_ACTIVITIES = new Set(["slacking", "eating", "returning", "gaming", "chatting"]);

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clampRandom = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 0.999999999;
  return value;
};

const pickIndex = (items, random) => {
  if (!Array.isArray(items) || items.length === 0) return -1;
  return Math.floor(clampRandom(random()) * items.length);
};

const pickFromList = (items, random) => {
  const index = pickIndex(items, random);
  return index >= 0 ? items[index] : null;
};

const getModeWeights = (mode) => MODE_WEIGHTS[mode] || MODE_WEIGHTS.free;

const applyPersonalityModifiers = (weights, personality = "") => {
  const next = { ...weights };
  const text = String(personality || "");

  if (text.includes("外向")) {
    next.working -= 4;
    next.reading -= 2;
    next.chatting += 12;
  }
  if (text.includes("社恐")) {
    next.working += 6;
    next.reading += 4;
    next.chatting -= 18;
  }
  if (text.includes("自律")) {
    next.working += 12;
    next.reading += 8;
    next.slacking -= 8;
    next.eating -= 4;
    next.gaming -= 10;
    next.watchingSeries -= 4;
    next.watchingShortVideo -= 4;
  }
  if (text.includes("沉静")) {
    next.working += 4;
    next.reading += 12;
    next.slacking -= 4;
    next.gaming -= 3;
    next.watchingSeries -= 3;
    next.watchingShortVideo -= 3;
    next.chatting -= 6;
  }
  if (text.includes("贪吃")) {
    next.slacking -= 2;
    next.eating += 18;
  }
  if (text.includes("游戏")) {
    next.working -= 6;
    next.gaming += 18;
  }
  if (text.includes("追剧")) {
    next.working -= 4;
    next.slacking -= 2;
    next.gaming -= 4;
    next.watchingSeries += 18;
    next.watchingShortVideo -= 2;
  }
  if (text.includes("短视频")) {
    next.working -= 4;
    next.slacking -= 2;
    next.gaming -= 4;
    next.watchingSeries -= 2;
    next.watchingShortVideo += 18;
  }
  if (text.includes("话多")) {
    next.slacking -= 2;
    next.reading -= 2;
    next.chatting += 16;
  }

  for (const key of ACTIVITY_ORDER) {
    next[key] = Math.max(1, Math.round(next[key] || 0));
  }

  return next;
};

const pickWeightedActivity = (weights, random) => {
  const total = ACTIVITY_ORDER.reduce((sum, key) => sum + weights[key], 0);
  let threshold = clampRandom(random()) * total;

  for (const key of ACTIVITY_ORDER) {
    threshold -= weights[key];
    if (threshold < 0) return key;
  }

  return ACTIVITY_ORDER[ACTIVITY_ORDER.length - 1];
};

const getProfileForSlot = (slotId, character, profiles) => {
  if (isPlainObject(profiles?.[character?.profileId])) return profiles[character.profileId];
  if (isPlainObject(profiles?.[slotId])) return profiles[slotId];
  if (isPlainObject(character?.profile)) return character.profile;
  return {};
};

const isInterruptibleCharacter = (character) => {
  if (!isPlainObject(character)) return false;
  if (character.conversationId) return false;
  if (!INTERRUPTIBLE_PHASES.has(character.phase)) return false;
  if (BLOCKED_ACTIVITIES.has(character.activity)) return false;
  return true;
};

const getCharacterNode = (slotId, character) => String(
  character?.positionNode
  || character?.homePosition
  || character?.homeNode
  || `${slotId}-home`,
);

const getAvailableAnchorClaim = (anchorIds, reservations, ownerId, random) => {
  const available = anchorIds
    .map((anchorId) => [anchorId, claimAnchor(reservations, anchorId, ownerId)])
    .filter(([, nextReservations]) => nextReservations);

  if (!available.length) return null;

  const index = pickIndex(available, random);
  const [anchorId, nextReservations] = available[index];
  return { anchorId, reservations: nextReservations };
};

const buildSingleCharacterEvent = (slotId, activity, now) => ({
  slotId,
  memberIds: [slotId],
  activity,
  now,
});

const buildDeskLocalEvent = ({ slotId, activity, now, random, propPool }) => {
  const event = buildSingleCharacterEvent(slotId, activity, now);
  if (!Array.isArray(propPool) || !propPool.length) return event;

  return {
    ...event,
    propVariant: pickFromList(propPool, random),
  };
};

const buildEatingEvent = ({ slotId, character, reservations, random, now }) => {
  const claim = getAvailableAnchorClaim(BREAK_ANCHORS, reservations, slotId, random);
  if (!claim) return null;

  const route = findOfficeRoute(getCharacterNode(slotId, character), claim.anchorId);
  if (!route.length) return null;

  return {
    ...buildSingleCharacterEvent(slotId, "eating", now),
    anchorId: claim.anchorId,
    meal: pickFromList(MEALS, random),
    route,
    reservations: claim.reservations,
  };
};

const buildChatRoutes = (memberIds, characters, anchorId) => {
  const routesByMember = {};

  for (const slotId of memberIds) {
    const route = findOfficeRoute(getCharacterNode(slotId, characters[slotId]), anchorId);
    if (!route.length) return null;
    routesByMember[slotId] = route;
  }

  return routesByMember;
};

export function buildConversationSession({ memberIds, anchorId, now, random }) {
  if (!Array.isArray(memberIds) || memberIds.length < 2 || memberIds.length > 5) return null;
  if (new Set(memberIds).size !== memberIds.length) return null;
  if (!anchorId || typeof anchorId !== "string") return null;
  if (typeof random !== "function") return null;

  const normalizedMemberIds = memberIds.map((memberId) => String(memberId));
  const anchorOwnerId = normalizedMemberIds[0];
  const idSeed = Math.floor(clampRandom(random()) * 1_000_000);
  const topic = pickFromList(TOPICS, random) || TOPICS[0];

  return {
    id: `office-chat-${now}-${anchorId}-${idSeed}-${normalizedMemberIds.join("-")}`,
    memberIds: [...normalizedMemberIds],
    topic,
    anchorId,
    anchorOwnerId,
    transcript: [],
    turnIndex: 0,
    requestSequence: 0,
    status: "active",
    startedAt: now,
    endsAt: now + 45_000,
    bubbleQueue: [],
    promptContext: {
      anchorId,
      topic,
      members: [...normalizedMemberIds],
    },
    lastResponse: null,
  };
}

const buildChatEvent = ({ state, eligibleIds, primarySlotId, random, now }) => {
  if (eligibleIds.length < 2) return null;

  const reservedChatAnchors = CHAT_ANCHORS.filter((anchorId) => state.reservations?.[anchorId]);
  const spacedChatAnchors = CHAT_ANCHORS.filter((anchorId) => (
    reservedChatAnchors.every((reservedAnchorId) => (
      !CHAT_ANCHOR_CONFLICTS[reservedAnchorId]?.has(anchorId)
    ))
  ));
  const claim = getAvailableAnchorClaim(
    spacedChatAnchors,
    state.reservations,
    primarySlotId,
    random,
  );
  if (!claim) return null;

  const maxGroupSize = Math.min(5, eligibleIds.length);
  const groupSize = maxGroupSize === 2
    ? 2
    : 2 + Math.floor(clampRandom(random()) * (maxGroupSize - 1));
  const memberIds = [
    primarySlotId,
    ...eligibleIds.filter((slotId) => slotId !== primarySlotId),
  ].slice(0, groupSize);

  if (memberIds.length < 2) return null;

  const routesByMember = buildChatRoutes(memberIds, state.characters, claim.anchorId);
  if (!routesByMember) return null;

  const session = buildConversationSession({
    memberIds,
    anchorId: claim.anchorId,
    now,
    random,
  });
  if (!session) return null;

  return {
    activity: "chatting",
    memberIds,
    leaderId: primarySlotId,
    anchorId: claim.anchorId,
    routesByMember,
    reservations: claim.reservations,
    session,
    now,
  };
};

export function chooseOfficeEvent({ state, profiles, random, now }) {
  if (!isPlainObject(state) || !isPlainObject(state.characters) || !isPlainObject(profiles)) return null;
  if (typeof random !== "function") return null;

  const eligibleIds = Object.keys(state.characters).filter((slotId) => isInterruptibleCharacter(state.characters[slotId]));
  if (!eligibleIds.length) return null;

  const primarySlotId = eligibleIds[pickIndex(eligibleIds, random)];
  const primaryCharacter = state.characters[primarySlotId];
  const profile = getProfileForSlot(primarySlotId, primaryCharacter, profiles);
  const weights = applyPersonalityModifiers(getModeWeights(state.mode), profile.personality);
  const activity = pickWeightedActivity(weights, random);

  if (activity === "eating") {
    return buildEatingEvent({
      slotId: primarySlotId,
      character: primaryCharacter,
      reservations: state.reservations || {},
      random,
      now,
    });
  }

  if (activity === "chatting") {
    return buildChatEvent({
      state: {
        ...state,
        reservations: state.reservations || {},
      },
      eligibleIds,
      primarySlotId,
      random,
      now,
    });
  }

  if (activity === "reading") {
    return buildDeskLocalEvent({
      slotId: primarySlotId,
      activity,
      now,
      random,
      propPool: BOOK_PROPS,
    });
  }

  if (activity === "slacking") {
    return buildDeskLocalEvent({
      slotId: primarySlotId,
      activity,
      now,
      random,
      propPool: SLACK_PROPS,
    });
  }

  if (activity === "watchingSeries") {
    return buildDeskLocalEvent({
      slotId: primarySlotId,
      activity,
      now,
      random,
      propPool: SERIES_PROPS,
    });
  }

  if (activity === "watchingShortVideo") {
    return buildDeskLocalEvent({
      slotId: primarySlotId,
      activity,
      now,
      random,
      propPool: SHORT_VIDEO_PROPS,
    });
  }

  return buildSingleCharacterEvent(primarySlotId, activity, now);
}
