import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_NODES,
  claimAnchor,
  findOfficeRoute,
  getFacing,
  releaseAnchor,
} from "./officeNavigation.js";

test("defines the office graph with percentage coordinates and explicit neighbors", () => {
  assert.deepEqual(OFFICE_NODES["employee1-home"], {
    id: "employee1-home",
    x: 12,
    y: 18,
    neighbors: ["employee1-exit"],
  });
  assert.deepEqual(OFFICE_NODES["employee1-exit"], {
    id: "employee1-exit",
    x: 22,
    y: 18,
    neighbors: ["employee1-home", "aisle-upper"],
  });
  assert.deepEqual(OFFICE_NODES["aisle-upper"], {
    id: "aisle-upper",
    x: 38,
    y: 18,
    neighbors: ["employee1-exit", "employee2-exit", "employee3-exit", "employee4-exit", "boss-exit", "aisle-lower"],
  });
  assert.deepEqual(OFFICE_NODES["aisle-lower"], {
    id: "aisle-lower",
    x: 38,
    y: 34,
    neighbors: ["aisle-upper", "break-1", "break-2", "chat-1", "chat-2", "chat-3", "chat-4", "meeting-1"],
  });
  assert.deepEqual(OFFICE_NODES["meeting-1"], {
    id: "meeting-1",
    x: 62,
    y: 34,
    neighbors: ["aisle-lower"],
  });
});

test("routes an employee through the aisle to the break area", () => {
  assert.deepEqual(findOfficeRoute("employee1-home", "break-1"), [
    "employee1-home",
    "employee1-exit",
    "aisle-upper",
    "aisle-lower",
    "break-1",
  ]);
});

test("returns an empty route for unknown or disconnected nodes", () => {
  assert.deepEqual(findOfficeRoute("missing-home", "break-1"), []);
  assert.deepEqual(findOfficeRoute("employee1-home", "missing-anchor"), []);
  assert.deepEqual(findOfficeRoute("employee1-home", "storage-closet"), []);
});

test("faces the destination horizontally", () => {
  assert.equal(getFacing("employee1-exit", "aisle-upper"), "right");
  assert.equal(getFacing("employee2-exit", "aisle-upper"), "left");
});

test("claims and releases anchors without mutating the source reservations", () => {
  const empty = {};
  const claimed = claimAnchor(empty, "break-1", "employee1");

  assert.deepEqual(empty, {});
  assert.deepEqual(claimed, {
    "break-1": { anchorId: "break-1", ownerId: "employee1" },
  });

  const wrongOwner = releaseAnchor(claimed, "break-1", "employee2");
  assert.deepEqual(wrongOwner, claimed);
  assert.notStrictEqual(wrongOwner, claimed);
  assert.deepEqual(claimed, {
    "break-1": { anchorId: "break-1", ownerId: "employee1" },
  });

  const released = releaseAnchor(claimed, "break-1", "employee1");
  assert.deepEqual(released, {});
  assert.deepEqual(claimed, {
    "break-1": { anchorId: "break-1", ownerId: "employee1" },
  });
});
