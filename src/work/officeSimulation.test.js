import assert from "node:assert/strict";
import test from "node:test";
import { OFFICE_ACTIVITIES, createLocalOfficePlan, createOfficeDailySeed, getChinaOfficePeriod, getOfficeIntervalKey } from "./officeSimulation.js";

const occupants = Array.from({ length: 7 }, (_, index) => ({
  slotId: index ? `employee${index}` : "boss",
  profile: { id: `character:c${index}`, name: `角色${index}`, officeContext: { affinities: { focus: .55, social: .7, discipline: .5, entertainment: .6, night: .4 } } },
}));

test("maps China workday, lunch, weekend, and overnight periods", () => {
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T02:00:00Z")), "focus-am");
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T04:30:00Z")), "lunch");
  assert.equal(getChinaOfficePeriod(new Date("2026-08-01T02:00:00Z")), "weekend-day");
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T20:00:00Z")), "overnight");
});

test("reconstructs a stable plan for the same interval", () => {
  const now = new Date("2026-07-27T07:00:00Z");
  const input = { occupants, now, seed: createOfficeDailySeed(now, "Ccat"), projectContext: "品牌改版" };
  assert.deepEqual(createLocalOfficePlan(input), createLocalOfficePlan(input));
  assert.match(getOfficeIntervalKey(now), /2026-07-27/);
});

test("keeps slacking and Douyin as separate exact labels", () => {
  assert.equal(OFFICE_ACTIVITIES.slacking.label, "摸鱼ing");
  assert.equal(OFFICE_ACTIVITIES.scrolling.label, "刷抖音");
  assert.notEqual(OFFICE_ACTIVITIES.slacking.id, OFFICE_ACTIVITIES.scrolling.id);
});

test("never creates a solo conversation", () => {
  const plan = createLocalOfficePlan({ occupants: occupants.slice(0, 1), now: new Date("2026-07-27T04:30:00Z"), seed: "solo" });
  assert.equal(plan.conversation, null);
  assert.equal(Object.keys(plan.characters).length, 1);
});

test("conversation participants gather at distinct nearby chat points", () => {
  let plan;
  for (let index = 0; index < 100 && !plan?.conversation; index += 1) plan = createLocalOfficePlan({ occupants, now: new Date("2026-07-27T04:30:00Z"), seed: `chat-${index}` });
  assert.ok(plan.conversation);
  const destinations = plan.conversation.participantIds.map((id) => plan.characters[id].destination);
  assert.ok(destinations.every((id) => id.startsWith("chat-")));
  assert.equal(new Set(destinations).size, destinations.length);
});
