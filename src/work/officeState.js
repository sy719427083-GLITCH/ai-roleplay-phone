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

export function createOfficeState({ assignments, now = 0, durationMs = 0 }) {
  const normalizedAssignments = normalizeAssignments(assignments);

  return {
    mode: OFFICE_MODE,
    now,
    durationMs,
    assignments: normalizedAssignments,
    reservations: {},
    conversations: {},
    characters: Object.fromEntries(
      slotIdsFromAssignments(normalizedAssignments).map((slotId) => [
        slotId,
        getIdleCharacter(slotId, normalizedAssignments[slotId]),
      ]),
    ),
  };
}

export function serializeOfficeState(state) {
  return JSON.stringify({
    mode: state.mode,
    now: state.now,
    durationMs: state.durationMs,
    conversations: deepClone(state.conversations || {}),
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

  const base = createOfficeState({
    assignments,
    now,
    durationMs: Number.isFinite(parsed.durationMs) ? parsed.durationMs : 0,
  });

  return {
    ...base,
    mode: String(parsed.mode || base.mode),
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

    case "START_RETURN":
      return withCharacter(state, action.slotId, (character) => startReturnCharacter(character, action.route));

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
        conversations,
        characters: closeConversationMembers(state, conversation, action.returnRoutes || {}),
      };
    }

    case "RESET_EXPIRED": {
      const now = action.now ?? state.now;
      let characters = state.characters;

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
        if (conversations === state.conversations) conversations = { ...state.conversations };
        delete conversations[conversationId];
      }

      if (characters === state.characters && conversations === state.conversations) return state;
      return {
        ...state,
        now,
        characters,
        conversations,
      };
    }

    default:
      return state;
  }
}
