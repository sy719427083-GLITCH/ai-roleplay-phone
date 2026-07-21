import assert from "node:assert/strict";
import test from "node:test";
import { findOfficeRoute, getRouteFacing, OBJECT_DESTINATIONS } from "./officeNavigation.js";

test("routes around desks to the raised tea counter", () => {
  assert.deepEqual(findOfficeRoute("boss-home", OBJECT_DESTINATIONS.tea), ["boss-home", "aisle-top", "aisle-center", "aisle-bottom", "tea-counter"]);
});

test("returns an empty route for invalid destinations", () => {
  assert.deepEqual(findOfficeRoute("boss-home", "missing"), []);
});

test("derives horizontal facing from waypoint coordinates", () => {
  assert.equal(getRouteFacing("aisle-center", "door-right-mid"), "right");
});
