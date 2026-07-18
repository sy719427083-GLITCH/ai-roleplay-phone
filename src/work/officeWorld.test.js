import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorldRoute,
  createOverlaySnapshot,
  sampleWorldRoute,
  separateActors,
} from "./officeWorld.js";
import { isLegalCharacterPosition } from "./officePathfinding.js";

const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);

test("crosses scenes only through paired doors", () => {
  const route = buildWorldRoute({
    from: { sceneId: "office", x: 250, y: 980 },
    to: { sceneId: "lounge", x: 540, y: 820 },
  });
  const transfer = route.filter((point) => point.transition);

  assert.equal(transfer.length, 1);
  assert.deepEqual(transfer[0], {
    transition: true,
    from: { sceneId: "office", anchorId: "exit" },
    to: { sceneId: "lounge", anchorId: "entry" },
  });
  assert.equal(route.every((entry) => entry.transition || (
    typeof entry.sceneId === "string" && Number.isFinite(entry.x) && Number.isFinite(entry.y)
  )), true);
});

test("keeps same-scene routes as coordinate entries without a transition", () => {
  const route = buildWorldRoute({
    from: { sceneId: "office", x: 250, y: 1015 },
    to: { sceneId: "office", x: 300, y: 1540 },
  });

  assert.equal(route.length > 1, true);
  assert.equal(route.some((entry) => entry.transition), false);
  assert.deepEqual(route[0], { sceneId: "office", x: 250, y: 1015 });
  assert.deepEqual(route.at(-1), { sceneId: "office", x: 300, y: 1540 });
});

test("samples movement continuously and carries remaining distance through a door", () => {
  const route = [
    { sceneId: "office", x: 927, y: 1770 },
    { sceneId: "office", x: 940, y: 1770 },
    {
      transition: true,
      from: { sceneId: "office", anchorId: "exit" },
      to: { sceneId: "lounge", anchorId: "entry" },
    },
    { sceneId: "lounge", x: 130, y: 1710 },
    { sceneId: "lounge", x: 130, y: 1610 },
  ];
  const samples = Array.from({ length: 90 }, (_, index) => sampleWorldRoute({
    route,
    startedAt: 0,
    now: index * 16,
    speed: 92,
  }));
  const officeSamples = samples.filter((sample) => sample.sceneId === "office");
  const loungeSamples = samples.filter((sample) => sample.sceneId === "lounge");

  assert.ok(Math.max(...officeSamples.slice(1).map((sample, index) => distance(sample, officeSamples[index]))) < 4);
  assert.ok(Math.max(...loungeSamples.slice(1).map((sample, index) => distance(sample, loungeSamples[index]))) < 4);
  assert.deepEqual(sampleWorldRoute({ route, startedAt: 0, now: 500, speed: 100 }), {
    sceneId: "lounge",
    x: 130,
    y: 1673,
    facing: "back",
    segmentIndex: 1,
    done: false,
  });
});

test("keeps every dense cross-scene sample outside furniture", () => {
  const route = buildWorldRoute({
    from: { sceneId: "office", x: 250, y: 980 },
    to: { sceneId: "lounge", x: 540, y: 820 },
  });
  const times = new Set(Array.from({ length: 4_001 }, (_, index) => index * 5));
  times.add(14_500);

  for (const now of times) {
    const sample = sampleWorldRoute({ route, startedAt: 0, now, speed: 92 });
    assert.equal(isLegalCharacterPosition(sample.sceneId, sample), true, `illegal sample at ${now}ms`);
  }
});

test("rejects direct and forged cross-scene route entries at the stable first coordinate", () => {
  const first = { sceneId: "office", x: 940, y: 1770 };
  const routes = [
    [first, { sceneId: "lounge", x: 130, y: 1710 }],
    [
      first,
      {
        transition: true,
        from: { sceneId: "office", anchorId: "exit" },
        to: { sceneId: "lounge", anchorId: "exit" },
      },
      { sceneId: "lounge", x: 90, y: 1780 },
    ],
    [
      { sceneId: "office", x: 927, y: 1770 },
      {
        transition: true,
        from: { sceneId: "office", anchorId: "exit" },
        to: { sceneId: "lounge", anchorId: "entry" },
      },
      { sceneId: "lounge", x: 130, y: 1710 },
    ],
  ];

  for (const route of routes) {
    const sample = sampleWorldRoute({ route, startedAt: 0, now: 10_000, speed: 100 });
    assert.equal(sample.sceneId, route[0].sceneId);
    assert.equal(sample.facing, "front");
    assert.equal(sample.segmentIndex, 0);
    assert.equal(sample.done, true);
    assert.equal(isLegalCharacterPosition(sample.sceneId, sample), true);
  }
});

test("normalizes an illegal invalid-route fallback before returning it", () => {
  const sample = sampleWorldRoute({
    route: [
      { sceneId: "office", x: 900, y: 1770 },
      { sceneId: "lounge", x: 130, y: 1710 },
    ],
    startedAt: 0,
    now: 10_000,
  });

  assert.equal(sample.done, true);
  assert.equal(isLegalCharacterPosition(sample.sceneId, sample), true);
});

