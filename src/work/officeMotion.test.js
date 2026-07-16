import assert from "node:assert/strict";
import test from "node:test";
import {
  getRouteDistance,
  getWalkFrame,
  sampleOfficeRoute,
} from "./officeMotion.js";

test("moves linearly through a waypoint without teleporting", () => {
  const nodes = {
    a: { x: 0, y: 0 },
    b: { x: 10, y: 0 },
    c: { x: 10, y: 10 },
  };

  const before = sampleOfficeRoute({
    route: ["a", "b", "c"],
    startedAt: 0,
    now: 999,
    speed: 10,
    nodes,
  });
  const after = sampleOfficeRoute({
    route: ["a", "b", "c"],
    startedAt: 0,
    now: 1001,
    speed: 10,
    nodes,
  });

  assert.ok(Math.abs(before.x - after.x) < 0.03);
  assert.ok(Math.abs(before.y - after.y) < 0.03);
  assert.equal(before.facing, "right");
  assert.equal(after.facing, "front");
});

test("uses all eight walk frames at twelve fps", () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => (
    getWalkFrame({ startedAt: 0, now: index * 84, fps: 12 })
  )), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("reports total distance across valid route segments", () => {
  const nodes = {
    a: { x: 0, y: 0 },
    b: { x: 3, y: 4 },
    c: { x: 6, y: 8 },
  };

  assert.equal(getRouteDistance(["a", "b", "c"], nodes), 10);
});

test("keeps invalid and single-node routes at a stable point", () => {
  const nodes = {
    home: { x: 25, y: 52 },
  };

  assert.deepEqual(sampleOfficeRoute({
    route: ["home"],
    startedAt: 0,
    now: 5000,
    speed: 18,
    nodes,
  }), {
    x: 25,
    y: 52,
    facing: "front",
    segmentIndex: 0,
    done: true,
  });

  assert.deepEqual(sampleOfficeRoute({
    route: ["missing"],
    startedAt: 0,
    now: 5000,
    speed: 18,
    nodes,
  }), {
    x: 50,
    y: 50,
    facing: "front",
    segmentIndex: 0,
    done: true,
  });
});
