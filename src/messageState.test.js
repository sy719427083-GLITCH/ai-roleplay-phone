import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptFriendRequest,
  appendChatMessage,
  deleteConversation,
  markConversationRead,
  rejectFriendRequest,
  updateChatMessage,
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

test("transfer messages preserve amount and can update settlement status", () => {
  const state = {
    contacts: [{ characterId: "char-a" }],
    requests: [],
    conversations: [{ id: "conv-char-a", characterId: "char-a", unread: 0 }],
    histories: {},
  };

  const withTransfer = appendChatMessage(state, "char-a", {
    from: "role",
    kind: "transfer",
    amount: 88,
    note: "晚饭",
    transferDirection: "incoming",
    status: "pending",
  });
  const transfer = withTransfer.histories["char-a"][0];
  assert.equal(transfer.kind, "transfer");
  assert.equal(transfer.amount, 88);
  assert.equal(transfer.status, "pending");

  const settled = updateChatMessage(withTransfer, "char-a", transfer.id, { status: "accepted" });
  assert.equal(settled.histories["char-a"][0].status, "accepted");
});
