import { OFFICE_SCENES, getSceneAnchor } from "./officeSceneManifest.js";
import { isLegalCharacterPosition } from "./officePathfinding.js";
import { releaseReservationGroup } from "./officeReservations.js";
import { buildWorldRoute } from "./officeWorld.js";

const OFFICE_MODE = "free";
const IDLE_STATUS = "空闲中";
const RETURN_STATUS = "返回工位";
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
    reservationGroupId: "",
    activityStartedAt: 0,
    activityEndsAt: 0,
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
  if (!isWorldPoint(cloned[0]) || !isLegalCharacterPosition(cloned[0].sceneId, cloned[0])) return null;
  for (const entry of cloned) {
    if (entry?.transition === true) {
      if (!hasText(entry.from?.sceneId) || !hasText(entry.from?.anchorId)
        || !hasText(entry.to?.sceneId) || !hasText(entry.to?.anchorId)) return null;
      continue;
    }
    if (!isWorldPoint(entry) || !isLegalCharacterPosition(entry.sceneId, entry)) return null;
  }
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

const normalizeConversation = (session = {}, now = 0) => ({
  id: String(session.id || ""),
  memberIds: Array.isArray(session.memberIds) ? [...session.memberIds] : [],
  topic: String(session.topic || ""),
  anchorId: String(session.anchorId || ""),
  anchorOwnerId: String(session.anchorOwnerId || ""),
  reservationGroupId: String(session.reservationGroupId || ""),
  sceneId: String(session.sceneId || ""),
  targetAnchorIds: Array.isArray(session.targetAnchorIds) ? [...session.targetAnchorIds] : [],
  transcript: Array.isArray(session.transcript) ? deepClone(session.transcript) : [],
  turnIndex: Number.isFinite(session.turnIndex) ? session.turnIndex : 0,
  requestSequence: Number.isFinite(session.requestSequence) ? session.requestSequence : 0,
  status: String(session.status || "active"),
  startedAt: Number.isFinite(session.startedAt) ? session.startedAt : now,
  endsAt: Number.isFinite(session.endsAt) ? session.endsAt : 0,
  bubbleQueue: Array.isArray(session.bubbleQueue) ? deepClone(session.bubbleQueue) : [],
  promptContext: isPlainObject(session.promptContext) ? deepClone(session.promptContext) : {},
  lastResponse: isPlainObject(session.lastResponse) ? deepClone(session.lastResponse) : null,
});

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

const startReturnCharacter = (character, route, now, position, allowDirectFallback = false) => {
  const currentPoint = position || { sceneId: character.sceneId, ...character.position };
  let clonedRoute = cloneWorldRoute(route);
  if (!clonedRoute || !hasSamePoint(clonedRoute[0], currentPoint)) {
    if (!allowDirectFallback) return character;
    const home = getHomePoint(character.slotId);
    clonedRoute = cloneWorldRoute(buildWorldRoute({ from: currentPoint, to: home }));
    if (!clonedRoute || !hasSamePoint(clonedRoute[0], currentPoint)) return character;
  }
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
    conversations: deepClone(state.conversations || {}),
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
        const point = getActionPoint(action, character.sceneId);
        const segmentIndex = Number.isInteger(action.segmentIndex) ? action.segmentIndex : character.routeSegmentIndex;
        if (!point || point.sceneId !== character.sceneId || segmentIndex < character.routeSegmentIndex) return character;
        return { ...character, position: clonePoint(point), routeSegmentIndex: segmentIndex };
      });

    case "CROSS_SCENE_DOOR":
      return withCharacter(state, action.slotId, (character) => {
        if (!MOVING_PHASES.has(character.phase)) return character;
        const transition = character.route.find((entry) => transitionMatches(entry, action.transition));
        if (!transition || transition.from.sceneId !== character.sceneId) return character;
        const point = getActionPoint(action, transition.to.sceneId);
        if (!point || point.sceneId !== transition.to.sceneId) return character;
        const segmentIndex = Number.isInteger(action.segmentIndex) ? action.segmentIndex : character.routeSegmentIndex;
        return { ...character, sceneId: point.sceneId, position: clonePoint(point), routeSegmentIndex: segmentIndex };
      });

    case "ARRIVE_ACTIVITY":
      return withCharacter(state, action.slotId, (character) => {
        if (character.phase !== "walkingToActivity") return character;
        const point = getActionPoint(action, character.sceneId);
        const target = point && getSceneAnchor(point.sceneId, character.targetAnchorId);
        if (!point || !target || !hasSamePoint(point, { sceneId: point.sceneId, ...target })) return character;
        return {
          ...character,
          sceneId: point.sceneId,
          position: clonePoint(point),
          phase: character.activity,
          status: String(character.semanticContext?.status || "活动中"),
          route: [],
          routeSegmentIndex: 0,
          routeStartedAt: 0,
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
      const nextCharacter = startReturnCharacter(character, action.route, action.now ?? state.now, point);
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
      return withCharacter(state, action.slotId, (character) => (
        character.phase === "returning" ? getIdleCharacter(action.slotId, state.assignments[action.slotId]) : character
      ));

    case "OPEN_CONVERSATION": {
      const conversation = normalizeConversation(action.session, state.now);
      if (!conversation.id || state.conversations[conversation.id]) return state;
      if (conversation.memberIds.length < 2 || conversation.memberIds.some((slotId) => (
        !state.characters[slotId] || state.characters[slotId].conversationId
      ))) return state;
      let characters = state.characters;
      for (const slotId of conversation.memberIds) {
        const current = characters[slotId];
        characters = {
          ...characters,
          [slotId]: {
            ...current,
            phase: "chatting",
            activity: "chatting",
            status: "闲聊中",
            conversationId: conversation.id,
            reservationGroupId: conversation.reservationGroupId || current.reservationGroupId,
            activityStartedAt: conversation.startedAt,
            activityEndsAt: conversation.endsAt,
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
      return withConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        transcript: [...conversation.transcript, deepClone(action.entry)],
      }));

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
      let characters = state.characters;
      for (const slotId of conversation.memberIds) {
        const current = characters[slotId];
        if (!current || current.conversationId !== conversation.id) continue;
        const next = startReturnCharacter(
          current,
          action.returnRoutes?.[slotId],
          action.now ?? state.now,
          null,
          true,
        );
        characters = { ...characters, [slotId]: next };
      }
      return {
        ...state,
        reservations: conversation.reservationGroupId
          ? releaseReservationGroup(state.reservations, conversation.reservationGroupId)
          : state.reservations,
        conversations,
        characters,
      };
    }

    default:
      return state;
  }
}
