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

test("completes at the exact final route boundary", () => {
  const nodes = {
    a: { x: 0, y: 0 },
    b: { x: 10, y: 0 },
  };

  assert.deepEqual(sampleOfficeRoute({
    route: ["a", "b"],
    startedAt: 0,
    now: 1000,
    speed: 10,
    nodes,
  }), {
    x: 10,
    y: 0,
    facing: "front",
    segmentIndex: 1,
    done: true,
  });
});

test("enters the next segment at an exact internal waypoint", () => {
  const nodes = {
    a: { x: 0, y: 0 },
    b: { x: 10, y: 0 },
    c: { x: 10, y: 10 },
  };

  assert.deepEqual(sampleOfficeRoute({
    route: ["a", "b", "c"],
    startedAt: 0,
    now: 1000,
    speed: 10,
    nodes,
  }), {
    x: 10,
    y: 0,
    facing: "front",
    segmentIndex: 1,
    done: false,
  });
});

test("uses the safe default for zero, negative, and non-finite speeds", () => {
  const nodes = {
    a: { x: 0, y: 0 },
    b: { x: 10, y: 0 },
  };

  for (const speed of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const sample = sampleOfficeRoute({
      route: ["a", "b"],
      startedAt: 0,
      now: 1000,
      speed,
      nodes,
    });

    assert.equal(sample.done, true, `speed ${speed} should complete with the safe default`);
    assert.deepEqual({ x: sample.x, y: sample.y }, { x: 10, y: 0 });
  }
});

test("walk frames advance every 125ms", () => {
  assert.equal(getWalkFrame({ startedAt: 1000, now: 1124 }), 0);
  assert.equal(getWalkFrame({ startedAt: 1000, now: 1125 }), 1);
  assert.equal(getWalkFrame({ startedAt: 1000, now: 1999 }), 7);
  assert.equal(getWalkFrame({ startedAt: 1000, now: 2000 }), 0);
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
