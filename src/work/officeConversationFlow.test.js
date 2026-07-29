import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceConversationTurn,
  appendConversationBatch,
  createConversationSession,
  currentConversationTurn,
  isConversationComplete,
  markConversationRequesting,
  shouldRequestNextBatch,
} from "./officeConversationFlow.js";

test("plays unique turns once and requests continuation near the end", () => {
  let session = createConversationSession();
  session = appendConversationBatch(session, { batchIndex: 1, shouldContinue: true, turns: [
    { speakerId: "a", text: "第一句" },
    { speakerId: "b", text: "第二句" },
    { speakerId: "a", text: "第三句" },
  ] });
  assert.equal(currentConversationTurn(session).text, "第一句");
  session = advanceConversationTurn(session);
  assert.equal(currentConversationTurn(session).text, "第二句");
  assert.equal(shouldRequestNextBatch(session), true);
  assert.equal(isConversationComplete(session), false);
});

test("caps continuation after three batches and never re-adds an old line", () => {
  let session = createConversationSession();
  session = appendConversationBatch(session, { batchIndex: 1, shouldContinue: true, turns: [{ speakerId: "a", text: "第一句" }, { speakerId: "b", text: "第二句" }] });
  session = appendConversationBatch(session, { batchIndex: 2, shouldContinue: true, turns: [{ speakerId: "a", text: "第三句" }, { speakerId: "b", text: "第四句" }] });
  session = appendConversationBatch(session, { batchIndex: 3, shouldContinue: true, turns: [{ speakerId: "a", text: "第一句。" }, { speakerId: "b", text: "第五句" }] });
  assert.equal(session.shouldContinue, false);
  assert.equal(session.turns.filter((turn) => turn.text.startsWith("第一句")).length, 1);
  while (currentConversationTurn(session)) session = advanceConversationTurn(session);
  assert.equal(isConversationComplete(session), true);
});

test("a pending request prevents premature completion", () => {
  let session = appendConversationBatch(createConversationSession(), { batchIndex: 1, shouldContinue: true, turns: [{ speakerId: "a", text: "一句" }, { speakerId: "b", text: "两句" }] });
  session = markConversationRequesting(session);
  session = advanceConversationTurn(advanceConversationTurn(session));
  assert.equal(currentConversationTurn(session), null);
  assert.equal(isConversationComplete(session), false);
  assert.equal(shouldRequestNextBatch(session), false);
});
