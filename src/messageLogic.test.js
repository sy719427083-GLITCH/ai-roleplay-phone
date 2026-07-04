import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildMomentRoleReplyComment,
  buildMomentUserComment,
  buildRelationshipContext,
  pickProactiveMessages,
} from "./messageLogic.js";

test("proactive fallback can generate up to five messages", () => {
  const messages = pickProactiveMessages({ name: "林砚舟" }, { random: () => 0.99, minute: 12 });

  assert.equal(messages.length, 5);
  assert.ok(messages.every(Boolean));
});

test("relationship context describes both directions for the active chat role", () => {
  const context = buildRelationshipContext({
    character: { id: "char-a", name: "林砚舟" },
    characters: [{ id: "char-a", name: "林砚舟" }],
    meProfiles: {
      me_1: { id: "me_1", name: "我" },
    },
    relations: {
      rel_1: {
        charA: "char-a",
        charB: "me_1",
        typeA: "守护者",
        typeB: "被守护者",
        viewA: "会下意识照顾对方，但嘴上不承认。",
        viewB: "信任对方，也会试探边界。",
      },
    },
  });

  assert.match(context, /林砚舟 对 我：守护者/);
  assert.match(context, /我 对 林砚舟：被守护者/);
  assert.match(context, /会下意识照顾对方/);
  assert.match(context, /信任对方/);
});

test("moment user comments can target a role reply with black reply wording data", () => {
  const comment = buildMomentUserComment({
    text: "我也想知道后续",
    replyTarget: { author: "林砚舟" },
    now: () => "2026-07-04T12:00:00.000Z",
    idSeed: "second",
  });

  assert.equal(comment.author, "我");
  assert.equal(comment.replyVerb, "回复了");
  assert.equal(comment.replyTo, "林砚舟");
  assert.equal(comment.text, "我也想知道后续");
});

test("moment role replies are only appended when API returns text", () => {
  assert.equal(buildMomentRoleReplyComment({ replyText: "", characterName: "林砚舟" }), null);
  assert.equal(buildMomentRoleReplyComment({ replyText: null, characterName: "林砚舟" }), null);

  const comment = buildMomentRoleReplyComment({
    replyText: "我刚好也这么想。",
    characterName: "林砚舟",
    replyTo: "我",
    now: () => "2026-07-04T12:00:01.000Z",
    idSeed: "api",
  });

  assert.equal(comment.author, "林砚舟");
  assert.equal(comment.replyVerb, "回复了");
  assert.equal(comment.replyTo, "我");
  assert.equal(comment.text, "我刚好也这么想。");
});
