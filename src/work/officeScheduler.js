import { getActivityDefinition, OFFICE_ACTIVITY_MANIFEST } from "./officeActivityManifest.js";
import { getSceneAnchor } from "./officeSceneManifest.js";
import { reserveAnchors } from "./officeReservations.js";
import { buildWorldRoute } from "./officeWorld.js";
import { isLegalCharacterPosition } from "./officePathfinding.js";

const INTERRUPTIBLE_PHASES = new Set(["idle", "working"]);
const BLOCKED_ACTIVITIES = new Set(["returning", "chatting", "eating", "gaming", "slacking"]);
const ACTIVITY_ORDER = Object.freeze(Object.keys(OFFICE_ACTIVITY_MANIFEST));
const CONVERSATION_TOPICS = Object.freeze(["项目进度", "午饭时间", "周末安排", "办公室日常"]);

export const MODE_WEIGHTS = Object.freeze({
  focus: Object.freeze({ working: 48, reading: 15, reporting: 8, printing: 6, filing: 6, videoMeeting: 7, screenCollaboration: 10 }),
  free: Object.freeze({ working: 22, reading: 9, slacking: 8, gaming: 5, watchingSeries: 5, watchingShortVideo: 6, chatting: 8, eating: 7, drinking: 5, screenCollaboration: 6, computerHelp: 4, printing: 3, whiteboardWork: 2 }),
  rest: Object.freeze({ eating: 22, drinking: 12, sofaRest: 12, quietRest: 10, watchingTv: 8, diningChat: 8, sofaChat: 8, stretching: 8, reading: 5, watchingSeries: 4, watchingShortVideo: 3 }),
});

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const clampRandom = (value) => (Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999) : 0);
const pick = (items, random) => items[Math.floor(clampRandom(random()) * items.length)] ?? null;
const unique = (items) => [...new Set(items)];

const isInterruptible = (character) => (
  isPlainObject(character)
  && !character.conversationId
  && INTERRUPTIBLE_PHASES.has(character.phase)
  && !BLOCKED_ACTIVITIES.has(character.activity)
);

const getProfile = (slotId, character, profiles) => (
  profiles?.[character?.profileId] || profiles?.[slotId] || character?.profile || {}
);

const personalityWeight = (activityId, personality) => {
  const text = String(personality || "");
  let modifier = 0;
  if (text.includes("自律") && ["working", "reading", "reporting", "filing"].includes(activityId)) modifier += 16;
  if (text.includes("沉静") && ["reading", "quietRest", "working"].includes(activityId)) modifier += 12;
  if (text.includes("外向") && ["chatting", "diningChat", "sofaChat", "whiteboardWork"].includes(activityId)) modifier += 16;
  if (text.includes("社恐") && ["chatting", "diningChat", "sofaChat"].includes(activityId)) modifier -= 12;
  if (text.includes("贪吃") && ["eating", "drinking"].includes(activityId)) modifier += 18;
  if (text.includes("游戏") && activityId === "gaming") modifier += 18;
  if (text.includes("追剧") && activityId === "watchingSeries") modifier += 18;
  if (text.includes("短视频") && activityId === "watchingShortVideo") modifier += 18;
  return modifier;
};

