import assert from "node:assert/strict";
import test from "node:test";
import { findOfficeRoute, getRouteFacing, OBJECT_DESTINATIONS } from "./officeNavigation.js";

test("routes to the raised tea counter", () => {
  assert.deepEqual(findOfficeRoute("boss-home", OBJECT_DESTINATIONS.tea), ["boss-home", "aisle-top", "tea-counter"]);
});

test("returns an empty route for invalid destinations", () => {
  assert.deepEqual(findOfficeRoute("boss-home", "missing"), []);
});

test("derives horizontal facing from waypoint coordinates", () => {
  assert.equal(getRouteFacing("aisle-center", "door-right-mid"), "right");
});

test("routes to all six employee desks", () => {
  for (let number = 1; number <= 6; number += 1) {
    const destination = OBJECT_DESTINATIONS[`employee${number}Desk`];
    assert.ok(destination, `employee ${number} destination exists`);
    assert.equal(findOfficeRoute("boss-home", destination).at(-1), `employee${number}-home`);
  }
});
