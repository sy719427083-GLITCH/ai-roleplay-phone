import { OFFICE_SCENES, getSceneAnchor } from "./officeSceneManifest.js";
import { isLegalCharacterPosition } from "./officePathfinding.js";
import { releaseReservationGroup } from "./officeReservations.js";
import { appendConversationRecord, restoreConversationRecords } from "./officeConversationRecords.js";
import { buildWorldRoute, isValidWorldRoute, sampleWorldRoute } from "./officeWorld.js";

const OFFICE_MODE = "free";
const IDLE_STATUS = "空闲中";
const RETURN_STATUS = "返回工位";
const DEFAULT_ROUTE_SPEED = 180;
const ROUTE_SAMPLE_EPSILON = 0.01;
const MOVING_PHASES = new Set(["walkingToActivity", "returning"]);

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const deepClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const slotIdsFromAssignments = (assignments = {}) => Object.keys(assignments);
const hasText = (value) => typeof value === "string" && value.length > 0;
const isFinitePoint = (value) => value && Number.isFinite(value.x) && Number.isFinite(value.y);
const isWorldPoint = (value) => hasText(value?.sceneId) && isFinitePoint(value);
const clonePoint = (value) => ({ x: value.x, y: value.y });
const homeAnchorIdFor = (slotId) => `${slotId}:seat-approach`;

const getHomePoint = (slotId) => {
  const anchor = getSceneAnchor("office", homeAnchorIdFor(slotId)) || getSceneAnchor("office", "entry");
  return { sceneId: "office", x: anchor.x, y: anchor.y };
};

const normalizeAssignments = (assignments = {}) => Object.fromEntries(
  slotIdsFromAssignments(assignments).map((slotId) => [slotId, {
    profileId: assignments[slotId]?.profileId || "",
    profile: deepClone(assignments[slotId]?.profile) || null,
  }]),
);

const getIdleCharacter = (slotId, assignment = {}) => {
  const home = getHomePoint(slotId);
  return {
    slotId,
    profileId: assignment.profileId || "",
    profile: deepClone(assignment.profile) || null,
    sceneId: home.sceneId,
    position: clonePoint(home),
    homeAnchorId: homeAnchorIdFor(slotId),
    targetAnchorId: "",
    phase: "idle",
    activity: "idle",
    status: IDLE_STATUS,
    conversationId: "",
    route: [],
    routeSegmentIndex: 0,
    routeStartedAt: 0,
    routeSpeed: 0,
    reservationGroupId: "",
    activityStartedAt: 0,
    activityEndsAt: 0,
    facing: "front",
    propState: null,
    semanticContext: null,
  };
};

const monotonicCounterValue = (candidate, current) => (
  Number.isInteger(candidate) && candidate >= 0 && candidate >= current ? candidate : current
);

const INVALID_SERIALIZABLE_VALUE = Symbol("invalid serializable value");

const isPlainRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const cloneSerializableValue = (value, ancestors) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : INVALID_SERIALIZABLE_VALUE;
  if (typeof value !== "object" || ancestors.has(value)) return INVALID_SERIALIZABLE_VALUE;

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return INVALID_SERIALIZABLE_VALUE;
      const cloned = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) return INVALID_SERIALIZABLE_VALUE;
        const item = cloneSerializableValue(value[index], ancestors);
        if (item === INVALID_SERIALIZABLE_VALUE) return INVALID_SERIALIZABLE_VALUE;
        cloned.push(item);
      }
      return cloned;
    }

    if (!isPlainRecord(value)) return INVALID_SERIALIZABLE_VALUE;
    const cloned = Object.create(Object.getPrototypeOf(value));
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return INVALID_SERIALIZABLE_VALUE;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) return INVALID_SERIALIZABLE_VALUE;
      const propertyValue = cloneSerializableValue(descriptor.value, ancestors);
      if (propertyValue === INVALID_SERIALIZABLE_VALUE) return INVALID_SERIALIZABLE_VALUE;
      cloned[key] = propertyValue;
    }
    return cloned;
  } finally {
    ancestors.delete(value);
  }
};