const chooseActivityId = ({ state, profile, random }) => {
  if (getActivityDefinition(state.forcedActivityId)) return state.forcedActivityId;
  const base = MODE_WEIGHTS[state.mode] || MODE_WEIGHTS.free;
  const weighted = ACTIVITY_ORDER.map((activityId) => ({
    activityId,
    weight: Math.max(1, (base[activityId] || 1) + personalityWeight(activityId, profile.personality)),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = clampRandom(random()) * total;
  for (const entry of weighted) {
    threshold -= entry.weight;
    if (threshold < 0) return entry.activityId;
  }
  return weighted.at(-1).activityId;
};

const getHomePoint = (slotId) => {
  const anchor = getSceneAnchor("office", `${slotId}:seat-approach`) || getSceneAnchor("office", "entry");
  return { sceneId: "office", x: anchor.x, y: anchor.y };
};

const getActorPoint = (slotId, character) => {
  const point = character?.position;
  if (typeof character?.sceneId === "string" && Number.isFinite(point?.x) && Number.isFinite(point?.y)
    && isLegalCharacterPosition(character.sceneId, point)) {
    return { sceneId: character.sceneId, x: point.x, y: point.y };
  }
  return getHomePoint(slotId);
};

const resolveAnchor = (anchorId, leaderId) => anchorId.replace(/^\$actor/, leaderId);
const anchorPoint = (sceneId, anchorId) => {
  const point = getSceneAnchor(sceneId, anchorId);
  return point && isLegalCharacterPosition(sceneId, point) ? { sceneId, x: point.x, y: point.y } : null;
};

const buildRoutes = ({ actorIds, characters, sceneId, anchors }) => {
  const routesByActor = {};
  for (let index = 0; index < actorIds.length; index += 1) {
    const actorId = actorIds[index];
    const destination = anchorPoint(sceneId, anchors[index % anchors.length]);
    if (!destination) return null;
    const route = buildWorldRoute({ from: getActorPoint(actorId, characters[actorId]), to: destination });
    if (!route.length) return null;
    routesByActor[actorId] = route;
  }
  return routesByActor;
};

const getActorRoles = (definition, actorIds) => Object.fromEntries(actorIds.map((actorId, index) => [
  actorId,
  index === 0 && definition.clips.host ? "host" : index > 0 && definition.clips.visitor ? "visitor" : "actor",
]));

const selectAnchors = (definition, leaderId, random) => {
  const resolved = definition.targetAnchors.map((anchorId) => resolveAnchor(anchorId, leaderId));
  if (definition.participants.max === 1 && resolved.length > 1) return [pick(resolved, random)];
  return resolved.slice(0, definition.participants.min);
};

const selectParticipants = ({ definition, primarySlotId, eligibleIds }) => {
  const required = Array.isArray(definition.requiredActorIds) ? definition.requiredActorIds : [];
  if (required.some((slotId) => !eligibleIds.includes(slotId))) return null;
  const leaders = required.length ? required : [primarySlotId];
  const actorIds = unique([...leaders, ...eligibleIds.filter((slotId) => !leaders.includes(slotId))])
    .slice(0, definition.participants.min);
  return actorIds.length === definition.participants.min ? actorIds : null;
};

export function chooseOfficeEvent({ state, profiles, random, now } = {}) {
  if (!isPlainObject(state) || !isPlainObject(state.characters) || !isPlainObject(profiles) || typeof random !== "function") return null;
  const eligibleIds = Object.keys(state.characters).filter((slotId) => isInterruptible(state.characters[slotId]));
  if (!eligibleIds.length) return null;

  const primarySlotId = pick(eligibleIds, random);
  if (!primarySlotId) return null;
  const profile = getProfile(primarySlotId, state.characters[primarySlotId], profiles);
  const activityId = chooseActivityId({ state, profile, random });
  const definition = getActivityDefinition(activityId);
  if (!definition) return null;
  const actorIds = selectParticipants({ definition, primarySlotId, eligibleIds });
  if (!actorIds) return null;
  const targetAnchors = selectAnchors(definition, actorIds[0], random);
  if (!targetAnchors.length || targetAnchors.some((anchorId) => !anchorPoint(definition.sceneId, anchorId))) return null;

  const startedAt = Number.isFinite(now) ? now : Date.now();
  const duration = definition.durationMs.min + Math.floor(clampRandom(random()) * (definition.durationMs.max - definition.durationMs.min + 1));
  const endsAt = startedAt + duration;
  const reservationGroupId = `office-${activityId}-${startedAt}-${actorIds.join("-")}`;
  const reservationCheck = reserveAnchors(state.reservations || {}, {
    sceneId: definition.sceneId,
    reservationGroupId,
    slotId: actorIds[0],
    anchorIds: targetAnchors,
    now: startedAt,
    expiresAt: endsAt,
  });
  if (!reservationCheck) return null;

  const routesByActor = buildRoutes({ actorIds, characters: state.characters, sceneId: definition.sceneId, anchors: targetAnchors });
  if (!routesByActor) return null;

  const variant = definition.propState.variants.length ? pick(definition.propState.variants, random) : "";
  const eventId = reservationGroupId;
  return {
    activityId,
    actorIds,
    sceneId: definition.sceneId,
    targetAnchors,
    reservationGroupId,
    routesByActor,
    propState: { category: definition.propState.category, variant, actorRoles: getActorRoles(definition, actorIds) },
    semanticContext: { eventId, activityId, status: definition.status, semanticFallback: { ...definition.semanticFallback } },
    startedAt,
    endsAt,
  };
}

export function buildConversationSession({ memberIds, anchorId, now, random } = {}) {
  if (!Array.isArray(memberIds) || memberIds.length < 2 || memberIds.length > 5 || new Set(memberIds).size !== memberIds.length || typeof anchorId !== "string" || !anchorId || typeof random !== "function") return null;
  const normalizedMemberIds = memberIds.map(String);
  const idSeed = Math.floor(clampRandom(random()) * 1_000_000);
  const topic = pick(CONVERSATION_TOPICS, random) || CONVERSATION_TOPICS[0];
  return {
    id: `office-chat-${now}-${anchorId}-${idSeed}-${normalizedMemberIds.join("-")}`,
    memberIds: [...normalizedMemberIds],
    topic,
    anchorId,
    anchorOwnerId: normalizedMemberIds[0],
    transcript: [],
    turnIndex: 0,
    requestSequence: 0,
    status: "active",
    startedAt: now,
    endsAt: now + 45_000,
    bubbleQueue: [],
    promptContext: { anchorId, topic, members: [...normalizedMemberIds] },
    lastResponse: null,
  };
}
