import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptFriendRequest,
  appendChatMessage,
  deleteConversation,
  markConversationRead,
  rejectFriendRequest,
} from "./messageState.js";

test("accepting a friend request adds the role to contacts and opens a conversation", () => {
  const state = {
    contacts: [],
    requests: [{ id: "req-1", characterId: "char-a", direction: "incoming", status: "pending" }],
    conversations: [],
    histories: {},
  };

  const next = acceptFriendRequest(state, "req-1", {
    id: "char-a",
    name: "林砚舟",
    identity: "画师",
  });

  assert.equal(next.requests.length, 0);
  assert.equal(next.contacts[0].characterId, "char-a");
  assert.equal(next.conversations[0].characterId, "char-a");
  assert.equal(next.histories["char-a"].length > 0, true);
});

test("rejecting a friend request removes it without adding a contact", () => {
  const state = {
    contacts: [],
    requests: [{ id: "req-1", characterId: "char-a", direction: "incoming", status: "pending" }],
    conversations: [],
    histories: {},
  };

  const next = rejectFriendRequest(state, "req-1");

  assert.deepEqual(next.requests, []);
  assert.deepEqual(next.contacts, []);
});

test("deleting a conversation removes the thread and chat history", () => {
  const state = {
    contacts: [{ characterId: "char-a" }],
    requests: [],
    conversations: [{ id: "conv-char-a", characterId: "char-a" }],
    histories: { "char-a": [{ from: "role", text: "旧消息" }] },
  };

  const next = deleteConversation(state, "char-a");

  assert.deepEqual(next.conversations, []);
  assert.equal(next.histories["char-a"], undefined);
  assert.equal(next.contacts.length, 1);
});

test("role messages create unread counts that clear when the conversation is read", () => {
  const state = {
    contacts: [{ characterId: "char-a" }],
    requests: [],
    conversations: [{ id: "conv-char-a", characterId: "char-a", unread: 0 }],
    histories: {},
  };

  const withUnread = appendChatMessage(state, "char-a", { from: "role", text: "新消息" });
  assert.equal(withUnread.conversations[0].unread, 1);

  const read = markConversationRead(withUnread, "char-a");
  assert.equal(read.conversations[0].unread, 0);
});
