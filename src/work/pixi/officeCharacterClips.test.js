import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  OFFICE_CHARACTER_IDS,
  OFFICE_CLIP_IDS,
  OFFICE_CLIP_METADATA,
  getCharacterClipSource,
  normalizeOfficeBaseUrl,
} from "./officeCharacterClips.js";
import {
  CONTACT_SHEET_MAX_DIMENSION,
  createContactSheetPlan,
} from "../../../scripts/build-office-v2-contact-sheets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const CHARACTER_IDS = [
  "employee-f-01", "employee-f-02", "employee-f-03", "employee-f-04",
  "employee-m-01", "employee-m-02", "employee-m-03", "employee-m-04",
  "boss-f-01", "boss-f-02", "boss-f-03", "boss-f-04",
  "boss-m-01", "boss-m-02", "boss-m-03", "boss-m-04",
];

const ACTION_CLIP_IDS = [
  "idle-seated", "idle-standing", "working", "slacking", "reading", "watching-series",
  "watching-short-video", "gaming", "phone-call", "video-meeting", "online-training",
  "sticky-planning", "tidy-desk", "desk-rest", "printing", "filing", "whiteboard-writing",
  "whiteboard-discussing", "reporting", "stretching", "screen-collaboration-host",
  "screen-collaboration-visitor", "document-submit", "document-sign", "computer-help-host",
  "computer-help-visitor", "parcel-receive", "chatting", "listening", "meal-pickup",
  "tray-carry", "eating", "drinking", "dining-chat", "dining-listen", "sofa-rest",
  "watching-tv", "sofa-chat", "sofa-listen", "quiet-rest", "waiting",
];

test("exports exactly the sixteen Task 7-10 character IDs", () => {
  assert.deepEqual(OFFICE_CHARACTER_IDS, CHARACTER_IDS);
  assert.equal(new Set(OFFICE_CHARACTER_IDS).size, 16);
  assert.deepEqual(
    ["employee-f", "employee-m", "boss-f", "boss-m"].map((prefix) => (
      OFFICE_CHARACTER_IDS.filter((id) => id.startsWith(prefix)).length
    )),
    [4, 4, 4, 4],
  );
});

test("exports one locomotion clip and the exact forty-one body-only action clips", () => {
  assert.deepEqual(OFFICE_CLIP_IDS, ["locomotion", ...ACTION_CLIP_IDS]);
  assert.equal(new Set(ACTION_CLIP_IDS).size, 41);
  assert.equal(Object.keys(OFFICE_CLIP_METADATA).length, 42);
});

test("defines four-direction eight-frame locomotion at exactly nine FPS", () => {
  assert.deepEqual(OFFICE_CLIP_METADATA.locomotion, {
    family: "locomotion",
    bodyOnly: true,
    lazy: false,
    width: 3072,
    height: 1536,
    cellSize: 384,
    columns: 8,
    rows: 4,
    frameCount: 8,
    fps: 9,
    loop: true,
    legalFacings: ["front", "left", "right", "back"],
    rowByFacing: { front: 0, left: 1, right: 2, back: 3 },
  });
});

test("defines every action as a lazy four-frame body-only strip with explicit playback metadata", () => {
  for (const clipId of ACTION_CLIP_IDS) {
    const metadata = OFFICE_CLIP_METADATA[clipId];
    assert.equal(metadata.family, "action", clipId);
    assert.equal(metadata.bodyOnly, true, clipId);
    assert.equal(metadata.lazy, true, clipId);
    assert.deepEqual(
      [metadata.width, metadata.height, metadata.cellSize, metadata.columns, metadata.rows, metadata.frameCount],
      [1536, 384, 384, 4, 1, 4],
      clipId,
    );
    assert.ok(Number.isInteger(metadata.fps) && metadata.fps > 0, `${clipId} requires an FPS`);
    assert.equal(typeof metadata.loop, "boolean", `${clipId} requires loop metadata`);
    assert.ok(metadata.legalFacings.length > 0, `${clipId} requires legal facing metadata`);
    assert.equal(
      metadata.legalFacings.every((facing) => ["front", "left", "right", "back"].includes(facing)),
      true,
      `${clipId} has an unknown facing`,
    );
  }

  assert.deepEqual(OFFICE_CLIP_METADATA["idle-seated"].legalFacings, ["front"]);
  assert.deepEqual(OFFICE_CLIP_METADATA.chatting.legalFacings, ["left", "right"]);
  assert.deepEqual(OFFICE_CLIP_METADATA["whiteboard-writing"].legalFacings, ["back"]);
  assert.deepEqual(OFFICE_CLIP_METADATA["watching-tv"].legalFacings, ["back"]);
  assert.equal(OFFICE_CLIP_METADATA["document-submit"].loop, false);
  assert.equal(OFFICE_CLIP_METADATA["parcel-receive"].loop, false);
});