const cloneReservationMap = (reservations) => {
  try {
    if (!isPlainRecord(reservations)) return null;
    const cloned = cloneSerializableValue(reservations, new WeakSet());
    if (cloned === INVALID_SERIALIZABLE_VALUE) return null;
    for (const [anchorId, reservation] of Object.entries(cloned)) {
      if (!isPlainRecord(reservation)) return null;
      if (reservation.anchorId !== anchorId || typeof reservation.slotId !== "string") return null;
    }
    return cloned;
  } catch {
    return null;
  }
};

const cloneWorldRoute = (route) => {
  if (!Array.isArray(route) || !route.length) return null;
  const cloned = deepClone(route);
  if (!isValidWorldRoute(cloned)) return null;
  return cloned;
};

const getRouteEnd = (route) => {
  for (let index = route.length - 1; index >= 0; index -= 1) {
    if (isWorldPoint(route[index])) return route[index];
    const transition = route[index];
    if (transition?.transition === true) {
      const anchor = getSceneAnchor(transition.to.sceneId, transition.to.anchorId);
      if (anchor) return { sceneId: transition.to.sceneId, x: anchor.x, y: anchor.y };
    }
  }
  return null;
};

const getActionPoint = (action, fallbackSceneId) => {
  const source = action?.position;
  const sceneId = hasText(source?.sceneId) ? source.sceneId : fallbackSceneId;
  if (!hasText(sceneId) || !isFinitePoint(source) || !isLegalCharacterPosition(sceneId, source)) return null;
  return { sceneId, x: source.x, y: source.y };
};

const hasSamePoint = (left, right, epsilon = 0.001) => (
  left?.sceneId === right?.sceneId
  && isFinitePoint(left)
  && isFinitePoint(right)
  && Math.abs(left.x - right.x) <= epsilon
  && Math.abs(left.y - right.y) <= epsilon
);

const getRouteSpeed = (value) => (
  Number.isFinite(value) && value > 0 ? value : DEFAULT_ROUTE_SPEED
);

const getAuthoritativeActionSample = (character, action) => {
  if (!Number.isFinite(action?.now) || !Array.isArray(character?.route) || !character.route.length) return null;
  const sample = sampleWorldRoute({
    route: character.route,
    startedAt: character.routeStartedAt,
    now: action.now,
    speed: getRouteSpeed(character.routeSpeed),
  });
  const point = getActionPoint(action, sample.sceneId);
  if (!point || !hasSamePoint(point, sample, ROUTE_SAMPLE_EPSILON)) return null;
  if (action.segmentIndex !== undefined && (
    !Number.isInteger(action.segmentIndex) || action.segmentIndex !== sample.segmentIndex
  )) return null;
  return sample;
};

const withCharacter = (state, slotId, updater) => {
  const current = state.characters[slotId];
  if (!current) return state;
  const next = updater(current);
  if (next === current) return state;
  return {
    ...state,
    characters: { ...state.characters, [slotId]: next },
  };
};

const uniqueMemberIds = (value) => Array.isArray(value)
  ? [...new Set(value.filter((slotId) => hasText(slotId)))] : [];

