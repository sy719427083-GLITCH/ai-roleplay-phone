import assert from "node:assert/strict";
import test from "node:test";
import { buildOfficeProfileContext, deriveOfficeAffinities, readOfficeRelations } from "./officeProfileContext.js";

test("derives bounded affinities without mutating profiles", () => {
  const profile = { sourceId: "c1", name: "林序", identity: "财务主管", personality: "认真、自律、少言", persona: "习惯早起做报表" };
  const original = structuredClone(profile);
  const context = buildOfficeProfileContext(profile, {});
  assert.ok(context.affinities.focus > context.affinities.entertainment);
  assert.ok(Object.values(context.affinities).every((value) => value >= 0 && value <= 1));
  assert.deepEqual(profile, original);
});

test("reads relationship context safely", () => {
  const storage = { getItem: () => JSON.stringify({ c1: { c2: { label: "好友", description: "经常一起讨论设计" } } }) };
  const relations = readOfficeRelations(storage);
  assert.match(buildOfficeProfileContext({ sourceId: "c1" }, relations).relationshipSummary, /好友/);
  assert.deepEqual(readOfficeRelations({ getItem: () => "{" }), {});
});

test("recognizes entertainment and night-oriented personas", () => {
  const affinities = deriveOfficeAffinities({ personality: "爱玩游戏，夜猫子，喜欢刷抖音" });
  assert.ok(affinities.entertainment > 0.5);
  assert.ok(affinities.night > 0.5);
});
