import { strict as assert } from "node:assert";
import test from "node:test";
import { buildRelationshipContext, pickProactiveMessages } from "./messageLogic.js";

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
