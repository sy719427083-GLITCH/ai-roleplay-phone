import {
  createLocalActivityDetail,
  createOfficeActivityEvent,
  mergeOfficeActivityDetail,
} from "./officeActivities.js";
import { releaseAnchor } from "./officeNavigation.js";

const OFFICE_MODE = "free";
const IDLE_STATUS = "空闲中";

export const ACTIVITY_STATUS = {
  working: "工作中",
  slacking: "摸鱼中",
  eating: "吃饭中",
  gaming: "游戏中",
  chatting: "闲聊中",
};

export const TRAVEL_STATUS = {
  eating: "前往用餐",
  chatting: "前往闲聊",
  meeting: "前往开会",
  returning: "返回工位",
};

const slotIdsFromAssignments = (assignments = {}) => Object.keys(assignments);

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const deepClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

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
  if (typeof value !== "object") return INVALID_SERIALIZABLE_VALUE;
  if (ancestors.has(value)) return INVALID_SERIALIZABLE_VALUE;

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return INVALID_SERIALIZABLE_VALUE;
      const keys = Reflect.ownKeys(value).filter((key) => key !== "length");
      if (keys.length !== value.length || keys.some((key) => typeof key !== "string")) {
        return INVALID_SERIALIZABLE_VALUE;
      }

      const cloned = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor?.enumerable || !("value" in descriptor)) return INVALID_SERIALIZABLE_VALUE;
        const item = cloneSerializableValue(descriptor.value, ancestors);
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
      Object.defineProperty(cloned, key, {
        value: propertyValue,
        enumerable: true,
        configurable: true,
        writable: true,
      });
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
      if (!Object.hasOwn(reservation, "anchorId") || !Object.hasOwn(reservation, "slotId")) return null;
      if (typeof reservation.anchorId !== "string" || reservation.anchorId !== anchorId) return null;
      if (typeof reservation.slotId !== "string") return null;
    }
    return cloned;
  } catch {
    return null;
  }
};

const getHomeNode = (slotId) => `${slotId}-home`;

const getIdleCharacter = (slotId, assignment = {}) => ({
  slotId,
  profileId: assignment.profileId || "",
  profile: assignment.profile || null,
  phase: "idle",
  activity: "idle",
  status: IDLE_STATUS,
  conversationId: "",
  positionNode: getHomeNode(slotId),
  homeNode: getHomeNode(slotId),
  homePosition: getHomeNode(slotId),
  route: [],
  routeIndex: 0,
  reservedAnchorId: "",
  activityStartedAt: 0,
  activityEndsAt: 0,
  previousActivity: "idle",
  props: {},
});

const normalizeAssignments = (assignments = {}) => Object.fromEntries(
  slotIdsFromAssignments(assignments).map((slotId) => [
    slotId,
    {
      profileId: assignments[slotId]?.profileId || "",
      profile: deepClone(assignments[slotId]?.profile) || null,
    },
  ]),
);

const normalizeCharacter = (slotId, assignment, input = {}) => ({
  ...getIdleCharacter(slotId, assignment),
  ...(isPlainObject(input) ? input : {}),
  slotId,
  profileId: assignment.profileId || "",
  profile: deepClone(assignment.profile) || null,
  homeNode: getHomeNode(slotId),
  homePosition: getHomeNode(slotId),
});