const normalizeConversation = (session = {}, now = 0) => {
  const memberIds = uniqueMemberIds(session.memberIds);
  const hostId = hasText(session.hostId) && memberIds.includes(session.hostId) ? session.hostId : memberIds[0] || "";
  const visitorIds = uniqueMemberIds(session.visitorIds).filter((slotId) => slotId !== hostId && memberIds.includes(slotId));
  const normalizedVisitorIds = visitorIds.length ? visitorIds : memberIds.filter((slotId) => slotId !== hostId);
  const anchorByMember = isPlainObject(session.anchorByMember) ? deepClone(session.anchorByMember) : {};
  return {
    id: String(session.id || ""),
    workSessionId: String(session.workSessionId || ""),
    hostId,
    visitorIds: normalizedVisitorIds,
    memberIds,
    topic: String(session.topic || "办公室日常"),
    anchorId: String(session.anchorId || ""),
    anchorOwnerId: String(session.anchorOwnerId || hostId),
    reservationGroupId: String(session.reservationGroupId || ""),
    sceneId: String(session.sceneId || "office"),
    locationId: String(session.locationId || session.anchorId || "office"),
    anchorByMember,
    targetAnchorIds: Array.isArray(session.targetAnchorIds) ? [...session.targetAnchorIds] : [],
    participantSnapshots: Array.isArray(session.participantSnapshots) ? deepClone(session.participantSnapshots) : [],
    transcript: Array.isArray(session.transcript) ? deepClone(session.transcript) : [],
    turnIndex: Number.isFinite(session.turnIndex) ? session.turnIndex : 0,
    requestSequence: Number.isFinite(session.requestSequence) ? session.requestSequence : 0,
    status: String(session.status || "active"),
    activityId: String(session.activityId || "chatting"),
    activityStatus: String(session.activityStatus || "闲聊中"),
    startedAt: Number.isFinite(session.startedAt) ? session.startedAt : now,
    endsAt: Number.isFinite(session.endsAt) ? session.endsAt : 0,
    bubbleQueue: Array.isArray(session.bubbleQueue) ? deepClone(session.bubbleQueue) : [],
    promptContext: isPlainObject(session.promptContext) ? deepClone(session.promptContext) : {},
    lastResponse: isPlainObject(session.lastResponse) ? deepClone(session.lastResponse) : null,
  };
};

const normalizeConversationEntry = (entry, conversation) => {
  if (!isPlainObject(entry) || !conversation.memberIds.includes(entry.speakerId) || typeof entry.text !== "string") return null;
  const text = Array.from(entry.text.trim()).slice(0, 80).join("");
  return text ? { speakerId: entry.speakerId, text } : null;
};

const getConversationSnapshots = (state, conversation) => {
  if (conversation.participantSnapshots.length === conversation.memberIds.length
    && conversation.participantSnapshots.every((snapshot) => conversation.memberIds.includes(snapshot?.memberId))) {
    return deepClone(conversation.participantSnapshots);
  }
  return conversation.memberIds.map((memberId) => ({
    ...(deepClone(state.assignments[memberId]?.profile) || {}),
    memberId,
    profileId: state.assignments[memberId]?.profileId || memberId,
  }));
};

const buildConversationRecord = (state, conversation, now) => ({
  conversationId: conversation.id,
  workSessionId: conversation.workSessionId || state.workSessionId,
  sceneId: conversation.sceneId || "office",
  locationId: conversation.locationId || conversation.anchorId || "office",
  topic: conversation.topic || "办公室日常",
  participantSnapshots: getConversationSnapshots(state, conversation),
  startedAt: conversation.startedAt,
  endedAt: Number.isFinite(now) ? now : state.now,
  transcript: conversation.transcript,
});

const isAtHome = (character) => {
  const home = getHomePoint(character.slotId);
  return character.sceneId === home.sceneId && hasSamePoint({ sceneId: character.sceneId, ...character.position }, home);
};

const hasPhysicalConversationPlan = (conversation) => (
  Boolean(conversation.reservationGroupId)
  && conversation.targetAnchorIds.length > 0
  && conversation.memberIds.every((slotId) => hasText(conversation.anchorByMember[slotId]))
);

const hasConversationReservations = (state, conversation) => (
  conversation.targetAnchorIds.every((anchorId) => (
    state.reservations[anchorId]?.reservationGroupId === conversation.reservationGroupId
  ))
);

const isAtConversationAnchor = (character, conversation, slotId) => {
  const anchor = getSceneAnchor(conversation.sceneId, conversation.anchorByMember[slotId]);
  return Boolean(anchor) && character.sceneId === conversation.sceneId
    && hasSamePoint({ sceneId: character.sceneId, ...character.position }, { sceneId: conversation.sceneId, ...anchor });
};

