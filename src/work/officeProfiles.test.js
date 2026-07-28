import assert from "node:assert/strict";
import test from "node:test";
import { getAvailableProfiles, normalizeAssignments, readOfficeProfiles } from "./officeProfiles.js";

const storage = (values) => ({ getItem: (key) => values[key] ?? null });

test("offers Me, main characters, and NPCs to every office slot", () => {
  const result = readOfficeProfiles(storage({
    apiMeProfiles: JSON.stringify({ me1: { name: "我", avatar: "me.png" } }),
    apiCharacters: JSON.stringify({ c1: { name: "顾言", type: "main" }, n1: { name: "小林", type: "npc" } }),
  }));
  assert.deepEqual(result.map((item) => [item.id, item.source]), [["me:me1", "me"], ["character:c1", "character"], ["character:n1", "npc"]]);
});

test("starts empty and clears missing or duplicate profiles", () => {
  const profiles = readOfficeProfiles(storage({ apiMeProfiles: "{}", apiCharacters: JSON.stringify({ c1: { name: "顾言" } }) }));
  assert.deepEqual(normalizeAssignments({}, profiles), {
    boss: null,
    employee1: null,
    employee2: null,
    employee3: null,
    employee4: null,
    employee5: null,
    employee6: null,
  });
  assert.deepEqual(normalizeAssignments({ boss: "character:c1", employee1: "character:c1", employee2: "missing" }, profiles), {
    boss: "character:c1",
    employee1: null,
    employee2: null,
    employee3: null,
    employee4: null,
    employee5: null,
    employee6: null,
  });
});

test("excludes profiles assigned to another slot", () => {
  const profiles = [{ id: "me:me1" }, { id: "character:c1" }];
  assert.deepEqual(getAvailableProfiles(profiles, { boss: "me:me1", employee1: null }, "employee1").map((item) => item.id), ["character:c1"]);
});

test("profiles include persona-aware office context", () => {
  const storage = {
    getItem(key) {
      if (key === "apiCharacters") return JSON.stringify({ c1: { name: "林序", personality: "认真自律" } });
      if (key === "apiRelations") return JSON.stringify({ c1: { c2: { label: "同事" } } });
      return "{}";
    },
  };
  const [profile] = readOfficeProfiles(storage);
  assert.ok(profile.officeContext.affinities.focus > 0.5);
  assert.match(profile.officeContext.relationshipSummary, /同事/);
});