const normalizeConversation = (session = {}, now = 0) => ({
  id: String(session.id || ""),
  memberIds: Array.isArray(session.memberIds) ? [...session.memberIds] : [],
  topic: String(session.topic || ""),
  anchorId: String(session.anchorId || ""),
  anchorOwnerId: String(session.anchorOwnerId || ""),
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

const sanitizeProps = (action) => {
  const ignored = new Set(["type", "slotId", "now", "endsAt"]);
  return Object.fromEntries(Object.entries(action).filter(([key, value]) => !ignored.has(key) && value !== undefined));
};

const withCharacter = (state, slotId, updater) => {
  const current = state.characters[slotId];
  if (!current) return state;
  const next = updater(current);
  if (next === current) return state;
  return {
    ...state,
    characters: {
      ...state.characters,
      [slotId]: next,
    },
  };
};

const withConversation = (state, conversationId, updater) => {
  const current = state.conversations[conversationId];
  if (!current) return state;
  const next = updater(current);
  if (next === current) return state;
  return {
    ...state,
    conversations: {
      ...state.conversations,
      [conversationId]: next,
    },
  };
};

const resetCharacterHome = (character, assignment) => ({
  ...getIdleCharacter(character.slotId, assignment),
});

const buildDirectReturnRoute = (character) => {
  const currentNode = character.positionNode || character.homePosition || character.homeNode;
  const homeNode = character.homePosition || character.homeNode || getHomeNode(character.slotId);
  return currentNode === homeNode ? [homeNode] : [currentNode, homeNode];
};

const shouldResetOnRestore = (character, now) => {
  if (character.conversationId) return true;
  if (character.phase === "walkingToActivity" || character.phase === "returning") return true;
  if (character.phase === "chatting" || character.activity === "chatting") return true;
  if (character.phase === "eating" || character.phase === "gaming") return true;
  if (character.activityEndsAt && character.activityEndsAt <= now) return true;
  return false;
};

const startReturnCharacter = (character, route) => ({
  ...character,
  phase: "returning",
  status: TRAVEL_STATUS.returning,
  conversationId: "",
  reservedAnchorId: "",
  route: Array.isArray(route) && route.length ? [...route] : buildDirectReturnRoute(character),
  routeIndex: 0,
  activityEndsAt: 0,
  props: {},
});

const closeConversationMembers = (state, conversation, returnRoutes = {}) => {
  let characters = state.characters;

  for (const slotId of conversation.memberIds) {
    const current = characters[slotId];
    if (!current || current.conversationId !== conversation.id) continue;

    const route = returnRoutes[slotId];
    const next = startReturnCharacter(current, route);

    if (next !== current) {
      characters = {
        ...characters,
        [slotId]: next,
      };
    }
  }

  return characters;
};

const releaseConversationReservation = (reservations, conversation) => {
  if (!conversation?.anchorId || !conversation?.anchorOwnerId) return reservations;
  return releaseAnchor(reservations, conversation.anchorId, conversation.anchorOwnerId);
};

const normalizeRestoredCharacters = (rawCharacters, assignments, now) => Object.fromEntries(
  slotIdsFromAssignments(assignments).map((slotId) => {
    const assignment = assignments[slotId];
    const restored = normalizeCharacter(slotId, assignment, rawCharacters?.[slotId]);
    if (shouldResetOnRestore(restored, now)) {
      return [slotId, resetCharacterHome(restored, assignment)];
    }

    const atHome = {
      ...restored,
      positionNode: getHomeNode(slotId),
      route: [],
      routeIndex: 0,
      conversationId: "",
      reservedAnchorId: "",
    };
    return [slotId, atHome];
  }),
);

export const createWorkSessionId = (now = 0, cryptoSource = globalThis.crypto) => {
  const timestamp = Number.isFinite(now) ? now : 0;
  if (typeof cryptoSource?.randomUUID === "function") {
    return `work-session-${timestamp}-${cryptoSource.randomUUID()}`;
  }

  if (typeof cryptoSource?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoSource.getRandomValues(bytes);
    const randomToken = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `work-session-${timestamp}-${randomToken}`;
  }

  throw new Error("Secure random generation is unavailable for work session IDs.");
};

const normalizeActivityEventRecord = (value, workSessionId) => {
  const event = createOfficeActivityEvent({
    ...(isPlainObject(value) ? deepClone(value) : {}),
    workSessionId: String(value?.workSessionId || workSessionId || ""),
  });

  return {
    ...event,
    title: String(value?.title || event.title),
    subject: String(value?.subject || ""),
    summary: String(value?.summary || ""),
    insightOrResult: String(value?.insightOrResult || ""),
    endedAt: Number.isFinite(value?.endedAt) ? value.endedAt : 0,
    detailStatus: value?.detailStatus === "complete" ? "complete" : "pending",
  };
};

const filterCurrentSessionActivityEvents = (events, workSessionId) => (Array.isArray(events) ? events : [])
  .map((event) => normalizeActivityEventRecord(event, workSessionId))
  .filter((event) => event.workSessionId === workSessionId);

const normalizeActiveEventOwnership = (events, activeEventBySlot) => {
  const eventById = new Map(events.map((event) => [event.eventId, event]));
  return Object.fromEntries(Object.entries(isPlainObject(activeEventBySlot) ? activeEventBySlot : {}).filter(([slotId, eventId]) => {
    const event = eventById.get(String(eventId || ""));
    return Boolean(event) && event.actorId === slotId;
  }).map(([slotId, eventId]) => [slotId, String(eventId)]));
};

const restoreActivityEvents = (rawEvents, workSessionId, activeEventBySlot, now) => (
  filterCurrentSessionActivityEvents(rawEvents, workSessionId).map((event) => {
    const isOwnedInFlight = activeEventBySlot[event.actorId] === event.eventId;
    const isPending = !event.endedAt;
    if (!isOwnedInFlight && !isPending) return event;

    const completedEvent = {
      ...event,
      endedAt: Math.max(event.startedAt || 0, Number.isFinite(now) ? now : 0),
    };

    if (completedEvent.detailStatus === "complete" && completedEvent.subject && completedEvent.summary && completedEvent.insightOrResult) {
      return completedEvent;
    }

    return mergeOfficeActivityDetail(completedEvent, createLocalActivityDetail(completedEvent));
  })
);

export function createOfficeState({ assignments, now = 0, durationMs = 0, workSessionId = "" }) {
  const normalizedAssignments = normalizeAssignments(assignments);
  const resolvedWorkSessionId = String(workSessionId || createWorkSessionId(now));

  return {
    mode: OFFICE_MODE,
    now,
    durationMs,
    workSessionId: resolvedWorkSessionId,
    assignments: normalizedAssignments,
    reservations: {},
    conversations: {},
    activityEvents: [],
    activeEventBySlot: {},
    characters: Object.fromEntries(
      slotIdsFromAssignments(normalizedAssignments).map((slotId) => [
        slotId,
        getIdleCharacter(slotId, normalizedAssignments[slotId]),
      ]),
    ),
  };
}

export function serializeOfficeState(state) {
  const activityEvents = filterCurrentSessionActivityEvents(state.activityEvents, state.workSessionId);
  const activeEventBySlot = normalizeActiveEventOwnership(activityEvents, state.activeEventBySlot);
  return JSON.stringify({
    mode: state.mode,
    now: state.now,
    durationMs: state.durationMs,
    workSessionId: state.workSessionId,
    conversations: deepClone(state.conversations || {}),
    activityEvents: deepClone(activityEvents),
    activeEventBySlot: deepClone(activeEventBySlot),
    characters: deepClone(state.characters || {}),
  });
}

export function restoreOfficeState(raw, assignments, now = 0) {
  const parsed = typeof raw === "string"
    ? (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return {};
        }
      })()
    : (isPlainObject(raw) ? raw : {});

  const persistedWorkSessionId = String(parsed.workSessionId || "");
  const base = createOfficeState({
    assignments,
    now,
    durationMs: Number.isFinite(parsed.durationMs) ? parsed.durationMs : 0,
    workSessionId: persistedWorkSessionId,
  });
  const workSessionId = base.workSessionId;
  const serializedActivityEvents = filterCurrentSessionActivityEvents(parsed.activityEvents, workSessionId);
  const serializedActiveEventBySlot = normalizeActiveEventOwnership(serializedActivityEvents, parsed.activeEventBySlot);

  return {
    ...base,
    mode: String(parsed.mode || base.mode),
    workSessionId,
    activityEvents: restoreActivityEvents(parsed.activityEvents, workSessionId, serializedActiveEventBySlot, now),
    activeEventBySlot: {},
    characters: normalizeRestoredCharacters(parsed.characters, base.assignments, now),
  };
}