const conversationFacing = (conversation) => {
  const hostAnchor = getSceneAnchor(conversation.sceneId, conversation.anchorByMember[conversation.hostId]);
  const visitorAnchor = getSceneAnchor(conversation.sceneId, conversation.anchorByMember[conversation.visitorIds[0]]);
  if (!hostAnchor || !visitorAnchor) return "front";
  const deltaX = visitorAnchor.x - hostAnchor.x;
  const deltaY = visitorAnchor.y - hostAnchor.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX < 0 ? "left" : "right";
  return deltaY < 0 ? "back" : "front";
};

const isConversationReady = (state, conversation) => (
  hasConversationReservations(state, conversation)
  && conversation.memberIds.every((slotId) => {
    const character = state.characters[slotId];
    const isDeskHost = conversation.locationId.endsWith(":desk") && slotId === conversation.hostId;
    return Boolean(character)
      && !character.conversationId
      && character.reservationGroupId === conversation.reservationGroupId
      && character.activity === conversation.activityId
      && character.phase === (isDeskHost ? "waitingForConversation" : conversation.activityId)
      && isAtConversationAnchor(character, conversation, slotId);
  })
);

const withConversation = (state, conversationId, updater) => {
  const current = state.conversations[conversationId];
  if (!current) return state;
  const next = updater(current);
  if (next === current) return state;
  return { ...state, conversations: { ...state.conversations, [conversationId]: next } };
};

const transitionMatches = (left, right) => (
  left?.transition === true
  && right?.transition === true
  && left.from?.sceneId === right.from?.sceneId
  && left.from?.anchorId === right.from?.anchorId
  && left.to?.sceneId === right.to?.sceneId
  && left.to?.anchorId === right.to?.anchorId
);

const startReturnCharacter = (character, route, now, position, allowDirectFallback = false, speed) => {
  const currentPoint = position || { sceneId: character.sceneId, ...character.position };
  let clonedRoute = cloneWorldRoute(route);
  if (!clonedRoute || !hasSamePoint(clonedRoute[0], currentPoint)) {
    if (!allowDirectFallback) return character;
    const home = getHomePoint(character.slotId);
    clonedRoute = cloneWorldRoute(buildWorldRoute({ from: currentPoint, to: home }));
    if (!clonedRoute || !hasSamePoint(clonedRoute[0], currentPoint)) return character;
  }
  const home = getHomePoint(character.slotId);
  if (!hasSamePoint(getRouteEnd(clonedRoute), home)) return character;
  return {
    ...character,
    sceneId: currentPoint.sceneId,
    position: clonePoint(currentPoint),
    phase: "returning",
    activity: "returning",
    status: RETURN_STATUS,
    conversationId: "",
    targetAnchorId: character.homeAnchorId,
    route: clonedRoute,
    routeSegmentIndex: 0,
    routeStartedAt: Number.isFinite(now) ? now : 0,
    routeSpeed: getRouteSpeed(speed),
    reservationGroupId: "",
    activityEndsAt: 0,
  };
};

export const createWorkSessionId = (now = 0, cryptoSource = globalThis.crypto) => {
  const timestamp = Number.isFinite(now) ? now : 0;
  if (typeof cryptoSource?.randomUUID === "function") return `work-session-${timestamp}-${cryptoSource.randomUUID()}`;
  if (typeof cryptoSource?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoSource.getRandomValues(bytes);
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `work-session-${timestamp}-${token}`;
  }
  throw new Error("Secure random generation is unavailable for work session IDs.");
};

export function createOfficeState({ assignments, now = 0, durationMs = 0, workSessionId = "" }) {
  const normalizedAssignments = normalizeAssignments(assignments);
  return {
    mode: OFFICE_MODE,
    now,
    durationMs,
    workSessionId: String(workSessionId || createWorkSessionId(now)),
    visibleSceneId: "office",
    assignments: normalizedAssignments,
    reservations: {},
    conversations: {},
    conversationRecords: [],
    characters: Object.fromEntries(slotIdsFromAssignments(normalizedAssignments).map((slotId) => [
      slotId,
      getIdleCharacter(slotId, normalizedAssignments[slotId]),
    ])),
  };
}

