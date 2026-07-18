import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  OFFICE_DOOR_PAIRS,
  OFFICE_SCENES,
  OFFICE_WORLD_SIZE,
  getSceneAnchor,
} from "./officeSceneManifest.js";

const readPackageMetadata = (fileName) => JSON.parse(readFileSync(
  new URL(`../../${fileName}`, import.meta.url),
  "utf8",
));

test("pins root package metadata to release version 0.2.98", () => {
  const packageMetadata = readPackageMetadata("package.json");
  const packageLockMetadata = readPackageMetadata("package-lock.json");

  assert.deepEqual([
    packageMetadata.version,
    packageLockMetadata.version,
    packageLockMetadata.packages[""].version,
  ], ["0.2.98", "0.2.98", "0.2.98"]);
});

test("defines two physical scenes and four identical employee desk instances", () => {
  assert.deepEqual(OFFICE_WORLD_SIZE, { width: 1080, height: 1920 });
  assert.deepEqual(Object.keys(OFFICE_SCENES).sort(), ["lounge", "office"]);
  const desks = OFFICE_SCENES.office.objects.filter((object) => object.templateId === "employee-desk");
  assert.equal(desks.length, 4);
  assert.equal(new Set(desks.map((desk) => desk.assetId)).size, 1);
  assert.deepEqual(desks.map((desk) => desk.slotId), ["employee1", "employee2", "employee3", "employee4"]);
});

test("pairs the lower-right office door with the lounge return door", () => {
  assert.deepEqual(OFFICE_DOOR_PAIRS["office:exit"], { sceneId: "lounge", anchorId: "entry" });
  assert.deepEqual(OFFICE_DOOR_PAIRS["lounge:exit"], { sceneId: "office", anchorId: "entry" });
  assert.ok(getSceneAnchor("office", "exit").x > 850);
  assert.ok(getSceneAnchor("office", "exit").y > 1600);
});

test("contains no rug or carpet objects", () => {
  const ids = Object.values(OFFICE_SCENES).flatMap((scene) => scene.objects.map((object) => object.id));
  assert.equal(ids.some((id) => /rug|carpet/i.test(id)), false);
});
