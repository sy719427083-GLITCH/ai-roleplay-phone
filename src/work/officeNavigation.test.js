import assert from "node:assert/strict";
import test from "node:test";
import { findOfficeRoute, getRouteFacing, OBJECT_DESTINATIONS, OFFICE_NODES } from "./officeNavigation.js";

test("routes to the raised tea counter", () => {
  assert.deepEqual(findOfficeRoute("boss-home", OBJECT_DESTINATIONS.tea), ["boss-home", "aisle-top", "tea-counter"]);
});

test("returns an empty route for invalid destinations", () => {
  assert.deepEqual(findOfficeRoute("boss-home", "missing"), []);
});

test("removes every door destination and waypoint", () => {
  assert.equal(Object.keys(OBJECT_DESTINATIONS).some((key) => key.toLowerCase().includes("door")), false);
  assert.equal(Object.keys(OFFICE_NODES).some((key) => key.includes("door")), false);
  assert.equal(Object.values(OFFICE_NODES).flatMap((node) => node.edges).some((edge) => edge.includes("door")), false);
});

test("derives horizontal facing from waypoint coordinates", () => {
  assert.equal(getRouteFacing("aisle-top", "tea-counter"), "right");
});

test("positions avatars behind desks and aligns the shifted tea counter", () => {
  assert.deepEqual(OFFICE_NODES["boss-home"], { x: 50, y: 24, edges: ["aisle-top"] });
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((number) => OFFICE_NODES[`employee${number}-home`].y), [40, 40, 56, 56, 72, 72]);
  assert.deepEqual(OFFICE_NODES["tea-counter"], { x: 79, y: 24, edges: ["aisle-top"] });
});

test("routes to all six employee desks", () => {
  for (let number = 1; number <= 6; number += 1) {
    const destination = OBJECT_DESTINATIONS[`employee${number}Desk`];
    assert.ok(destination, `employee ${number} destination exists`);
    assert.equal(findOfficeRoute("boss-home", destination).at(-1), `employee${number}-home`);
  }
});
