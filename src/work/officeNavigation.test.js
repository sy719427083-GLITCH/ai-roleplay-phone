import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_NODES,
  claimAnchor,
  findOfficeRoute,
  getFacing,
  releaseAnchor,
} from "./officeNavigation.js";

const CENTRAL_AISLE = Object.freeze({ minX: 45, maxX: 60, minY: 34, maxY: 88 });
const LOWER_LEFT_OBSTRUCTION = Object.freeze({ minX: 5, maxX: 42, minY: 74, maxY: 90 });

const isInside = (node, rectangle) => (
  node.x >= rectangle.minX
  && node.x <= rectangle.maxX
  && node.y >= rectangle.minY
  && node.y <= rectangle.maxY
);

const assertRouteHasNoVerticalDetour = (route) => {
  const startY = OFFICE_NODES[route[0]].y;
  const destinationY = OFFICE_NODES[route.at(-1)].y;
  const minY = Math.min(startY, destinationY);
  const maxY = Math.max(startY, destinationY);
  let direction = 0;

  for (const nodeId of route) {
    const node = OFFICE_NODES[nodeId];
    assert.ok(node.y >= minY && node.y <= maxY, `${nodeId} should not overshoot the destination band`);
  }

  for (let index = 1; index < route.length; index += 1) {
    const previous = OFFICE_NODES[route[index - 1]];
    const current = OFFICE_NODES[route[index]];
    const nextDirection = Math.sign(current.y - previous.y);

    if (nextDirection === 0) continue;
    if (direction === 0) {
      direction = nextDirection;
      continue;
    }

    assert.equal(nextDirection, direction, `${route[index - 1]} -> ${route[index]} should not reverse vertically`);
  }
};

test("defines every required office navigation node group", () => {
  const ids = Object.keys(OFFICE_NODES);
  assert.equal(ids.filter((id) => id.endsWith("-home")).length, 5);
  assert.equal(ids.filter((id) => id.endsWith("-exit")).length, 5);
  assert.equal(ids.filter((id) => id.startsWith("aisle-")).length, 2);
  assert.equal(ids.filter((id) => id.startsWith("break-")).length, 2);
  assert.equal(ids.filter((id) => id.startsWith("chat-")).length, 4);
  assert.equal(ids.filter((id) => id === "meeting-1").length, 1);
});

test("moves the boss from chair feet down into the central aisle", () => {
  const home = OFFICE_NODES["boss-home"];
  const exit = OFFICE_NODES["boss-exit"];

  assert.ok(home.y >= 29 && home.y <= 33, "boss-home should sit at the chair feet");
  assert.ok(isInside(exit, CENTRAL_AISLE), "boss-exit should sit in the central aisle");
  assert.ok(exit.y - home.y >= 4, "boss should clear the chair before joining the aisle");
  assert.ok(Math.abs(exit.x - home.x) <= 3, "boss should leave through the open floor below the desk");
  assert.ok(exit.neighbors.includes("aisle-upper"));
});

test("moves employee desk routes horizontally from chair feet toward the central aisle", () => {
  const desks = [
    { slotId: "employee1", side: "left", minY: 50, maxY: 54, aisleId: "aisle-upper" },
    { slotId: "employee2", side: "right", minY: 50, maxY: 54, aisleId: "aisle-upper" },
    { slotId: "employee3", side: "left", minY: 69, maxY: 73, aisleId: "meeting-1" },
    { slotId: "employee4", side: "right", minY: 69, maxY: 73, aisleId: "meeting-1" },
  ];

  for (const { slotId, side, minY, maxY, aisleId } of desks) {
    const home = OFFICE_NODES[`${slotId}-home`];
    const exit = OFFICE_NODES[`${slotId}-exit`];
    const horizontalClearance = side === "left" ? exit.x - home.x : home.x - exit.x;

    assert.ok(home.y >= minY && home.y <= maxY, `${slotId}-home should sit at the chair feet`);
    assert.ok(isInside(exit, CENTRAL_AISLE), `${slotId}-exit should sit in the central aisle`);
    assert.ok(horizontalClearance >= 15, `${slotId} should clear the desk toward the aisle`);
    assert.ok(Math.abs(exit.y - home.y) <= 1, `${slotId} should cross the open floor in front of the desk`);
    assert.ok(exit.neighbors.includes(aisleId), `${slotId}-exit should join ${aisleId}`);
  }
});

