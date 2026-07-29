import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("keeps every desk and replaces the tea counter with a print station", () => {
  assert.deepEqual(Object.keys(OBJECT_DESTINATIONS), [
    "bossDesk",
    "employee1Desk",
    "employee2Desk",
    "employee3Desk",
    "employee4Desk",
    "employee5Desk",
    "employee6Desk",
    "printStation",
  ]);
  assert.equal(OBJECT_DESTINATIONS.printStation, "print-station");
  assert.equal(Object.keys(OBJECT_DESTINATIONS).includes("tea"), false);
});

test("office declares the clickable smart print station", () => {
  const assets = readFileSync("src/work/officeAssets.js", "utf8");
  assert.match(assets, /智能打印资料区/);
  assert.match(assets, /正在处理文件/);
  assert.match(assets, /orbit-print-station\.png/);
  assert.doesNotMatch(assets, /茶水吧台|orbit-tea-counter\.png/);
});

test("returns an empty route for invalid destinations", () => {
  assert.deepEqual(createOfficeRoute({ from: getOfficePoint("boss-home"), destination: "missing", viewport: { width: 390, height: 844 } }), []);
});

test("routes a guest to a runtime conversation point", () => {
  const destinationPoint = { x: 59, y: 64 };
  const route = createOfficeRoute({ from: getOfficePoint("employee1-home"), destinationPoint, viewport: { width: 390, height: 844 } });
  assert.ok(route.length > 0);
  assert.deepEqual(route.at(-1).point, destinationPoint);
});
