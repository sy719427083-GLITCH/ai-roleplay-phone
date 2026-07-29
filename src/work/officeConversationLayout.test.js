import assert from "node:assert/strict";
import test from "node:test";
import { createConversationGatherLayout } from "./officeConversationLayout.js";

test("keeps the first participant in place and gives guests distinct nearby targets", () => {
  const currentNodes = { a: { x: 24, y: 56 }, b: { x: 78, y: 56 }, c: { x: 22, y: 72 }, d: { x: 78, y: 72 } };
  const layout = createConversationGatherLayout({ participantIds: ["a", "b", "c", "d"], currentNodes });
  assert.equal(layout.hostId, "a");
  assert.deepEqual(layout.targets.a, currentNodes.a);
  assert.equal(new Set(["b", "c", "d"].map((id) => `${layout.targets[id].x}:${layout.targets[id].y}`)).size, 3);
  for (const id of ["b", "c", "d"]) {
    const horizontalPx = ((layout.targets[id].x - currentNodes.a.x) / 100) * 375;
    const verticalPx = ((layout.targets[id].y - currentNodes.a.y) / 100) * 812;
    assert.ok(Math.hypot(horizontalPx, verticalPx) >= 52, `${id} clears the 50px host avatar`);
  }
});

test("clamps guest targets inside the visible office", () => {
  const left = createConversationGatherLayout({ participantIds: ["a", "b", "c"], currentNodes: { a: { x: 2, y: 8 } } });
  const right = createConversationGatherLayout({ participantIds: ["a", "b", "c", "d"], currentNodes: { a: { x: 98, y: 94 } } });
  for (const point of [...Object.entries(left.targets), ...Object.entries(right.targets)].filter(([id]) => id !== "a").map(([, value]) => value)) {
    assert.ok(point.x >= 8 && point.x <= 92);
    assert.ok(point.y >= 14 && point.y <= 88);
  }
});

test("does not create a gathering layout for fewer than two people", () => {
  assert.deepEqual(createConversationGatherLayout({ participantIds: ["a"], currentNodes: { a: { x: 50, y: 50 } } }), { hostId: null, targets: {} });
});
