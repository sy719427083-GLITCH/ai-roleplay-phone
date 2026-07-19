import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import {
  CHARACTER_COHORTS,
  collectCharacterCohortInventory,
  decodeWebPDataUrl,
  inspectCharacterStrip,
  normalizeCharacterCohort,
  normalizeCharacterMaster,
  validateCharacterMasterDimensions,
  writeValidatedWebPDataUrl,
} from "./office-v2-character-art.mjs";
import { OFFICE_CLIP_IDS, OFFICE_CLIP_METADATA } from "../src/work/pixi/officeCharacterClips.js";

const ACTION = OFFICE_CLIP_METADATA["idle-standing"];
const LOCOMOTION = OFFICE_CLIP_METADATA.locomotion;

async function makeMaster(page, metadata, { furniture = false } = {}) {
  return page.evaluate(({ columns, rows, furniture }) => {
    const cell = 512;
    const canvas = document.createElement("canvas");
    canvas.width = columns * cell;
    canvas.height = rows * cell;
    const context = canvas.getContext("2d");
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * cell;
        const y = row * cell;
        context.fillStyle = `rgb(${80 + column * 12}, ${90 + row * 10}, 150)`;
        if (furniture) {
          context.fillRect(x + 32, y + 210, 448, 180);
        } else {
          context.beginPath();
          context.arc(x + 250 + ((column % 3) - 1) * 18, y + 122, 58, 0, Math.PI * 2);
          context.fill();
          context.fillRect(x + 190, y + 178, 120, 210);
          context.fillRect(x + 176, y + 360, 54, 80);
          context.fillRect(x + 274, y + 352, 54, 88);
        }
      }
    }
    return canvas.toDataURL("image/png");
  }, { columns: metadata.columns, rows: metadata.rows, furniture });
}

test("defines the four approved character cohorts", () => {
  assert.deepEqual(CHARACTER_COHORTS, ["employee-f", "employee-m", "boss-f", "boss-m"]);
});

test("requires divisible generated masters with source cells at least 512 pixels", () => {
  assert.deepEqual(validateCharacterMasterDimensions({ width: 4096, height: 2048, metadata: LOCOMOTION }), {
    sourceCellWidth: 512,
    sourceCellHeight: 512,
  });
  assert.deepEqual(validateCharacterMasterDimensions({ width: 2048, height: 512, metadata: ACTION }), {
    sourceCellWidth: 512,
    sourceCellHeight: 512,
  });
  assert.throws(
    () => validateCharacterMasterDimensions({ width: 2047, height: 512, metadata: ACTION }),
    /divisible by 4 columns and 1 rows/i,
  );
  assert.throws(
    () => validateCharacterMasterDimensions({ width: 1600, height: 400, metadata: ACTION }),
    /at least 512x512/i,
  );
});

test("normalizes generated cells to aligned populated 384px WebP frames", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const sourceDataUrl = await makeMaster(page, ACTION);
    const outputDataUrl = await normalizeCharacterMaster({
      page,
      sourceDataUrl,
      metadata: ACTION,
      label: "fixture/idle-standing",
    });
    assert.ok(decodeWebPDataUrl(outputDataUrl).length > 0);
    const result = await inspectCharacterStrip({
      page,
      dataUrl: outputDataUrl,
      metadata: ACTION,
      label: "fixture/idle-standing.webp",
    });
    assert.deepEqual([result.width, result.height], [1536, 384]);
    assert.equal(result.emptyFrames.length, 0);
    assert.equal(result.gutterViolations.length, 0);
    assert.equal(result.furnitureLikeFrames.length, 0);
    assert.equal(result.frames.every(({ footAnchor }) => footAnchor.x === 192 && footAnchor.y === 359), true);
  } finally {
    await browser.close();
  }
});

test("detects furniture-like rectangular masses even when frame gutters are clear", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const sourceDataUrl = await makeMaster(page, ACTION, { furniture: true });
    await assert.rejects(
      normalizeCharacterMaster({
        page,
        sourceDataUrl,
        metadata: ACTION,
        label: "fixture/furniture",
      }),
      /furniture-like rectangular mass in frames 0, 1, 2, 3/i,
    );
  } finally {
    await browser.close();
  }
});