test("resolves validated character sources with immutable frame metadata", () => {
  const source = getCharacterClipSource("boss-f-03", "working");
  assert.equal(source.src, "/work-office-v2/characters/boss-f-03/working.webp");
  assert.equal(source.clipId, "working");
  assert.equal(source.characterId, "boss-f-03");
  assert.equal(source.frameCount, 4);
  assert.equal(source.cellSize, 384);
  assert.equal(Object.isFrozen(source), true);
  assert.throws(() => getCharacterClipSource("unknown", "working"), /unknown office character/i);
  assert.throws(() => getCharacterClipSource("boss-f-03", "unknown"), /unknown office character clip/i);
});

test("derives character sources from a normalized runtime base URL", () => {
  assert.equal(normalizeOfficeBaseUrl("/preview"), "/preview/");
  assert.equal(normalizeOfficeBaseUrl("preview//"), "/preview/");
  assert.equal(
    getCharacterClipSource("employee-m-02", "locomotion", { baseUrl: "/preview/" }).src,
    "/preview/work-office-v2/characters/employee-m-02/locomotion.webp",
  );
});

test("paginates every character frame below encoder limits", () => {
  const cohort = createContactSheetPlan("boss-f");
  assert.equal(cohort.output, "docs/superpowers/qa/office-v2-boss-f-contact-sheet.webp");
  assert.equal(cohort.pages.length, 4);
  assert.equal(cohort.missing.length, 168);
  for (const page of cohort.pages) {
    assert.equal(page.frameCount, 196);
    assert.deepEqual(page.representativePairs.map(({ family, sizes }) => [family, sizes]), [
      ["locomotion", [384, 104]],
      ["action", [384, 104]],
    ]);
    assert.ok(page.width > 0 && page.width <= CONTACT_SHEET_MAX_DIMENSION);
    assert.ok(page.height > 0 && page.height <= CONTACT_SHEET_MAX_DIMENSION);
  }

  const all = createContactSheetPlan("all");
  assert.equal(all.pages.length, 16);
  assert.equal(Math.max(...all.pages.map(({ width, height }) => Math.max(width, height))) <= CONTACT_SHEET_MAX_DIMENSION, true);
  assert.equal(all.pages.some(({ output }) => output === "docs/superpowers/qa/office-v2-boss-f-contact-sheet.webp"), true);
});

test("contact-sheet CLI fails clearly for deferred assets and supports explicit allow-missing planning", () => {
  const script = path.join(ROOT, "scripts", "build-office-v2-contact-sheets.mjs");
  const missing = spawnSync(process.execPath, [script, "--characters", "boss-f"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /missing 168 required character strips/i);
  assert.match(missing.stderr, /Tasks 7-10/i);
  assert.match(missing.stderr, /--allow-missing/i);

  const allowed = spawnSync(process.execPath, [
    script, "--characters", "boss-f", "--allow-missing", "--dry-run",
  ], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(allowed.status, 0, allowed.stderr);
  const plan = JSON.parse(allowed.stdout);
  assert.deepEqual(plan.characterIds, CHARACTER_IDS.slice(8, 12));
  assert.equal(plan.missing.length, 168);
  assert.equal(plan.pages.length, 4);
  assert.equal(plan.pages.every(({ width, height }) => width <= CONTACT_SHEET_MAX_DIMENSION && height <= CONTACT_SHEET_MAX_DIMENSION), true);
  assert.equal(plan.output, "docs/superpowers/qa/office-v2-boss-f-contact-sheet.webp");
});
