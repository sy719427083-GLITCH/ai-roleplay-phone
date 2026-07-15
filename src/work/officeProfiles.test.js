import assert from "node:assert/strict";
import test from "node:test";
import { createNpcProfile, normalizeOfficeAssignments, OFFICE_SLOT_IDS, readOfficeProfiles } from "./officeProfiles.js";

const storage = (data) => ({ getItem: (key) => data[key] ?? null });

test("separates main-character boss options and npc employee options", () => {
  const result = readOfficeProfiles(storage({
    apiCharacters: JSON.stringify({
      boss: { type: "main", name: "顾言", personality: "克制" },
      staff: { type: "npc", name: "林夏", personality: "活泼" },
    }),
    apiRelations: JSON.stringify({ r1: { charA: "boss", charB: "staff", type: "同事" } }),
  }));
  assert.deepEqual(result.bossOptions.map((item) => item.id), ["boss"]);
  assert.deepEqual(result.employeeOptions.map((item) => item.id), ["staff"]);
  assert.equal(result.relations.r1.type, "同事");
});

test("fills missing and deleted assignments with named npc profiles", () => {
  const profiles = { bossOptions: [], employeeOptions: [] };
  const result = normalizeOfficeAssignments({ boss: "deleted" }, profiles);
  assert.deepEqual(Object.keys(result), OFFICE_SLOT_IDS);
  assert.equal(result.boss.profile.name, "NPC");
  assert.equal(result.employee1.profile.name, "NPC");
  assert.equal(createNpcProfile("employee4", "employee").id, "npc-employee4");
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
