import assert from "node:assert/strict";
import test from "node:test";
import { getBreakroomGeometry, getBreakroomPoint } from "./breakroomGeometry.js";
import { BREAKROOM_DESTINATIONS, createBreakroomRoute } from "./breakroomNavigation.js";

const viewport = { width: 390, height: 844 };

function inside(point, obstacle) {
  return point.x > obstacle.left && point.x < obstacle.right
    && point.y > obstacle.top && point.y < obstacle.bottom;
}

test("declares the approved zoned room destinations", () => {
  assert.deepEqual(BREAKROOM_DESTINATIONS, {
    drinkCounter: "drink-counter",
    coffeeMachine: "coffee-machine",
    fridge: "fridge",
    microwave: "microwave",
    snackCabinet: "snack-cabinet",
    diningTable: "dining-table",
  });
  assert.equal(Object.keys(BREAKROOM_DESTINATIONS).some((key) => key.toLowerCase().includes("chair")), false);
});

test("routes from the entrance to every facility without crossing furniture", () => {
  const geometry = getBreakroomGeometry(viewport);
  for (const destination of Object.values(BREAKROOM_DESTINATIONS)) {
    const route = createBreakroomRoute({
      from: getBreakroomPoint("entry"),
      destination,
      viewport,
    });
    assert.ok(route.length > 0, `entry routes to ${destination}`);
    assert.deepEqual(route.at(-1).point, getBreakroomPoint(destination));
    assert.equal(route.every((segment) => geometry.obstacles.every((obstacle) => !inside(segment.point, obstacle))), true);
    assert.equal(route.every((segment) => segment.durationMs >= 240), true);
  }
});

test("routes between every facility and rejects missing destinations", () => {
  for (const fromId of Object.values(BREAKROOM_DESTINATIONS)) {
    for (const destination of Object.values(BREAKROOM_DESTINATIONS)) {
      const route = createBreakroomRoute({ from: getBreakroomPoint(fromId), destination, viewport });
      if (fromId === destination) assert.deepEqual(route, []);
      else assert.deepEqual(route.at(-1).point, getBreakroomPoint(destination));
    }
  }
  assert.deepEqual(createBreakroomRoute({ from: getBreakroomPoint("entry"), destination: "missing", viewport }), []);
});