test("aligns the break route with the open floor in front of both counter seats", () => {
  const aisleLower = OFFICE_NODES["aisle-lower"];
  const breakAnchors = [OFFICE_NODES["break-1"], OFFICE_NODES["break-2"]];

  assert.ok(aisleLower.x >= CENTRAL_AISLE.minX && aisleLower.x <= CENTRAL_AISLE.maxX);
  assert.ok(aisleLower.y >= 92 && aisleLower.y <= 95, "aisle-lower should reach the clear counter approach");

  for (const anchor of breakAnchors) {
    assert.ok(anchor.x >= 15 && anchor.x <= 34, `${anchor.id} should align with a visible counter seat`);
    assert.ok(anchor.y >= 92 && anchor.y <= 95, `${anchor.id} should sit in the front-seat foot band`);
    assert.ok(anchor.x < aisleLower.x, `${anchor.id} should approach from the central aisle`);
    assert.ok(Math.abs(anchor.y - aisleLower.y) <= 2, `${anchor.id} route should stay below the shelf obstruction`);
    assert.ok(anchor.neighbors.includes("aisle-lower"));
  }

  assert.ok(Math.abs(breakAnchors[0].x - breakAnchors[1].x) >= 10, "counter seats should remain distinct");
});

test("keeps chat and meeting anchors separated inside the unobstructed central aisle", () => {
  const chatAnchors = [1, 2, 3, 4].map((chatId) => OFFICE_NODES[`chat-${chatId}`]);
  const sharedAnchors = [...chatAnchors, OFFICE_NODES["meeting-1"]];

  for (const anchor of sharedAnchors) {
    assert.ok(isInside(anchor, CENTRAL_AISLE), `${anchor.id} should stay in the central aisle`);
    assert.ok(!isInside(anchor, LOWER_LEFT_OBSTRUCTION), `${anchor.id} should clear the pickup shelf and plant`);
  }

  for (let firstIndex = 0; firstIndex < chatAnchors.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < chatAnchors.length; secondIndex += 1) {
      const first = chatAnchors[firstIndex];
      const second = chatAnchors[secondIndex];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      assert.ok(distance >= 10, `${first.id} and ${second.id} should support separate groups`);
    }
  }
});

test("routes through the meeting anchor without overshooting and reversing", () => {
  const meeting = OFFICE_NODES["meeting-1"];

  assert.ok(meeting.y >= 69 && meeting.y <= 73, "meeting-1 should share the lower desk foot band");
  assert.ok(meeting.neighbors.includes("aisle-upper"));
  assert.ok(meeting.neighbors.includes("aisle-lower"));

  const inboundRoute = findOfficeRoute("employee1-home", "meeting-1");
  assert.deepEqual(inboundRoute, ["employee1-home", "employee1-exit", "aisle-upper", "meeting-1"]);
  assertRouteHasNoVerticalDetour(inboundRoute);

  const outboundRoute = findOfficeRoute("meeting-1", "break-1");
  assert.deepEqual(outboundRoute, ["meeting-1", "aisle-lower", "break-1"]);
  assertRouteHasNoVerticalDetour(outboundRoute);
});

test("routes lower employees through the meeting hub without vertical detours", () => {
  for (const slotId of ["employee3", "employee4"]) {
    const exit = OFFICE_NODES[`${slotId}-exit`];
    assert.ok(exit.neighbors.includes("meeting-1"), `${slotId}-exit should enter the meeting hub`);
    assert.ok(!exit.neighbors.includes("aisle-lower"), `${slotId}-exit should not overshoot to aisle-lower`);
  }

  for (const chatId of ["chat-1", "chat-2"]) {
    assert.ok(OFFICE_NODES[chatId].neighbors.includes("aisle-upper"), `${chatId} should remain on aisle-upper`);
  }

  for (const chatId of ["chat-3", "chat-4"]) {
    assert.ok(OFFICE_NODES[chatId].neighbors.includes("meeting-1"), `${chatId} should join the meeting hub`);
    assert.ok(!OFFICE_NODES[chatId].neighbors.includes("aisle-lower"), `${chatId} should avoid aisle-lower detours`);
  }

  const routeCases = [
    ["employee3-home", "meeting-1", ["employee3-home", "employee3-exit", "meeting-1"]],
    ["employee4-home", "meeting-1", ["employee4-home", "employee4-exit", "meeting-1"]],
    ["employee3-home", "chat-3", ["employee3-home", "employee3-exit", "meeting-1", "chat-3"]],
    ["employee4-home", "chat-4", ["employee4-home", "employee4-exit", "meeting-1", "chat-4"]],
    ["employee3-home", "chat-1", ["employee3-home", "employee3-exit", "meeting-1", "aisle-upper", "chat-1"]],
    ["employee4-home", "chat-2", ["employee4-home", "employee4-exit", "meeting-1", "aisle-upper", "chat-2"]],
    ["employee3-home", "break-1", ["employee3-home", "employee3-exit", "meeting-1", "aisle-lower", "break-1"]],
    ["employee4-home", "break-2", ["employee4-home", "employee4-exit", "meeting-1", "aisle-lower", "break-2"]],
  ];

  for (const [fromId, toId, expectedRoute] of routeCases) {
    const route = findOfficeRoute(fromId, toId);
    assert.deepEqual(route, expectedRoute);
    assertRouteHasNoVerticalDetour(route);
  }
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
