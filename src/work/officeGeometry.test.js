import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_HOME_POINTS,
  OFFICE_INTERACTION_POINTS,
  OFFICE_LAYOUT,
  getOfficeGeometry,
  getOfficePoint,
} from "./officeGeometry.js";

function pointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

test("centers avatars behind the visible desk art", () => {
  assert.deepEqual(OFFICE_HOME_POINTS["boss-home"], { x: 50, y: 24 });
  assert.deepEqual([1, 3, 5].map((number) => OFFICE_HOME_POINTS[`employee${number}-home`].x), [22, 22, 22]);
  assert.deepEqual([2, 4, 6].map((number) => OFFICE_HOME_POINTS[`employee${number}-home`].x), [78, 78, 78]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((number) => OFFICE_HOME_POINTS[`employee${number}-home`].y), [40, 40, 56, 56, 72, 72]);
});

test("uses the approved smart print station and lower-right approach", () => {
  assert.deepEqual(OFFICE_LAYOUT.printStation, {
    top: 11,
    right: 0,
    width: 48,
    height: 14,
    alpha: [79 / 900, 9 / 520, 820 / 900, 505 / 520],
  });
  assert.deepEqual(OFFICE_INTERACTION_POINTS["print-station"], { x: 93, y: 31 });
});

test("derives responsive visible furniture bounds and keeps destinations traversable", () => {
  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    const geometry = getOfficeGeometry(viewport);
    assert.equal(geometry.obstacles.length, 8);
    for (const [id, point] of Object.entries({ ...geometry.homePoints, ...geometry.interactionPoints })) {
      const visibleOverlaps = geometry.obstacles.filter((rect) => pointInsideRect(point, rect.visible));
      const ownDeskId = id.replace("-home", "Desk");
      assert.equal(visibleOverlaps.every((rect) => rect.id === ownDeskId), true, `${id} only overlaps its own desk art`);
    }
  }

  assert.notDeepEqual(
    getOfficeGeometry({ width: 375, height: 812 }).obstacles,
    getOfficeGeometry({ width: 390, height: 844 }).obstacles,
  );
  assert.deepEqual(getOfficePoint("employee6-home"), { x: 78, y: 72 });
  assert.equal(getOfficePoint("missing"), null);
});