test("rejects physically illegal same-scene routes at a stable legal fallback", () => {
  const endpoint = { sceneId: "office", x: 500, y: 500 };
  const sample = sampleWorldRoute({
    route: [
      { sceneId: "office", x: 250, y: 1015 },
      endpoint,
    ],
    startedAt: 0,
    now: 10_000,
    speed: 100,
  });

  assert.equal(sample.sceneId, "office");
  assert.equal(sample.done, true);
  assert.equal(isLegalCharacterPosition(sample.sceneId, sample), true);
  assert.notDeepEqual({ x: sample.x, y: sample.y }, { x: endpoint.x, y: endpoint.y });

  const segmentEnd = { sceneId: "office", x: 285, y: 1485 };
  const segmentSample = sampleWorldRoute({
    route: [
      { sceneId: "office", x: 255, y: 1455 },
      segmentEnd,
    ],
    startedAt: 0,
    now: 10_000,
    speed: 100,
  });

  assert.equal(segmentSample.sceneId, "office");
  assert.equal(segmentSample.done, true);
  assert.equal(isLegalCharacterPosition(segmentSample.sceneId, segmentSample), true);
  assert.notDeepEqual(
    { x: segmentSample.x, y: segmentSample.y },
    { x: segmentEnd.x, y: segmentEnd.y },
  );
});

test("finds a guaranteed legal fallback for far-invalid first coordinates", () => {
  const first = { sceneId: "office", x: -1000, y: -1000 };
  const sample = sampleWorldRoute({
    route: [first, { sceneId: "office", x: 250, y: 1015 }],
    startedAt: 0,
    now: 0,
  });

  assert.equal(sample.sceneId, "office");
  assert.equal(sample.done, true);
  assert.equal(isLegalCharacterPosition(sample.sceneId, sample), true);
  assert.notDeepEqual({ x: sample.x, y: sample.y }, { x: first.x, y: first.y });
  assert.deepEqual(sampleWorldRoute({
    route: [{ sceneId: "unknown", x: 500, y: 500 }],
  }), { sceneId: null, x: 0, y: 0, facing: "front", segmentIndex: 0, done: true });
});

test("separates moving actors in one scene and holds the later owner at an illegal sidestep", () => {
  const separated = separateActors([
    { id: "first", sceneId: "office", x: 500, y: 650, moving: true, routeStartedAt: 1, facing: "right" },
    { id: "later", sceneId: "office", x: 520, y: 650, moving: true, routeStartedAt: 2, facing: "right" },
  ]);

  assert.ok(distance(separated[0], separated[1]) >= 52);

  const waiting = separateActors([
    { id: "first", sceneId: "office", x: 520, y: 620, moving: true, routeStartedAt: 1, facing: "right" },
    {
      id: "later",
      sceneId: "office",
      x: 540,
      y: 620,
      previousPosition: { x: 600, y: 620 },
      moving: true,
      routeStartedAt: 2,
      facing: "right",
    },
  ]);

  assert.deepEqual({ x: waiting[1].x, y: waiting[1].y, waiting: waiting[1].waiting }, {
    x: 600,
    y: 620,
    waiting: true,
  });
});

test("keeps all three moving actors separated and makes the latest owner wait deterministically", () => {
  const separated = separateActors([
    {
      id: "first",
      sceneId: "office",
      x: 500,
      y: 650,
      previousPosition: { x: 450, y: 650 },
      moving: true,
      routeStartedAt: 1,
      facing: "right",
    },
    {
      id: "second",
      sceneId: "office",
      x: 520,
      y: 650,
      previousPosition: { x: 520, y: 720 },
      moving: true,
      routeStartedAt: 2,
      facing: "right",
    },
    {
      id: "third",
      sceneId: "office",
      x: 540,
      y: 650,
      previousPosition: { x: 700, y: 650 },
      moving: true,
      routeStartedAt: 3,
      facing: "right",
    },
  ]);

  for (let left = 0; left < separated.length; left += 1) {
    for (let right = left + 1; right < separated.length; right += 1) {
      assert.ok(distance(separated[left], separated[right]) >= 52);
    }
  }
  assert.deepEqual({ x: separated[2].x, y: separated[2].y, waiting: separated[2].waiting }, {
    x: 700,
    y: 650,
    waiting: true,
  });
});

test("finds legal waiting positions when previous positions are occupied", () => {
  const groups = [
    [
      { id: "first", sceneId: "office", x: 520, y: 620, moving: true, routeStartedAt: 1, facing: "right" },
      { id: "later", sceneId: "office", x: 540, y: 620, previousPosition: { x: 520, y: 620 }, moving: true, routeStartedAt: 2, facing: "right" },
    ],
    [
      { id: "first", sceneId: "office", x: 520, y: 620, moving: true, routeStartedAt: 1, facing: "right" },
      { id: "second", sceneId: "office", x: 540, y: 620, previousPosition: { x: 520, y: 620 }, moving: true, routeStartedAt: 2, facing: "right" },
      { id: "third", sceneId: "office", x: 560, y: 620, previousPosition: { x: 520, y: 620 }, moving: true, routeStartedAt: 3, facing: "right" },
    ],
  ];

  for (const actors of groups) {
    const separated = separateActors(actors);
    for (let left = 0; left < separated.length; left += 1) {
      assert.equal(isLegalCharacterPosition(separated[left].sceneId, separated[left]), true);
      for (let right = left + 1; right < separated.length; right += 1) {
        assert.ok(distance(separated[left], separated[right]) >= 52);
      }
    }
    assert.equal(separated.at(-1).waiting, true);
  }
});

test("creates a serializable overlay snapshot for only the visible scene", () => {
  const snapshot = createOverlaySnapshot({
    actors: [
      { id: "office-actor", sceneId: "office", x: 250, y: 980, facing: "left", route: [{ x: 1 }] },
      { id: "lounge-actor", sceneId: "lounge", x: 540, y: 820, facing: "right", route: [{ x: 1 }] },
    ],
  }, "office");

  assert.deepEqual(snapshot, {
    sceneId: "office",
    actors: [{ id: "office-actor", x: 250, y: 980, facing: "left" }],
  });
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});
