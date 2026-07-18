import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNavigationGrid,
  findScenePath,
  isLegalCharacterPosition,
} from "./officePathfinding.js";
import { OFFICE_SCENES } from "./officeSceneManifest.js";

const sampleSegment = (from, to, interval = 10) => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const samples = Math.max(1, Math.ceil(distance / interval));

  return Array.from({ length: samples + 1 }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / samples,
    y: from.y + ((to.y - from.y) * index) / samples,
  }));
};

test("routes around every employee desk without crossing colliders", () => {
  const path = findScenePath({
    sceneId: "office",
    from: { x: 540, y: 650 },
    to: { x: 940, y: 1770 },
  });

  assert.ok(path.length > 2);
  for (const point of path) assert.equal(isLegalCharacterPosition("office", point), true);
  for (let index = 1; index < path.length; index += 1) {
    for (const point of sampleSegment(path[index - 1], path[index])) {
      assert.equal(isLegalCharacterPosition("office", point), true);
    }
  }
});

test("builds a 30-pixel grid with 26-pixel capsule-expanded colliders", () => {
  const grid = buildNavigationGrid(OFFICE_SCENES.office, { radius: 26 });

  assert.equal(grid.width, 36);
  assert.equal(grid.height, 64);
  assert.equal(grid.isWalkableAt(18, 20), false);
  assert.equal(isLegalCharacterPosition("office", { x: 555, y: 615 }), false);
  assert.equal(isLegalCharacterPosition("office", { x: 555, y: 617 }), true);
});

test("routes from a legal endpoint even when its grid-cell center is blocked", () => {
  const from = { x: 555, y: 617 };
  const to = { x: 940, y: 1770 };
  const path = findScenePath({ sceneId: "office", from, to });

  assert.equal(isLegalCharacterPosition("office", from), true);
  assert.ok(path.length > 1);
  assert.deepEqual(path[0], from);
  assert.deepEqual(path.at(-1), to);
  for (let index = 1; index < path.length; index += 1) {
    for (const point of sampleSegment(path[index - 1], path[index])) {
      assert.equal(isLegalCharacterPosition("office", point), true);
    }
  }
});

test("rejects expanded-collider endpoints and dynamic-obstacle endpoints", () => {
  assert.deepEqual(findScenePath({
    sceneId: "office",
    from: { x: 555, y: 615 },
    to: { x: 940, y: 1770 },
  }), []);
  assert.deepEqual(findScenePath({
    sceneId: "office",
    from: { x: 540, y: 650 },
    to: { x: 940, y: 1770 },
    dynamicObstacles: [{ x: 914, y: 1744, width: 52, height: 52 }],
  }), []);
});

test("routes through a safe orthogonal detour when a diagonal clips an expanded collider", () => {
  const path = findScenePath({
    sceneId: "office",
    from: { x: 255, y: 1455 },
    to: { x: 285, y: 1485 },
  });

  assert.deepEqual(path, [
    { x: 255, y: 1455 },
    { x: 285, y: 1455 },
    { x: 285, y: 1485 },
  ]);
  for (let index = 1; index < path.length; index += 1) {
    for (const point of sampleSegment(path[index - 1], path[index])) {
      assert.equal(isLegalCharacterPosition("office", point), true);
    }
  }
});
