export const MESSAGE_STORAGE_KEY = "ccatMessageState";

const nowStamp = () => new Date().toISOString();

const createMessageId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createEmptyMessageState() {
  return {
    contacts: [],
    requests: [],
    conversations: [],
    histories: {},
  };
}

export function normalizeMessageState(value = {}) {
  return {
    contacts: Array.isArray(value.contacts) ? value.contacts : [],
    requests: Array.isArray(value.requests) ? value.requests : [],
    conversations: Array.isArray(value.conversations) ? value.conversations : [],
    histories: value.histories && typeof value.histories === "object" ? value.histories : {},
  };
}

export function createConversationForCharacter(state, character = {}) {
  const normalized = normalizeMessageState(state);
  const characterId = character.id || character.characterId;
  if (!characterId) return normalized;

  const histories = { ...normalized.histories };
  if (!Array.isArray(histories[characterId])) {
    histories[characterId] = [
      {
        id: createMessageId("msg"),
        from: "role",
        text: `我是${character.name || "新联系人"}，以后可以在这里找我。`,
        time: "刚刚",
      },
    ];
  }

  const hasConversation = normalized.conversations.some((item) => item.characterId === characterId);
  const conversations = hasConversation
    ? normalized.conversations.map((item) =>
        item.characterId === characterId ? { ...item, updatedAt: nowStamp(), unread: 0 } : item,
      )
    : [
        {
          id: `conv-${characterId}`,
          characterId,
          unread: 0,
          pinned: false,
          updatedAt: nowStamp(),
        },
        ...normalized.conversations,
      ];

  return {
    ...normalized,
    conversations,
    histories,
  };
}

export function acceptFriendRequest(state, requestId, character = {}) {
  const normalized = normalizeMessageState(state);
  const request = normalized.requests.find((item) => item.id === requestId);
  if (!request) return normalized;

  const characterId = request.characterId || character.id || character.characterId;
  if (!characterId) {
    return {
      ...normalized,
      requests: normalized.requests.filter((item) => item.id !== requestId),
    };
  }

  const contacts = normalized.contacts.some((item) => item.characterId === characterId)
    ? normalized.contacts
    : [{ characterId, addedAt: nowStamp() }, ...normalized.contacts];

  return createConversationForCharacter(
    {
      ...normalized,
      contacts,
      requests: normalized.requests.filter((item) => item.id !== requestId),
    },
    { ...character, id: characterId },
  );
}

export function rejectFriendRequest(state, requestId) {
  const normalized = normalizeMessageState(state);
  return {
    ...normalized,
    requests: normalized.requests.filter((item) => item.id !== requestId),
  };
}

export function deleteConversation(state, characterId) {
  const normalized = normalizeMessageState(state);
  const histories = { ...normalized.histories };
  delete histories[characterId];
  return {
    ...normalized,
    conversations: normalized.conversations.filter((item) => item.characterId !== characterId),
    histories,
  };
}

function addRequest(state, characterId, direction) {
  const normalized = normalizeMessageState(state);
  if (!characterId) return normalized;
  const isContact = normalized.contacts.some((item) => item.characterId === characterId);
  const hasPending = normalized.requests.some((item) => item.characterId === characterId);
  if (isContact || hasPending) return normalized;
  return {
    ...normalized,
    requests: [
      {
        id: createMessageId(direction === "incoming" ? "in" : "out"),
        characterId,
        direction,
        status: "pending",
        createdAt: nowStamp(),
      },
      ...normalized.requests,
    ],
  };
}

export function addOutgoingFriendRequest(state, characterId) {
  return addRequest(state, characterId, "outgoing");
}

export function createIncomingFriendRequest(state, characterId) {
  return addRequest(state, characterId, "incoming");
}

export function appendChatMessage(state, characterId, message) {
  const normalized = normalizeMessageState(state);
  if (!characterId || !message?.text?.trim()) return normalized;
  const histories = { ...normalized.histories };
  histories[characterId] = [
    ...(Array.isArray(histories[characterId]) ? histories[characterId] : []),
    {
      id: createMessageId("msg"),
      from: message.from || "me",
      text: message.text.trim(),
      time: message.time || "刚刚",
    },
  ];
  return createConversationForCharacter({ ...normalized, histories }, { id: characterId });
}