export function serializeOfficeState(state) {
  return JSON.stringify({
    mode: state.mode,
    now: state.now,
    durationMs: state.durationMs,
    workSessionId: state.workSessionId,
    visibleSceneId: OFFICE_SCENES[state.visibleSceneId] ? state.visibleSceneId : "office",
    conversationRecords: restoreConversationRecords(state.conversationRecords || []),
  });
}

export function restoreOfficeState(raw, assignments, now = 0) {
  const parsed = typeof raw === "string"
    ? (() => {
        try { return JSON.parse(raw); } catch { return {}; }
      })()
    : (isPlainObject(raw) ? raw : {});

  const base = createOfficeState({
    assignments,
    now,
    durationMs: Number.isFinite(parsed.durationMs) ? parsed.durationMs : 0,
    workSessionId: String(parsed.workSessionId || ""),
  });
  return {
    ...base,
    mode: String(parsed.mode || base.mode),
    visibleSceneId: "office",
    conversations: {},
    conversationRecords: restoreConversationRecords(parsed.conversationRecords),
  };
}

export function officeReducer(state, action) {
  switch (action.type) {
    case "SET_MODE":
      return action.mode === state.mode ? state : { ...state, mode: action.mode };

    case "SET_VISIBLE_SCENE":
      if (!OFFICE_SCENES[action.sceneId] || action.sceneId === state.visibleSceneId) return state;
      return { ...state, visibleSceneId: action.sceneId };

    case "TICK":
      return action.now === state.now ? state : { ...state, now: action.now };

    case "SET_RESERVATIONS": {
      const reservations = cloneReservationMap(action.reservations);
      return reservations ? { ...state, reservations } : state;
    }

    case "ASSIGN_PROFILE": {
      if (!state.assignments[action.slotId]) return state;
      const source = action.assignment || { profileId: action.profileId, profile: action.profile };
      const assignment = { profileId: source?.profileId || "", profile: deepClone(source?.profile) || null };
      return {
        ...state,
        assignments: { ...state.assignments, [action.slotId]: assignment },
        characters: {
          ...state.characters,
          [action.slotId]: {
            ...state.characters[action.slotId],
            profileId: assignment.profileId,
            profile: assignment.profile,
          },
        },
      };
    }

    case "LOCK_CONVERSATION_HOST": {
      const conversation = normalizeConversation(action.session, state.now);
      const host = state.characters[conversation.hostId];
      if (!conversation.id || !conversation.locationId.endsWith(":desk") || !hasPhysicalConversationPlan(conversation)
        || !host || host.conversationId || !new Set(["idle", "working"]).has(host.phase)
        || !hasConversationReservations(state, conversation) || !isAtConversationAnchor(host, conversation, conversation.hostId)) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [conversation.hostId]: {
            ...host,
            phase: "waitingForConversation",
            activity: conversation.activityId,
            status: conversation.activityStatus,
            targetAnchorId: conversation.anchorByMember[conversation.hostId],
            reservationGroupId: conversation.reservationGroupId,
            activityStartedAt: conversation.startedAt,
            activityEndsAt: conversation.endsAt,
          },
        },
      };
    }

    case "START_WORLD_ROUTE":
      return withCharacter(state, action.slotId, (character) => {
        if (!hasText(action.activityId) || !hasText(action.targetAnchorId) || !hasText(action.reservationGroupId)) return character;
        if (!new Set(["idle", "working"]).has(character.phase) || character.conversationId) return character;
        const route = cloneWorldRoute(action.route);
        if (!route) return character;
        const routeStart = route[0];
        const current = { sceneId: character.sceneId, ...character.position };
        if (!hasSamePoint(routeStart, current)) return character;
        const routeEnd = getRouteEnd(route);
        const target = getSceneAnchor(routeEnd?.sceneId, action.targetAnchorId);
        if (!routeEnd || !target || !hasSamePoint(routeEnd, { sceneId: routeEnd.sceneId, ...target })) return character;
        return {
          ...character,
          phase: "walkingToActivity",
          activity: action.activityId,
          status: String(action.travelStatus || "前往活动地点"),
          targetAnchorId: action.targetAnchorId,
          route,
          routeSegmentIndex: 0,
          routeStartedAt: Number.isFinite(action.now) ? action.now : state.now,
          routeSpeed: getRouteSpeed(action.speed),
          reservationGroupId: action.reservationGroupId,
          activityStartedAt: Number.isFinite(action.now) ? action.now : state.now,
          activityEndsAt: Number.isFinite(action.endsAt) ? action.endsAt : 0,
          propState: isPlainObject(action.propState) ? deepClone(action.propState) : null,
          semanticContext: isPlainObject(action.semanticContext) ? deepClone(action.semanticContext) : null,
        };
      });

    case "ADVANCE_WORLD_ROUTE":
      return withCharacter(state, action.slotId, (character) => {
        if (!MOVING_PHASES.has(character.phase)) return character;
        const sample = getAuthoritativeActionSample(character, action);
        if (!sample || sample.done || sample.sceneId !== character.sceneId
          || sample.segmentIndex < character.routeSegmentIndex) return character;
        return { ...character, position: clonePoint(sample), routeSegmentIndex: sample.segmentIndex };
      });

    case "CROSS_SCENE_DOOR":
      return withCharacter(state, action.slotId, (character) => {
        if (!MOVING_PHASES.has(character.phase)) return character;
        const transition = character.route.find((entry) => transitionMatches(entry, action.transition));
        if (!transition || transition.from.sceneId !== character.sceneId) return character;
        const sample = getAuthoritativeActionSample(character, action);
        if (!sample || sample.sceneId !== transition.to.sceneId
          || sample.segmentIndex < character.routeSegmentIndex) return character;
        return { ...character, sceneId: sample.sceneId, position: clonePoint(sample), routeSegmentIndex: sample.segmentIndex };
      });

    case "ARRIVE_ACTIVITY":
      return withCharacter(state, action.slotId, (character) => {
        if (character.phase !== "walkingToActivity") return character;
        const sample = getAuthoritativeActionSample(character, action);
        const target = sample && getSceneAnchor(sample.sceneId, character.targetAnchorId);
        if (!sample?.done || !target || !hasSamePoint(sample, { sceneId: sample.sceneId, ...target })) return character;
        return {
          ...character,
          sceneId: sample.sceneId,
          position: clonePoint(sample),
          phase: character.activity,
          status: String(character.semanticContext?.status || "活动中"),
          route: [],
          routeSegmentIndex: 0,
          routeStartedAt: 0,
          routeSpeed: 0,
          activityStartedAt: Number.isFinite(action.now) ? action.now : state.now,
        };
      });

    case "SET_ACTIVITY_SEMANTICS": {
      if (!Array.isArray(action.actorIds) || !hasText(action.eventId) || !isPlainObject(action.detail)) return state;
      let characters = state.characters;
      for (const slotId of action.actorIds) {
        const current = characters[slotId];
        if (!current || current.semanticContext?.eventId !== action.eventId) continue;
        characters = {
          ...characters,
          [slotId]: {
            ...current,
            semanticContext: {
              ...current.semanticContext,
              eventId: action.eventId,
              subject: String(action.detail.subject || ""),
              summary: String(action.detail.summary || ""),
              insightOrResult: String(action.detail.insightOrResult || ""),
            },
          },
        };
      }
      return characters === state.characters ? state : { ...state, characters };
    }

    case "START_RETURN": {
      const character = state.characters[action.slotId];
      if (!character) return state;
      const point = getActionPoint(action, character.sceneId);
      const nextCharacter = startReturnCharacter(character, action.route, action.now ?? state.now, point, false, action.speed);
      if (nextCharacter === character) return state;
      const reservations = character.conversationId || !character.reservationGroupId
        ? state.reservations
        : releaseReservationGroup(state.reservations, character.reservationGroupId);
      return {
        ...state,
        reservations,
        characters: { ...state.characters, [action.slotId]: nextCharacter },
      };
    }

    case "FINISH_RETURN":
      return withCharacter(state, action.slotId, (character) => {
        if (character.phase !== "returning") return character;
        const sample = getAuthoritativeActionSample(character, action);
        const home = getHomePoint(action.slotId);
        if (!sample?.done || !hasSamePoint(sample, home)) return character;
        return getIdleCharacter(action.slotId, state.assignments[action.slotId]);
      });

    case "OPEN_CONVERSATION": {
      const conversation = normalizeConversation(action.session, state.now);
      if (!conversation.id || state.conversations[conversation.id]) return state;
      if (conversation.memberIds.length < 2 || conversation.memberIds.some((slotId) => (
        !state.characters[slotId] || state.characters[slotId].conversationId
      ))) return state;
      if (hasPhysicalConversationPlan(conversation) && !isConversationReady(state, conversation)) return state;
      let characters = state.characters;
      for (const slotId of conversation.memberIds) {
        const current = characters[slotId];
        characters = {
          ...characters,
          [slotId]: {
            ...current,
            phase: conversation.activityId,
            activity: conversation.activityId,
            status: conversation.activityStatus,
            conversationId: conversation.id,
            reservationGroupId: conversation.reservationGroupId || current.reservationGroupId,
            activityStartedAt: conversation.startedAt,
            activityEndsAt: conversation.endsAt,
            facing: slotId === conversation.hostId ? conversationFacing(conversation) : current.facing || "front",
          },
        };
      }
      return {
        ...state,
        conversations: { ...state.conversations, [conversation.id]: conversation },
        characters,
      };
    }

    case "APPEND_CONVERSATION":
      return withConversation(state, action.conversationId, (conversation) => {
        const entry = normalizeConversationEntry(action.entry, conversation);
        return entry ? { ...conversation, transcript: [...conversation.transcript, entry] } : conversation;
      });

    case "QUEUE_BUBBLE":
      return withConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        bubbleQueue: [...conversation.bubbleQueue, deepClone(action.bubble)],
      }));

    case "SHIFT_BUBBLE":
      return withConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        bubbleQueue: conversation.bubbleQueue.slice(1),
      }));

    case "UPDATE_CONVERSATION_IO":
      return withConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        requestSequence: monotonicCounterValue(action.requestSequence, conversation.requestSequence),
        turnIndex: monotonicCounterValue(action.turnIndex, conversation.turnIndex),
        promptContext: isPlainObject(action.promptContext) ? deepClone(action.promptContext) : conversation.promptContext,
        lastResponse: isPlainObject(action.lastResponse) ? deepClone(action.lastResponse) : conversation.lastResponse,
      }));

    case "CLOSE_CONVERSATION": {
      const conversation = state.conversations[action.conversationId];
      if (!conversation) return state;
      const conversations = { ...state.conversations };
      delete conversations[action.conversationId];
      const conversationRecords = appendConversationRecord(
        state.conversationRecords,
        buildConversationRecord(state, conversation, action.now ?? state.now),
      );
      let characters = state.characters;
      for (const slotId of conversation.memberIds) {
        const current = characters[slotId];
        if (!current || current.conversationId !== conversation.id) continue;
        const next = slotId === conversation.hostId && isAtHome(current)
          ? getIdleCharacter(slotId, state.assignments[slotId])
          : startReturnCharacter(current, action.returnRoutes?.[slotId], action.now ?? state.now, null, true);
        characters = { ...characters, [slotId]: next };
      }
      return {
        ...state,
        reservations: conversation.reservationGroupId
          ? releaseReservationGroup(state.reservations, conversation.reservationGroupId)
          : state.reservations,
        conversations,
        conversationRecords,
        characters,
      };
    }

    default:
      return state;
  }
}
