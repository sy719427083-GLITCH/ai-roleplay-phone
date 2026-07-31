import assert from "node:assert/strict";
import test from "node:test";
import { OFFICE_ACTIVITIES, createLocalOfficePlan, createOfficeDailySeed, getChinaOfficePeriod, getOfficeIntervalKey } from "./officeSimulation.js";

const occupants = Array.from({ length: 7 }, (_, index) => ({
  slotId: index ? `employee${index}` : "boss",
  profile: { id: `character:c${index}`, name: `角色${index}`, officeContext: { affinities: { focus: .55, social: .7, discipline: .5, entertainment: .6, night: .4 } } },
}));

const runningProject = {
  status: "running",
  project: {
    id: "project-1",
    name: "经营数据看板建设",
    description: "收集并分析经营数据",
    scopeItems: ["整理数据", "制作报表", "输出方案"],
    deliverables: "PPT 与交付文档",
    acceptanceCriteria: "成果通过检查验收",
  },
};

test("maps China workday, lunch, weekend, and overnight periods", () => {
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T02:00:00Z")), "focus-am");
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T04:30:00Z")), "lunch");
  assert.equal(getChinaOfficePeriod(new Date("2026-08-01T02:00:00Z")), "weekend-day");
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T20:00:00Z")), "overnight");
});

test("reconstructs a stable plan for the same interval", () => {
  const now = new Date("2026-07-27T07:00:00Z");
  const input = { occupants, now, seed: createOfficeDailySeed(now, "Ccat"), projectContext: runningProject };
  assert.deepEqual(createLocalOfficePlan(input), createLocalOfficePlan(input));
  assert.match(getOfficeIntervalKey(now), /2026-07-27/);
});

test("keeps slacking and Douyin as separate exact labels", () => {
  assert.equal(OFFICE_ACTIVITIES.slacking.label, "摸鱼ing");
  assert.equal(OFFICE_ACTIVITIES.scrolling.label, "刷抖音");
  assert.notEqual(OFFICE_ACTIVITIES.slacking.id, OFFICE_ACTIVITIES.scrolling.id);
});

test("keeps every locally scheduled desk activity at its occupant's workstation", () => {
  const deskActivities = new Set(["idle", "working", "scrolling", "gaming", "slacking"]);
  const seen = new Set();
  const hours = [0, 2, 4, 7, 10, 13, 16, 20];
  for (let index = 0; index < 300; index += 1) {
    const day = 27 + (index % 7);
    const hour = hours[index % hours.length];
    const now = new Date(Date.UTC(2026, 6, day, hour));
    const plan = createLocalOfficePlan({ occupants, now, seed: `desk-${index}`, projectContext: index % 2 ? runningProject : null });
    for (const occupant of occupants) {
      const item = plan.characters[occupant.profile.id];
      if (!deskActivities.has(item.activity)) continue;
      seen.add(item.activity);
      assert.equal(item.destination, `${occupant.slotId}-home`, `${item.activity}:${occupant.slotId}`);
    }
  }
  assert.deepEqual([...seen].sort(), [...deskActivities].sort());
});

test("never creates a solo conversation", () => {
  const plan = createLocalOfficePlan({ occupants: occupants.slice(0, 1), now: new Date("2026-07-27T04:30:00Z"), seed: "solo" });
  assert.equal(plan.conversation, null);
  assert.equal(Object.keys(plan.characters).length, 1);
});

test("never exposes a single locally scheduled chatter", () => {
  for (let index = 0; index < 500; index += 1) {
    const plan = createLocalOfficePlan({
      occupants,
      now: new Date("2026-07-27T04:30:00Z"),
      seed: `solo-chat-${index}`,
    });
    const chatting = Object.entries(plan.characters).filter(([, item]) => item.activity === "chatting");
    assert.notEqual(chatting.length, 1, `seed solo-chat-${index}`);
    if (chatting.length === 0) assert.equal(plan.conversation, null);
    if (chatting.length >= 2) assert.ok(plan.conversation?.participantIds.length >= 2);
  }
});

test("conversation participants retain normal destinations for runtime gathering", () => {
  let plan;
  for (let index = 0; index < 100 && !plan?.conversation; index += 1) plan = createLocalOfficePlan({ occupants, now: new Date("2026-07-27T04:30:00Z"), seed: `chat-${index}` });
  assert.ok(plan.conversation);
  const destinations = plan.conversation.participantIds.map((id) => plan.characters[id].destination);
  assert.ok(destinations.every((id) => !id.startsWith("chat-")));
  assert.ok(plan.conversation.participantIds.length >= 2 && plan.conversation.participantIds.length <= 4);
});

test("never schedules work, reporting, or printing without a running project", () => {
  for (let index = 0; index < 120; index += 1) {
    const plan = createLocalOfficePlan({ occupants, now: new Date("2026-07-27T02:00:00Z"), seed: `idle-${index}`, projectContext: null });
    assert.equal(Object.values(plan.characters).some((item) => ["working", "reporting", "printing"].includes(item.activity)), false);
    assert.equal(Object.values(plan.characters).some((item) => ["工作中", "做报表", "打印中", "等待打印"].includes(item.label)), false);
  }
});

test("uses concrete project task labels whenever active work is scheduled", () => {
  let workCount = 0;
  for (let index = 0; index < 120; index += 1) {
    const plan = createLocalOfficePlan({ occupants, now: new Date("2026-07-27T02:00:00Z"), seed: `active-${index}`, projectContext: runningProject });
    for (const item of Object.values(plan.characters).filter((value) => value.activity === "working")) {
      workCount += 1;
      assert.notEqual(item.label, "工作中");
      assert.notEqual(item.label, "做报表");
    }
  }
  assert.ok(workCount > 0);
});
