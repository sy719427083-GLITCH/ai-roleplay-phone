import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  OFFICE_CHIBIS,
  getActorClipSource,
} from "./officeAssetManifest.js";
import { OFFICE_SCENES } from "../officeSceneManifest.js";

if (!globalThis.navigator) Object.defineProperty(globalThis, "navigator", { value: {} });

const { getActivityPropStates, OfficeSceneView } = await import("./OfficeSceneView.js");
const { OfficeActorView } = await import("./OfficeActorView.js");

const source = (fileName) => readFileSync(new URL(fileName, import.meta.url), "utf8");

test("resolves actor clips exclusively from the body-only character tree", () => {
  const clip = getActorClipSource({ characterId: "employee-f-01" }, "working");

  assert.equal(clip.src, "/work-office-v2/characters/employee-f-01/working.webp");
  assert.match(source("./OfficeActorView.js"), /AnimatedSprite/);
  assert.doesNotMatch(source("./OfficeActorView.js"), /work-office-assets\/chibi/);
  assert.equal(typeof OfficeActorView, "function");
});

test("keeps the four employee desk instances on one furniture alias", () => {
  const desks = OFFICE_SCENES.office.objects.filter(({ templateId }) => templateId === "employee-desk");

  assert.equal(desks.length, 4);
  assert.equal(new Set(desks.map(({ assetId }) => assetId)).size, 1);
  assert.equal(new Set(OFFICE_CHIBIS.map(({ src }) => src)).size, 16);
  assert.equal(OFFICE_CHIBIS.every(({ src }) => /\/work-office-v2\/characters\/[\w-]+\/idle-standing\.webp$/.test(src)), true);
});

test("anchors activity props to existing furniture surfaces and never creates furniture in syncProps", () => {
  const states = getActivityPropStates([
    { slotId: "employee1", sceneId: "office", activity: "working" },
    { slotId: "employee2", sceneId: "lounge", activity: "eating", anchorId: "dining:seat-1" },
    { slotId: "employee3", sceneId: "lounge", activity: "watching-tv" },
    { slotId: "employee4", sceneId: "office", activity: "desk-rest" },
  ]);

  assert.deepEqual(states.map(({ sceneId, objectId, anchorId }) => ({ sceneId, objectId, anchorId })), [
    { sceneId: "office", objectId: "employee1-desk", anchorId: "surface" },
    { sceneId: "lounge", objectId: "dining-table", anchorId: "seat-1:surface" },
    { sceneId: "lounge", objectId: "television", anchorId: "screen" },
    { sceneId: "office", objectId: "employee4-desk", anchorId: "surface" },
  ]);
  assert.deepEqual(states[1].propIds, ["meal-tray", "food-plate", "utensils"]);
  assert.deepEqual(states[2].propIds, ["television-content"]);
  assert.match(source("./OfficeSceneView.js"), /syncProps\(activityStates\)/);
  assert.doesNotMatch(source("./OfficeSceneView.js").slice(source("./OfficeSceneView.js").indexOf("  syncProps(activityStates)")), /createFurniture/);
  assert.equal(typeof OfficeSceneView, "function");
});

test("forwards each scene actor through the OfficeActorView sync envelope", () => {
  assert.match(source("./OfficeSceneView.js"), /view\.sync\(\{\s*actor,\s*motion: actor\.motion,\s*clip: actor\.clip,/);
});

test("lets each physical scene resolve prop ownership from the complete activity state set", () => {
  assert.match(source("./createOfficeRenderer.js"), /activityStates: world\.activityStates \|\| \[\]/);
});
