import assert from "node:assert/strict";
import test from "node:test";
import * as officeProfiles from "./officeProfiles.js";

const { createNpcProfile, normalizeOfficeAssignments, OFFICE_SLOT_IDS, readOfficeProfiles } = officeProfiles;

const storage = (data) => ({ getItem: (key) => data[key] ?? null });

test("uses Me profiles for bosses and all Character profiles for employees", () => {
  const result = readOfficeProfiles(storage({
    apiMeProfiles: JSON.stringify({ me1: { name: "沈知白", personality: "克制", persona: "投资人" } }),
    apiCharacters: JSON.stringify({
      main1: { type: "main", name: "程砚", personality: "自律" },
      npc1: { type: "npc", name: "林夏", personality: "外向" },
    }),
    apiRelations: JSON.stringify({ r1: { charA: "boss", charB: "staff", type: "同事" } }),
  }));

  assert.deepEqual(result.bossOptions.map(({ id }) => id), ["me1"]);
  assert.deepEqual(result.employeeOptions.map(({ id }) => id), ["main1", "npc1"]);
  assert.equal(result.bossOptions[0].source, "me");
  assert.equal(result.employeeOptions[0].source, "character");
  assert.equal(result.relations.r1.type, "同事");
});

test("snapshots preserve source-specific role fields", () => {
  assert.deepEqual(officeProfiles.createOfficeProfileSnapshot({
    id: "main1", type: "main", name: "程砚", identity: "律师", worldview: "近未来",
    appearance: "黑发", personality: "自律", persona: "背景", avatar: "a.png",
  }, "character"), {
    id: "main1", source: "character", type: "main", name: "程砚", identity: "律师",
    worldview: "近未来", appearance: "黑发", personality: "自律", persona: "背景", avatar: "a.png",
  });
});

test("rejects cross-source assignment ids with named npc fallbacks", () => {
  const profiles = {
    bossOptions: [officeProfiles.createOfficeProfileSnapshot({ id: "me1", name: "沈知白" }, "me")],
    employeeOptions: [officeProfiles.createOfficeProfileSnapshot({
      id: "character1", type: "main", name: "程砚",
    }, "character")],
  };
  const result = normalizeOfficeAssignments({
    boss: "character1",
    employee1: "me1",
  }, profiles);

  assert.equal(result.boss.profileId, "npc-boss");
  assert.equal(result.boss.profile.name, "NPC");
  assert.equal(result.boss.profile.source, "fallback");
  assert.notEqual(result.boss.profileId, "character1");
  assert.equal(result.employee1.profileId, "npc-employee1");
  assert.equal(result.employee1.profile.name, "NPC");
  assert.equal(result.employee1.profile.source, "fallback");
  assert.notEqual(result.employee1.profileId, "me1");
});

test("fills missing and deleted assignments with named npc profiles", () => {
  const profiles = { bossOptions: [], employeeOptions: [] };
  const result = normalizeOfficeAssignments({ boss: "deleted" }, profiles);
  assert.deepEqual(Object.keys(result), OFFICE_SLOT_IDS);
  assert.equal(result.boss.profile.name, "NPC");
  assert.equal(result.employee1.profile.name, "NPC");
  assert.deepEqual(createNpcProfile("employee4", "employee"), {
    id: "npc-employee4",
    source: "fallback",
    name: "NPC",
    identity: "临时员工",
    personality: "自然、友好",
    persona: "办公室临时角色",
    appearance: "",
    avatar: "",
    generated: true,
  });
});

test("defaults safely in node and ignores null or non-object stored payloads", () => {
  const result = readOfficeProfiles();

  assert.deepEqual(result, {
    bossOptions: [],
    employeeOptions: [],
    relations: {},
  });
});

test("treats null and array payloads as empty objects", () => {
  const result = readOfficeProfiles(storage({
    apiCharacters: "null",
    apiRelations: "[]",
  }));

  assert.deepEqual(result, {
    bossOptions: [],
    employeeOptions: [],
    relations: {},
  });
});
