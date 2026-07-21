import assert from "node:assert/strict";
import test from "node:test";
import { OFFICE_CLIP_IDS } from "./pixi/officeCharacterClips.js";
import { OFFICE_SCENES, getSceneAnchor } from "./officeSceneManifest.js";
import {
  OFFICE_ACTIVITY_MANIFEST,
  getActivityDefinition,
} from "./officeActivityManifest.js";

const REQUIRED_ACTIVITY_IDS = [
  "working", "slacking", "gaming", "reading", "watchingSeries", "watchingShortVideo",
  "phoneCall", "videoMeeting", "onlineTraining", "stickyPlanning", "tidyDesk", "deskRest",
  "printing", "filing", "whiteboardWork", "reporting", "screenCollaboration",
  "documentDelivery", "documentSigning", "computerHelp", "parcelReceive", "stretching",
  "eating", "drinking", "coffeeBreak", "waterBreak", "watchingTv", "sofaRest", "quietRest", "diningChat", "sofaChat",
  "chatting",
];

test("manifest defines every concrete office and lounge activity against scene anchors", () => {
  assert.deepEqual(Object.keys(OFFICE_ACTIVITY_MANIFEST), REQUIRED_ACTIVITY_IDS);

  for (const activityId of REQUIRED_ACTIVITY_IDS) {
    const definition = getActivityDefinition(activityId);
    assert.ok(definition, activityId);
    assert.equal(definition.id, activityId);
    assert.ok(OFFICE_SCENES[definition.sceneId], `${activityId} scene`);
    assert.ok(OFFICE_CLIP_IDS.includes(definition.clips.actor), `${activityId} actor clip`);
    for (const clipId of Object.values(definition.clips)) {
      assert.ok(OFFICE_CLIP_IDS.includes(clipId), `${activityId} ${clipId}`);
    }
    assert.ok(definition.targetAnchors.length > 0, `${activityId} anchors`);
    for (const anchorId of definition.targetAnchors) {
      const resolvedAnchorId = anchorId.replace("$actor", "employee1");
      assert.ok(getSceneAnchor(definition.sceneId, resolvedAnchorId), `${activityId} ${anchorId}`);
    }
    assert.ok(["exclusive", "shared"].includes(definition.reservationPolicy), `${activityId} reservation`);
    assert.ok(definition.durationMs.min > 0 && definition.durationMs.max >= definition.durationMs.min, `${activityId} duration`);
    assert.ok(definition.participants.min >= 1 && definition.participants.max >= definition.participants.min, `${activityId} participants`);
    assert.match(definition.status, /\S/u, `${activityId} status`);
    assert.match(definition.travelStatus, /\S/u, `${activityId} travel status`);
    assert.deepEqual(Object.keys(definition.semanticFallback), ["subject", "summary", "insightOrResult"]);
    assert.ok(Object.values(definition.semanticFallback).every((value) => /\S/u.test(value)), `${activityId} fallback`);
  }
});

test("manifest keeps visible props data-owned and never folds them into body-only clips", () => {
  for (const definition of Object.values(OFFICE_ACTIVITY_MANIFEST)) {
    assert.ok(definition.propState && typeof definition.propState === "object", definition.id);
    assert.ok(!Object.keys(definition.clips).some((key) => key.includes("prop")), definition.id);
    assert.ok(!Object.values(definition.clips).some((clipId) => definition.propState.variants.includes(clipId)), definition.id);
  }
});

test("manifest keeps whiteboard groups at three anchors and allows three desk visitors", () => {
  const whiteboard = getActivityDefinition("whiteboardWork");
  const chatting = getActivityDefinition("chatting");
  assert.deepEqual(whiteboard.targetAnchors, ["whiteboard:1", "whiteboard:2", "whiteboard:3"]);
  assert.equal(whiteboard.participants.max, 3);
  assert.deepEqual(chatting.targetAnchors, ["whiteboard:1", "whiteboard:2", "whiteboard:3"]);
  assert.equal(chatting.participants.max, 4);
  const first = getSceneAnchor("office", "whiteboard:1");
  const second = getSceneAnchor("office", "whiteboard:2");
  assert.ok(Math.hypot(second.x - first.x, second.y - first.y) >= 130,
    "the first two whiteboard actors need enough body clearance");
});

test("anchors every seated lounge action to real furniture", () => {
  assert.deepEqual(getActivityDefinition("watchingTv").targetAnchors, ["sofa:seat-2"]);
  assert.deepEqual(getActivityDefinition("sofaRest").targetAnchors, ["sofa:seat-2"]);
  assert.deepEqual(getActivityDefinition("quietRest").targetAnchors, ["sofa:seat-2"]);
  assert.deepEqual(getActivityDefinition("sofaChat").targetAnchors, ["sofa:seat-1", "sofa:seat-3"]);
  assert.deepEqual(getActivityDefinition("drinking").targetAnchors, ["sofa:seat-2"]);
  assert.equal(getActivityDefinition("drinking").clips.actor, "drinking");
  assert.deepEqual(getActivityDefinition("coffeeBreak").targetAnchors, ["pantry:coffee"]);
  assert.deepEqual(getActivityDefinition("waterBreak").targetAnchors, ["pantry:water"]);
  assert.deepEqual(getActivityDefinition("sofaRest").propState.variants, ["none"]);
  assert.equal(getActivityDefinition("chatting").propState.category, "none");
});
