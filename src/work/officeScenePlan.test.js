import assert from "node:assert/strict";
import test from "node:test";
import { allocateOfficeActivities, validateOfficeScenePlan } from "./officeScenePlan.js";
import { getOfficePoint } from "./officeGeometry.js";

test("registers every shared activity point", () => {
  for (const id of ["social-left", "social-center", "social-right", "rest-left", "rest-right", "play-left", "play-right", "print-wait", "off-duty"]) assert.ok(getOfficePoint(id), id);
});

test("allows only one active printer user", () => {
  const plan = { characters: {
    c1: { activity: "printing", destination: "print-station" },
    c2: { activity: "printing", destination: "print-station" },
  } };
  const result = allocateOfficeActivities(plan, [{ slotId: "boss", profile: { id: "c1" } }, { slotId: "employee1", profile: { id: "c2" } }]);
  assert.equal(Object.values(result.characters).filter((item) => item.destination === "print-station").length, 1);
  assert.equal(result.characters.c2.destination, "print-wait");
});

test("rejects unknown profiles, activities, and destinations", () => {
  const result = validateOfficeScenePlan({ characters: { bad: { activity: "flying", destination: "wall", startsAt: 1, endsAt: 2 } } }, { profileIds: new Set(["c1"]), now: 1 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /profile/);
  assert.match(result.issues.join(" "), /activity/);
  assert.match(result.issues.join(" "), /destination/);
});

test("rejects duplicate-only conversation participants", () => {
  const plan = { characters: {
    c1: { activity: "chatting", destination: "chat-1", startsAt: 1, endsAt: 5 },
    c2: { activity: "chatting", destination: "chat-2", startsAt: 1, endsAt: 5 },
  }, conversation: { participantIds: ["c1", "c1"] } };
  const result = validateOfficeScenePlan(plan, { profileIds: new Set(["c1", "c2"]), now: 1 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /conversation/);
});
