import assert from "node:assert/strict";
import test from "node:test";
import { getOfficeGeometry } from "./officeGeometry.js";
import {
  getSegmentDuration,
  getSegmentFacing,
  planOfficePath,
  segmentIntersectsRect,
} from "./officePathfinding.js";

function pointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function connectorHitsObstacle(from, to, obstacle) {
  const endpoint = pointInsideRect(from, obstacle) ? from : pointInsideRect(to, obstacle) ? to : null;
  if (!endpoint) return segmentIntersectsRect(from, to, obstacle);
  if (pointInsideRect(endpoint, obstacle.visible)) return false;
  return segmentIntersectsRect(from, to, obstacle.visible);
}

function assertCollisionFree(path, obstacles) {
  for (let index = 1; index < path.length; index += 1) {
    const isEndpointConnector = index === 1 || index === path.length - 1;
    const hits = obstacles.some((obstacle) => (
      isEndpointConnector
        ? connectorHitsObstacle(path[index - 1], path[index], obstacle)
        : segmentIntersectsRect(path[index - 1], path[index], obstacle)
    ));
    assert.equal(hits, false, `segment ${index - 1}-${index} avoids furniture`);
  }
}

test("plans smoothed collision-free routes between every office destination", () => {
  const viewport = { width: 390, height: 844 };
  const geometry = getOfficeGeometry(viewport);
  const destinations = { ...geometry.homePoints, ...geometry.interactionPoints };

  for (const [fromId, start] of Object.entries(destinations)) {
    for (const [toId, goal] of Object.entries(destinations)) {
      if (fromId === toId) continue;
      const path = planOfficePath({ start, goal, viewport, obstacles: geometry.obstacles });
      assert.ok(path.length >= 2, `${fromId} routes to ${toId}`);
      assert.deepEqual(path[0], start);
      assert.deepEqual(path.at(-1), goal);
      assertCollisionFree(path, geometry.obstacles);
    }
  }
});

test("reroutes when a new obstacle blocks the direct line", () => {
  const viewport = { width: 390, height: 844 };
  const start = { x: 10, y: 90 };
  const goal = { x: 90, y: 90 };
  const direct = planOfficePath({ start, goal, viewport, obstacles: [] });
  const obstacle = { id: "block", left: 44, top: 82, right: 56, bottom: 98, visible: { left: 44, top: 82, right: 56, bottom: 98 } };
  const blocked = planOfficePath({ start, goal, viewport, obstacles: [obstacle] });

  assert.deepEqual(direct, [start, goal]);
  assert.ok(blocked.length > direct.length);
  assertCollisionFree(blocked, [obstacle]);
});

test("uses approved distance timing and horizontal facing", () => {
  const viewport = { width: 390, height: 844 };
  assert.equal(getSegmentDuration({ x: 10, y: 50 }, { x: 22, y: 50 }, viewport), 700);
  assert.equal(getSegmentDuration({ x: 10, y: 50 }, { x: 11, y: 50 }, viewport), 240);
  assert.equal(getSegmentFacing({ x: 50, y: 50 }, { x: 40, y: 50 }), "left");
  assert.equal(getSegmentFacing({ x: 40, y: 50 }, { x: 50, y: 50 }), "right");
});