export function officeReducer(state, action) {
  switch (action.type) {
    case "SET_MODE":
      if (action.mode === state.mode) return state;
      return { ...state, mode: action.mode };

    case "TICK":
      if (action.now === state.now) return state;
      return { ...state, now: action.now };

    case "SET_RESERVATIONS": {
      const reservations = cloneReservationMap(action.reservations);
      if (!reservations) return state;
      return { ...state, reservations };
    }

    case "CREATE_ACTIVITY_EVENT": {
      if (action.event?.workSessionId !== state.workSessionId) return state;
      const event = normalizeActivityEventRecord(action.event, state.workSessionId);
      if (!event.eventId || !event.actorId) return state;
      return {
        ...state,
        activityEvents: [event, ...(state.activityEvents || []).filter((item) => item.eventId !== event.eventId)],
        activeEventBySlot: {
          ...state.activeEventBySlot,
          [event.actorId]: event.eventId,
        },
      };
    }

    case "ENRICH_ACTIVITY_EVENT": {
      const eventIndex = (state.activityEvents || []).findIndex((event) => event.eventId === action.detail?.eventId);
      if (eventIndex < 0) return state;

      const currentEvent = state.activityEvents[eventIndex];
      if (state.activeEventBySlot[currentEvent.actorId] !== currentEvent.eventId) return state;

      const nextEvent = mergeOfficeActivityDetail(currentEvent, action.detail);
      if (nextEvent === currentEvent) return state;

      const activityEvents = [...state.activityEvents];
      activityEvents[eventIndex] = nextEvent;
      return {
        ...state,
        activityEvents,
      };
    }

    case "COMPLETE_ACTIVITY_EVENT": {
      const eventIndex = (state.activityEvents || []).findIndex((event) => event.eventId === action.eventId);
      if (eventIndex < 0) return state;

      const currentEvent = state.activityEvents[eventIndex];
      const endedAt = Number.isFinite(action.endedAt) ? action.endedAt : (currentEvent.endedAt || state.now);
      const nextEvent = endedAt === currentEvent.endedAt
        ? currentEvent
        : { ...currentEvent, endedAt };

      let activeEventBySlot = state.activeEventBySlot;
      if (state.activeEventBySlot[currentEvent.actorId] === currentEvent.eventId) {
        activeEventBySlot = { ...state.activeEventBySlot };
        delete activeEventBySlot[currentEvent.actorId];
      }

      if (nextEvent === currentEvent && activeEventBySlot === state.activeEventBySlot) return state;

      const activityEvents = nextEvent === currentEvent
        ? state.activityEvents
        : [...state.activityEvents];
      if (nextEvent !== currentEvent) activityEvents[eventIndex] = nextEvent;

      return {
        ...state,
        activityEvents,
        activeEventBySlot,
      };
    }

    case "ASSIGN_PROFILE": {
      const sourceAssignment = action.assignment || {
        profileId: action.profileId || "",
        profile: action.profile || null,
      };
      const assignment = {
        profileId: sourceAssignment.profileId || "",
        profile: deepClone(sourceAssignment.profile) || null,
      };

      if (!state.assignments[action.slotId]) return state;

      return {
        ...state,
        assignments: {
          ...state.assignments,
          [action.slotId]: assignment,
        },
        characters: {
          ...state.characters,
          [action.slotId]: {
            ...state.characters[action.slotId],
            profileId: assignment.profileId || "",
            profile: assignment.profile || null,
          },
        },
      };
    }

    case "START_ACTIVITY":
      return withCharacter(state, action.slotId, (character) => ({
        ...character,
        phase: "walkingToActivity",
        activity: action.activity,
        status: TRAVEL_STATUS[action.activity] || TRAVEL_STATUS.meeting,
        previousActivity: character.activity,
        route: Array.isArray(action.route) ? [...action.route] : [],
        routeIndex: 0,
        positionNode: Array.isArray(action.route) && action.route.length ? action.route[0] : character.positionNode,
        reservedAnchorId: action.anchorId || character.reservedAnchorId,
        activityStartedAt: action.now ?? state.now,
        activityEndsAt: 0,
        props: {},
      }));

    case "ADVANCE_ROUTE":
      return withCharacter(state, action.slotId, (character) => {
        if (!Array.isArray(character.route) || !character.route.length) return character;
        const nextIndex = Math.min(character.routeIndex + 1, character.route.length - 1);
        return {
          ...character,
          routeIndex: nextIndex,
          positionNode: character.route[nextIndex],
        };
      });

    case "ARRIVE_ACTIVITY":
      return withCharacter(state, action.slotId, (character) => ({
        ...character,
        phase: character.activity,
        status: ACTIVITY_STATUS[character.activity] || ACTIVITY_STATUS.chatting,
        route: [],
        routeIndex: 0,
        positionNode: character.reservedAnchorId || character.positionNode,
        activityStartedAt: action.now ?? state.now,
        activityEndsAt: action.endsAt ?? 0,
        props: sanitizeProps(action),
      }));

    case "START_RETURN": {
      const character = state.characters[action.slotId];
      if (!character) return state;

      const isNonConversationEating = character.activity === "eating"
        && character.phase !== "chatting"
        && !character.conversationId;
      const reservations = isNonConversationEating && character.reservedAnchorId
        ? releaseAnchor(state.reservations, character.reservedAnchorId, action.slotId)
        : state.reservations;

      return withCharacter(
        reservations === state.reservations ? state : { ...state, reservations },
        action.slotId,
        (current) => startReturnCharacter(current, action.route),
      );
    }

    case "FINISH_RETURN":
      return withCharacter(state, action.slotId, (character) => resetCharacterHome(character, state.assignments[action.slotId]));

    case "OPEN_CONVERSATION": {
      const conversation = normalizeConversation(action.session, state.now);
      if (!conversation.id) return state;
      if (state.conversations[conversation.id]) return state;
      if (conversation.memberIds.some((slotId) => state.characters[slotId]?.conversationId)) return state;

      let characters = state.characters;
      for (const slotId of conversation.memberIds) {
        const current = characters[slotId];
        if (!current) continue;
        const next = {
          ...current,
          phase: "chatting",
          activity: "chatting",
          status: ACTIVITY_STATUS.chatting,
          conversationId: conversation.id,
          reservedAnchorId: conversation.anchorId || current.reservedAnchorId,
          activityStartedAt: conversation.startedAt,
          activityEndsAt: conversation.endsAt,
        };
        characters = {
          ...characters,
          [slotId]: next,
        };
      }

      return {
        ...state,
        conversations: {
          ...state.conversations,
          [conversation.id]: conversation,
        },
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

    case "UPDATE_CONVERSATION_IO":
      return withConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        requestSequence: monotonicCounterValue(action.requestSequence, conversation.requestSequence),
        turnIndex: monotonicCounterValue(action.turnIndex, conversation.turnIndex),
        promptContext: isPlainObject(action.promptContext) ? deepClone(action.promptContext) : conversation.promptContext,
        lastResponse: isPlainObject(action.lastResponse) ? deepClone(action.lastResponse) : conversation.lastResponse,
      }));

    case "SHIFT_BUBBLE":
      return withConversation(state, action.conversationId, (conversation) => ({
        ...conversation,
        bubbleQueue: conversation.bubbleQueue.slice(1),
      }));

    case "CLOSE_CONVERSATION": {
      const conversation = state.conversations[action.conversationId];
      if (!conversation) return state;

      const conversations = { ...state.conversations };
      delete conversations[action.conversationId];

      return {
        ...state,
        reservations: releaseConversationReservation(state.reservations, conversation),
        conversations,
        characters: closeConversationMembers(state, conversation, action.returnRoutes || {}),
      };
    }

    case "RESET_EXPIRED": {
      const now = action.now ?? state.now;
      let characters = state.characters;
      let reservations = state.reservations;

      for (const slotId of Object.keys(characters)) {
        const current = characters[slotId];
        if (!current.activityEndsAt || current.activityEndsAt > now) continue;
        const next = resetCharacterHome(current, state.assignments[slotId]);
        characters = {
          ...characters,
          [slotId]: next,
        };
      }

      let conversations = state.conversations;
      for (const [conversationId, conversation] of Object.entries(state.conversations)) {
        if (!conversation.endsAt || conversation.endsAt > now) continue;
        const nextCharacters = closeConversationMembers(
          { ...state, characters },
          conversation,
          action.returnRoutes || {},
        );
        characters = nextCharacters;
        reservations = releaseConversationReservation(reservations, conversation);
        if (conversations === state.conversations) conversations = { ...state.conversations };
        delete conversations[conversationId];
      }

      if (characters === state.characters && conversations === state.conversations && reservations === state.reservations) return state;
      return {
        ...state,
        now,
        reservations,
        characters,
        conversations,
      };
    }

    default:
      return state;
  }
}
