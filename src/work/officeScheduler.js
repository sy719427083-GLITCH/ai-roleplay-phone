import { getActivityDefinition, OFFICE_ACTIVITY_MANIFEST } from "./officeActivityManifest.js";
import { getSceneAnchor } from "./officeSceneManifest.js";
import { reserveAnchors } from "./officeReservations.js";
import { buildWorldRoute } from "./officeWorld.js";
import { isLegalCharacterPosition } from "./officePathfinding.js";

const INTERRUPTIBLE_PHASES = new Set(["idle", "working"]);
const BLOCKED_ACTIVITIES = new Set(["returning", "chatting", "eating", "gaming", "slacking"]);
const ACTIVITY_ORDER = Object.freeze(Object.keys(OFFICE_ACTIVITY_MANIFEST));
const CONVERSATION_TOPICS = Object.freeze(["项目进度", "午饭时间", "周末安排", "办公室日常"]);
const CONVERSATION_ACTIVITY_IDS = new Set(["chatting", "diningChat", "sofaChat"]);
const DESK_VISITOR_SUFFIXES = Object.freeze(["visitor-front", "visitor-left", "visitor-right"]);
const SIDE_DESK_VISITOR_SUFFIXES = Object.freeze(["visitor-left", "visitor-right"]);
const CONVERSATION_FALLBACKS = Object.freeze({
  chatting: Object.freeze([
    Object.freeze({ sceneId: "office", locationId: "whiteboard", anchors: ["whiteboard:1", "whiteboard:2", "whiteboard:3"] }),
    Object.freeze({ sceneId: "lounge", locationId: "dining", anchors: ["dining:seat-1", "dining:seat-2", "dining:seat-3", "dining:seat-4"] }),
    Object.freeze({ sceneId: "lounge", locationId: "sofa", anchors: ["sofa:visitor-2", "tv:view"] }),
  ]),
  diningChat: Object.freeze([
    Object.freeze({ sceneId: "lounge", locationId: "dining", anchors: ["dining:seat-1", "dining:seat-2", "dining:seat-3", "dining:seat-4"] }),
  ]),
  sofaChat: Object.freeze([
    Object.freeze({ sceneId: "lounge", locationId: "sofa", anchors: ["sofa:visitor-2", "tv:view"] }),
  ]),
});

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

const unwrapProfile = (candidate) => (
  isPlainObject(candidate?.profile) ? candidate.profile : candidate
);

const getProfile = (slotId, character, profiles) => unwrapProfile(
  profiles?.[slotId] || profiles?.[character?.profileId] || character?.profile || {},
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
  const hasWorldPosition = Object.hasOwn(character || {}, "sceneId") || Object.hasOwn(character || {}, "position");
  if (hasWorldPosition) {
    if (typeof character?.sceneId === "string" && Number.isFinite(point?.x) && Number.isFinite(point?.y)
      && isLegalCharacterPosition(character.sceneId, point)) {
      return { sceneId: character.sceneId, x: point.x, y: point.y };
    }
    return null;
  }
  return getHomePoint(slotId);
};

const hasSamePoint = (left, right) => left?.sceneId === right?.sceneId && left?.x === right?.x && left?.y === right?.y;

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

const selectAnchors = (definition, leaderId, participantCount, random) => {
  const resolved = definition.targetAnchors.map((anchorId) => resolveAnchor(anchorId, leaderId));
  if (definition.participants.max === 1 && resolved.length > 1) return [pick(resolved, random)];
  return resolved.slice(0, participantCount);
};

const selectParticipantCount = (definition, random) => (
  definition.participants.min + Math.floor(clampRandom(random()) * (definition.participants.max - definition.participants.min + 1))
);

const selectParticipants = ({ definition, primarySlotId, eligibleIds, participantCount }) => {
  if (definition.rolePolicy === "employeeHostBossVisitor") {
    if (!eligibleIds.includes("boss")) return null;
    const hostId = primarySlotId !== "boss" && eligibleIds.includes(primarySlotId)
      ? primarySlotId
      : eligibleIds.find((slotId) => slotId !== "boss");
    return hostId && participantCount === 2 ? [hostId, "boss"] : null;
  }
  const required = Array.isArray(definition.requiredActorIds) ? definition.requiredActorIds : [];
  if (required.some((slotId) => !eligibleIds.includes(slotId))) return null;
  const leaders = required.length ? required : [primarySlotId];
  const actorIds = unique([...leaders, ...eligibleIds.filter((slotId) => !leaders.includes(slotId))])
    .slice(0, participantCount);
  return actorIds.length === participantCount ? actorIds : null;
};

const createAnchorByMember = (actorIds, anchors) => Object.fromEntries(actorIds.map((slotId, index) => [slotId, anchors[index]]));