test("classifies fully absent, partial, and complete cohort inventories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "office-v2-inventory-"));
  try {
    assert.equal((await collectCharacterCohortInventory(root, "boss-f")).state, "absent");
    await mkdir(path.join(root, "boss-f-01"), { recursive: true });
    await writeFile(path.join(root, "boss-f-01", "locomotion.webp"), "partial");
    assert.equal((await collectCharacterCohortInventory(root, "boss-f")).state, "partial");

    for (let character = 1; character <= 4; character += 1) {
      const directory = path.join(root, `boss-f-0${character}`);
      await mkdir(directory, { recursive: true });
      await Promise.all(OFFICE_CLIP_IDS.map((clipId, index) => (
        writeFile(path.join(directory, `${clipId}.webp`), `${character}:${index}`)
      )));
    }
    const complete = await collectCharacterCohortInventory(root, "boss-f");
    assert.equal(complete.state, "complete");
    assert.equal(complete.missing.length, 0);
    assert.equal(complete.unexpected.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cohort verifier defers absent inventory, rejects partial inventory, and checks every complete strip", async () => {
  const { verifyCharacterCohort } = await import("./verify-office-v2-assets.mjs");
  const root = await mkdtemp(path.join(os.tmpdir(), "office-v2-verifier-"));
  const characterRoot = path.join(root, "characters");
  let inspected = 0;
  const browserFactory = async () => ({ newPage: async () => ({}), close: async () => {} });
  const inspectStrip = async ({ metadata }) => {
    inspected += 1;
    return {
      emptyFrames: [],
      gutterViolations: [],
      furnitureLikeFrames: [],
      frames: Array.from({ length: metadata.columns * metadata.rows }, () => ({
        transparentPixels: 100,
        usefulPixels: 100,
      })),
    };
  };
  try {
    assert.equal((await verifyCharacterCohort({ root, cohort: "boss-f", allowAbsent: true })).state, "absent");
    await mkdir(path.join(characterRoot, "boss-f-01"), { recursive: true });
    await writeFile(path.join(characterRoot, "boss-f-01", "locomotion.webp"), "partial");
    await assert.rejects(
      verifyCharacterCohort({ root, cohort: "boss-f", allowAbsent: true, browserFactory, inspectStrip }),
      /cohort boss-f is partial/i,
    );

    for (let character = 1; character <= 4; character += 1) {
      const directory = path.join(characterRoot, `boss-f-0${character}`);
      await mkdir(directory, { recursive: true });
      await Promise.all(OFFICE_CLIP_IDS.map((clipId, index) => (
        writeFile(path.join(directory, `${clipId}.webp`), `${character}:${index}`)
      )));
    }
    const complete = await verifyCharacterCohort({
      root,
      cohort: "boss-f",
      allowAbsent: true,
      browserFactory,
      inspectStrip,
    });
    assert.equal(complete.state, "complete");
    assert.equal(complete.verifiedStrips, 168);
    assert.equal(inspected, 168);

    const first = path.join(characterRoot, "boss-f-01", "locomotion.webp");
    const duplicate = path.join(characterRoot, "boss-f-01", "idle-seated.webp");
    await writeFile(duplicate, await readFile(first));
    await assert.rejects(
      verifyCharacterCohort({ root, cohort: "boss-f", browserFactory, inspectStrip }),
      /duplicate strips locomotion and idle-seated/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects invalid WebP data URLs before creating an output file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "office-v2-data-url-"));
  const output = path.join(root, "invalid.webp");
  try {
    assert.throws(() => decodeWebPDataUrl("data:image/png;base64,AAAA"), /valid WebP base64 data URL/i);
    await assert.rejects(
      writeValidatedWebPDataUrl(output, "data:image/webp;base64,", { expectedWidth: 1, expectedHeight: 1 }),
      /valid WebP base64 data URL/i,
    );
    assert.equal(existsSync(output), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validates all source masters before replacing any existing cohort directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "office-v2-transaction-"));
  const sourceRoot = path.join(root, "source", "boss-f");
  const outputRoot = path.join(root, "characters");
  const sentinel = path.join(outputRoot, "boss-f-01", "keep.txt");
  try {
    await mkdir(path.dirname(sentinel), { recursive: true });
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(sentinel, "preserve me");
    await assert.rejects(
      normalizeCharacterCohort({ sourceRoot, outputRoot, cohort: "boss-f" }),
      /missing 168 character source masters/i,
    );
    assert.equal(await readFile(sentinel, "utf8"), "preserve me");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
