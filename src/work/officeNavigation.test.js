import assert from "node:assert/strict";
import test from "node:test";
import { getOfficePoint } from "./officeGeometry.js";
import { createOfficeRoute, OBJECT_DESTINATIONS } from "./officeNavigation.js";

test("creates timed routes for every clickable office destination", () => {
  const viewport = { width: 390, height: 844 };
  for (const fromId of Object.values(OBJECT_DESTINATIONS)) {
    for (const destination of Object.values(OBJECT_DESTINATIONS)) {
      const route = createOfficeRoute({ from: getOfficePoint(fromId), destination, viewport });
      if (fromId === destination) {
        assert.deepEqual(route, []);
        continue;
      }
      assert.ok(route.length > 0, `${fromId} routes to ${destination}`);
      assert.deepEqual(route.at(-1).point, getOfficePoint(destination));
      assert.equal(route.every((segment) => segment.durationMs >= 240 && ["left", "right"].includes(segment.facing)), true);
    }
  }
});

test("keeps all furniture destinations and removes every door destination", () => {
  assert.deepEqual(Object.keys(OBJECT_DESTINATIONS), [
    "bossDesk",
    "employee1Desk",
    "employee2Desk",
    "employee3Desk",
    "employee4Desk",
    "employee5Desk",
    "employee6Desk",
    "tea",
  ]);
  assert.equal(Object.keys(OBJECT_DESTINATIONS).some((key) => key.toLowerCase().includes("door")), false);
});

test("returns an empty route for invalid destinations", () => {
  assert.deepEqual(createOfficeRoute({ from: getOfficePoint("boss-home"), destination: "missing", viewport: { width: 390, height: 844 } }), []);
});