const buildConversationPlans = ({ activityId, actorIds, characters }) => {
  const [hostId, ...visitorIds] = actorIds;
  const plans = [];
  const hostHome = getHomePoint(hostId);
  const hostPoint = getActorPoint(hostId, characters[hostId]);
  const sideVisitorSuffix = SIDE_DESK_VISITOR_SUFFIXES.find((suffix) => anchorPoint("office", `${hostId}:${suffix}`));
  const visitorSuffixes = visitorIds.length === 1
    ? sideVisitorSuffix ? [sideVisitorSuffix] : []
    : DESK_VISITOR_SUFFIXES.slice(0, visitorIds.length);
  const visitorAnchors = visitorSuffixes.map((suffix) => `${hostId}:${suffix}`);
  if (activityId === "chatting" && visitorAnchors.length === visitorIds.length && hasSamePoint(hostPoint, hostHome)
    && visitorAnchors.every((anchorId) => anchorPoint("office", anchorId))) {
    const routesByActor = buildRoutes({ actorIds: visitorIds, characters, sceneId: "office", anchors: visitorAnchors });
    if (routesByActor) {
      plans.push({
        hostId,
        visitorIds,
        sceneId: "office",
        locationId: `${hostId}:desk`,
        targetAnchors: visitorAnchors,
        anchorByMember: { [hostId]: `${hostId}:seat-approach`, ...createAnchorByMember(visitorIds, visitorAnchors) },
        routesByActor,
      });
    }
  }

  for (const fallback of CONVERSATION_FALLBACKS[activityId] || []) {
    const anchors = fallback.anchors.slice(0, actorIds.length);
    if (anchors.length !== actorIds.length || anchors.some((anchorId) => !anchorPoint(fallback.sceneId, anchorId))) continue;
    const routesByActor = buildRoutes({ actorIds, characters, sceneId: fallback.sceneId, anchors });
    if (!routesByActor) continue;
    plans.push({
      hostId,
      visitorIds,
      sceneId: fallback.sceneId,
      locationId: fallback.locationId,
      targetAnchors: anchors,
      anchorByMember: createAnchorByMember(actorIds, anchors),
      routesByActor,
    });
  }
  return plans;
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
  const participantCount = selectParticipantCount(definition, random);
  const actorIds = selectParticipants({ definition, primarySlotId, eligibleIds, participantCount });
  if (!actorIds) return null;

  const startedAt = Number.isFinite(now) ? now : Date.now();
  const duration = definition.durationMs.min + Math.floor(clampRandom(random()) * (definition.durationMs.max - definition.durationMs.min + 1));
  const endsAt = startedAt + duration;
  const reservationGroupId = `office-${activityId}-${startedAt}-${actorIds.join("-")}`;
  const isConversationActivity = CONVERSATION_ACTIVITY_IDS.has(activityId);
  const conversationPlans = isConversationActivity
    ? buildConversationPlans({ activityId, actorIds, characters: state.characters }) : [];
  let conversationPlan = null;
  let targetAnchors = conversationPlan?.targetAnchors || selectAnchors(definition, actorIds[0], participantCount, random);
  let sceneId = conversationPlan?.sceneId || definition.sceneId;
  let routesByActor = null;
  let reservationCheck = null;
  if (isConversationActivity) {
    for (const candidate of conversationPlans) {
      const reservation = reserveAnchors(state.reservations || {}, {
        sceneId: candidate.sceneId,
        reservationGroupId,
        slotId: actorIds[0],
        anchorIds: candidate.targetAnchors,
        now: startedAt,
        expiresAt: endsAt,
      });
      if (!reservation) continue;
      conversationPlan = candidate;
      targetAnchors = candidate.targetAnchors;
      sceneId = candidate.sceneId;
      routesByActor = candidate.routesByActor;
      reservationCheck = reservation;
      break;
    }
  } else {
    if (!targetAnchors.length || targetAnchors.some((anchorId) => !anchorPoint(sceneId, anchorId))) return null;
    routesByActor = buildRoutes({ actorIds, characters: state.characters, sceneId, anchors: targetAnchors });
    if (!routesByActor) return null;
    reservationCheck = reserveAnchors(state.reservations || {}, {
      sceneId,
      reservationGroupId,
      slotId: actorIds[0],
      anchorIds: targetAnchors,
      now: startedAt,
      expiresAt: endsAt,
    });
  }
  if (!reservationCheck) return null;

  const variant = definition.propState.variants.length ? pick(definition.propState.variants, random) : "";
  const eventId = reservationGroupId;
  const event = {
    activityId,
    actorIds,
    sceneId,
    targetAnchors,
    reservationGroupId,
    routesByActor,
    propState: { category: definition.propState.category, variant, actorRoles: getActorRoles(definition, actorIds) },
    semanticContext: { eventId, activityId, status: definition.status, semanticFallback: { ...definition.semanticFallback } },
    startedAt,
    endsAt,
  };
  if (conversationPlan) Object.assign(event, {
    hostId: conversationPlan.hostId,
    visitorIds: [...conversationPlan.visitorIds],
    locationId: conversationPlan.locationId,
    anchorByMember: { ...conversationPlan.anchorByMember },
  });
  state.reservations = reservationCheck;
  return event;
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
