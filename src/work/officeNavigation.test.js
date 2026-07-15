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
  const ids = Object.keys(OFFICE_NODES);
  assert.equal(ids.filter((id) => id.endsWith("-home")).length, 5);
  assert.equal(ids.filter((id) => id.endsWith("-exit")).length, 5);
  assert.equal(ids.filter((id) => id.startsWith("aisle-")).length, 2);
  assert.equal(ids.filter((id) => id.startsWith("break-")).length, 2);
  assert.equal(ids.filter((id) => id.startsWith("chat-")).length, 4);
  assert.equal(ids.filter((id) => id === "meeting-1").length, 1);

  assert.deepEqual(OFFICE_NODES["employee1-home"], {
    id: "employee1-home",
    x: 25,
    y: 47,
    neighbors: ["employee1-exit"],
  });
  assert.deepEqual(OFFICE_NODES["employee1-exit"], {
    id: "employee1-exit",
    x: 36,
    y: 47,
    neighbors: ["employee1-home", "aisle-upper"],
  });
  assert.deepEqual(OFFICE_NODES["aisle-upper"], {
    id: "aisle-upper",
    x: 50,
    y: 43,
    neighbors: ["employee1-exit", "employee2-exit", "boss-exit", "aisle-lower", "chat-1", "chat-2"],
  });
  assert.deepEqual(OFFICE_NODES["aisle-lower"], {
    id: "aisle-lower",
    x: 50,
    y: 68,
    neighbors: ["aisle-upper", "employee3-exit", "employee4-exit", "break-1", "break-2", "chat-3", "chat-4", "meeting-1"],
  });
  assert.deepEqual(OFFICE_NODES["meeting-1"], {
    id: "meeting-1",
    x: 50,
    y: 57,
    neighbors: ["aisle-lower"],
  });
});

test("places the boss above every employee desk", () => {
  const bossY = OFFICE_NODES["boss-home"].y;
  const employeeHomeYs = [1, 2, 3, 4].map((employeeId) => (
    OFFICE_NODES[`employee${employeeId}-home`].y
  ));

  assert.ok(employeeHomeYs.every((employeeY) => bossY < employeeY));
});

test("places employees in aligned upper and lower desk rows", () => {
  const employee1 = OFFICE_NODES["employee1-home"];
  const employee2 = OFFICE_NODES["employee2-home"];
  const employee3 = OFFICE_NODES["employee3-home"];
  const employee4 = OFFICE_NODES["employee4-home"];

  assert.equal(employee1.y, employee2.y);
  assert.equal(employee3.y, employee4.y);
  assert.ok(employee1.y < employee3.y);
});

test("aligns the left and right desk columns", () => {
  assert.equal(OFFICE_NODES["employee1-home"].x, OFFICE_NODES["employee3-home"].x);
  assert.equal(OFFICE_NODES["employee1-exit"].x, OFFICE_NODES["employee3-exit"].x);
  assert.equal(OFFICE_NODES["employee2-home"].x, OFFICE_NODES["employee4-home"].x);
  assert.equal(OFFICE_NODES["employee2-exit"].x, OFFICE_NODES["employee4-exit"].x);
});

test("places break anchors below every employee desk", () => {
  const lowestDeskY = Math.max(
    ...[1, 2, 3, 4].map((employeeId) => OFFICE_NODES[`employee${employeeId}-home`].y),
  );

  assert.ok(OFFICE_NODES["break-1"].y > lowestDeskY);
  assert.ok(OFFICE_NODES["break-2"].y > lowestDeskY);
});

test("keeps every office node inside the safe frame", () => {
  for (const node of Object.values(OFFICE_NODES)) {
    assert.ok(node.x >= 5 && node.x <= 95, `${node.id} x should stay inside the safe frame`);
    assert.ok(node.y >= 5 && node.y <= 95, `${node.id} y should stay inside the safe frame`);
  }
});

test("keeps every connected edge bidirectional", () => {
  for (const [nodeId, node] of Object.entries(OFFICE_NODES)) {
    for (const neighborId of node.neighbors) {
      assert.ok(
        OFFICE_NODES[neighborId]?.neighbors.includes(nodeId),
        `${nodeId} should be reachable back from ${neighborId}`,
      );
    }
  }
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
  assert.equal(getFacing("missing-home", "aisle-upper"), null);
  assert.equal(getFacing("employee1-home", "missing-anchor"), null);
});

test("claims and releases anchors without mutating the source reservations", () => {
  const empty = {};
  const claimed = claimAnchor(empty, "break-1", "employee1");

  assert.deepEqual(empty, {});
  assert.deepEqual(claimed, {
    "break-1": { anchorId: "break-1", slotId: "employee1" },
  });

  assert.equal(claimAnchor(claimed, "break-2", "employee1"), null);
  assert.equal(claimAnchor(claimed, "break-1", "employee2"), null);

  const wrongOwner = releaseAnchor(claimed, "break-1", "employee2");
  assert.deepEqual(wrongOwner, claimed);
  assert.notStrictEqual(wrongOwner, claimed);
  assert.deepEqual(claimed, {
    "break-1": { anchorId: "break-1", slotId: "employee1" },
  });

  const released = releaseAnchor(claimed, "break-1", "employee1");
  assert.deepEqual(released, {});
  assert.deepEqual(claimed, {
    "break-1": { anchorId: "break-1", slotId: "employee1" },
  });
});
