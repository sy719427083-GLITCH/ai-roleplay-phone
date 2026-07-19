import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
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
const INSTALL_CHARACTER_IDS = ["boss-f-01", "boss-f-02", "boss-f-03", "boss-f-04"];

async function makeInstallFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "office-v2-install-"));
  const outputRoot = path.join(root, "characters");
  const stageRoot = path.join(root, "stage");
  const backupRoot = path.join(root, "backup");
  for (const characterId of INSTALL_CHARACTER_IDS) {
    await mkdir(path.join(outputRoot, characterId), { recursive: true });
    await mkdir(path.join(stageRoot, characterId), { recursive: true });
    await writeFile(path.join(outputRoot, characterId, "identity.txt"), `original:${characterId}`);
    await writeFile(path.join(stageRoot, characterId, "identity.txt"), `new:${characterId}`);
  }
  return { root, outputRoot, stageRoot, backupRoot };
}

async function assertOriginalAt(directory, characterId) {
  assert.equal(
    await readFile(path.join(directory, characterId, "identity.txt"), "utf8"),
    `original:${characterId}`,
  );
}

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

async function makeBodyShapeMaster(page, metadata, shape) {
  return page.evaluate(({ columns, rows, shape }) => {
    const cell = 512;
    const canvas = document.createElement("canvas");
    canvas.width = columns * cell;
    canvas.height = rows * cell;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(105, 92, 158)";
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * cell;
        const y = row * cell;
        if (shape === "outstretched-arms") {
          context.fillRect(x + 76, y + 205, 360, 18);
          context.beginPath();
          context.arc(x + 256, y + 115, 52, 0, Math.PI * 2);
          context.fill();
          context.fillRect(x + 205, y + 165, 102, 225);
          context.fillRect(x + 205, y + 365, 42, 82);
          context.fillRect(x + 265, y + 365, 42, 82);
        } else if (shape === "wide-long-hair") {
          context.beginPath();
          context.ellipse(x + 256, y + 235, 142, 190, 0, 0, Math.PI * 2);
          context.fill();
          context.clearRect(x + 215, y + 175, 82, 108);
          context.fillRect(x + 218, y + 250, 76, 175);
          context.fillRect(x + 218, y + 395, 30, 55);
          context.fillRect(x + 264, y + 395, 30, 55);
        } else if (shape === "flared-dress") {
          context.beginPath();
          context.arc(x + 256, y + 105, 50, 0, Math.PI * 2);
          context.fill();
          context.beginPath();
          context.moveTo(x + 220, y + 155);
          context.lineTo(x + 292, y + 155);
          context.lineTo(x + 402, y + 410);
          context.lineTo(x + 110, y + 410);
          context.closePath();
          context.fill();
          context.fillRect(x + 145, y + 400, 55, 48);
          context.fillRect(x + 312, y + 400, 55, 48);
        } else if (shape === "extended-limbs") {
          context.beginPath();
          context.arc(x + 256, y + 110, 50, 0, Math.PI * 2);
          context.fill();
          context.fillRect(x + 210, y + 160, 92, 190);
          context.lineWidth = 30;
          context.beginPath();
          context.moveTo(x + 225, y + 190);
          context.lineTo(x + 72, y + 315);
          context.moveTo(x + 287, y + 190);
          context.lineTo(x + 440, y + 80);
          context.moveTo(x + 235, y + 335);
          context.lineTo(x + 120, y + 448);
          context.moveTo(x + 277, y + 335);
          context.lineTo(x + 392, y + 448);
          context.stroke();
        }
      }
    }
    return canvas.toDataURL("image/png");
  }, { columns: metadata.columns, rows: metadata.rows, shape });
}

async function makeRectangularOutputStrip(page, metadata, shape) {
  return page.evaluate(({ metadata, shape }) => {
    const canvas = document.createElement("canvas");
    canvas.width = metadata.width;
    canvas.height = metadata.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(94, 82, 150)";
    for (let row = 0; row < metadata.rows; row += 1) {
      for (let column = 0; column < metadata.columns; column += 1) {
        const originX = column * metadata.cellSize;
        const originY = row * metadata.cellSize;
        const rectangleWidth = shape === "rectangle-220x80" ? 220 : 300;
        const rectangleX = originX + Math.round((metadata.cellSize - rectangleWidth) / 2);
        const rectangleY = originY + 100;
        context.fillRect(rectangleX, rectangleY, rectangleWidth, 80);
        if (shape === "rectangle-300x80-split") {
          context.clearRect(originX + Math.floor(metadata.cellSize / 2), rectangleY, 1, 80);
        }
        if (shape === "rectangle-300x80-legs") {
          context.fillRect(rectangleX + 48, rectangleY + 80, 2, 100);
          context.fillRect(rectangleX + rectangleWidth - 50, rectangleY + 80, 2, 100);
        }
      }
    }
    return canvas.toDataURL("image/webp", 0.95);
  }, { metadata, shape });
}

async function makeWebPRoundingMaster(page, metadata) {
  return page.evaluate(({ columns, rows }) => {
    const cell = 512;
    const canvas = document.createElement("canvas");
    canvas.width = columns * cell;
    canvas.height = rows * cell;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(105, 92, 158)";
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * cell;
        const y = row * cell;
        context.beginPath();
        context.arc(x + 256, y + 122, 58, 0, Math.PI * 2);
        context.fill();
        context.fillRect(x + 190, y + 178, 120, 210);
        context.fillRect(x + 160, y + 360, 35, 80);
        context.fillRect(x + 240, y + 352, 38, 88);
      }
    }
    return canvas.toDataURL("image/png");
  }, { columns: metadata.columns, rows: metadata.rows });
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

test("realigns post-WebP alpha rounding to the exact feet anchor", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const outputDataUrl = await normalizeCharacterMaster({
      page,
      sourceDataUrl: await makeWebPRoundingMaster(page, ACTION),
      metadata: ACTION,
      label: "fixture/webp-rounding",
    });
    const inspection = await inspectCharacterStrip({
      page,
      dataUrl: outputDataUrl,
      metadata: ACTION,
      label: "fixture/webp-rounding.webp",
    });
    assert.equal(
      inspection.frames.every(({ footAnchor }) => footAnchor.x === 192 && footAnchor.y === 359),
      true,
    );
    assert.deepEqual(inspection.gutterViolations, []);
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

for (const shape of ["outstretched-arms", "wide-long-hair", "flared-dress", "extended-limbs"]) {
  test(`accepts the body-only ${shape} silhouette`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const outputDataUrl = await normalizeCharacterMaster({
        page,
        sourceDataUrl: await makeBodyShapeMaster(page, ACTION, shape),
        metadata: ACTION,
        label: `fixture/${shape}`,
      });
      const inspection = await inspectCharacterStrip({
        page,
        dataUrl: outputDataUrl,
        metadata: ACTION,
        label: `fixture/${shape}.webp`,
      });
      assert.deepEqual(inspection.furnitureLikeFrames, []);
    } finally {
      await browser.close();
    }
  });
}

for (const shape of [
  "rectangle-220x80",
  "rectangle-300x80",
  "rectangle-300x80-split",
  "rectangle-300x80-legs",
]) {
  test(`rejects the body-only bypass fixture ${shape}`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const inspection = await inspectCharacterStrip({
        page,
        dataUrl: await makeRectangularOutputStrip(page, ACTION, shape),
        metadata: ACTION,
        label: `fixture/${shape}.webp`,
      });
      assert.deepEqual(inspection.gutterViolations, []);
      assert.deepEqual(inspection.furnitureLikeFrames, [0, 1, 2, 3]);
    } finally {
      await browser.close();
    }
  });
}

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
  let anchorX = 192;
  const browserFactory = async () => ({ newPage: async () => ({}), close: async () => {} });
  const inspectStrip = async ({ metadata }) => {
    inspected += 1;
    return {
      emptyFrames: [],
      gutterViolations: [],
      furnitureLikeFrames: [],
      frames: Array.from({ length: metadata.columns * metadata.rows }, (_, index) => ({
        index,
        transparentPixels: 100,
        usefulPixels: 100,
        footAnchor: { x: anchorX, y: 359 },
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

    anchorX = 193;
    await assert.rejects(
      verifyCharacterCohort({ root, cohort: "boss-f", browserFactory, inspectStrip }),
      /required feet anchor 192,359.*boss-f-01\/locomotion.*frames 0/i,
    );
    anchorX = 192;

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

test("cohort installation restores every original after an install rename fails", async () => {
  const { installCharacterCohort } = await import("./office-v2-character-art.mjs");
  const fixture = await makeInstallFixture();
  let installRenames = 0;
  try {
    await assert.rejects(
      installCharacterCohort({
        ...fixture,
        characterIds: INSTALL_CHARACTER_IDS,
        fileSystem: {
          rename: async (source, destination) => {
            if (path.dirname(source) === fixture.stageRoot && ++installRenames === 3) {
              throw new Error("injected install rename failure");
            }
            await rename(source, destination);
          },
        },
      }),
      /injected install rename failure/i,
    );
    for (const characterId of INSTALL_CHARACTER_IDS) {
      await assertOriginalAt(fixture.outputRoot, characterId);
    }
    assert.equal(existsSync(fixture.backupRoot), false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("cohort rollback retains backups and restores other originals when installed cleanup fails", async () => {
  const { installCharacterCohort } = await import("./office-v2-character-art.mjs");
  const fixture = await makeInstallFixture();
  let installRenames = 0;
  const blockedCharacter = INSTALL_CHARACTER_IDS[0];
  try {
    await assert.rejects(
      installCharacterCohort({
        ...fixture,
        characterIds: INSTALL_CHARACTER_IDS,
        fileSystem: {
          rename: async (source, destination) => {
            if (path.dirname(source) === fixture.stageRoot && ++installRenames === 3) {
              throw new Error("injected install rename failure");
            }
            await rename(source, destination);
          },
          rm: async (target, options) => {
            if (target === path.join(fixture.outputRoot, blockedCharacter)) {
              throw new Error("injected installed-dir removal failure");
            }
            await rm(target, options);
          },
        },
      }),
      new RegExp(`rollback failed.*${fixture.backupRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
    );
    assert.equal(
      await readFile(path.join(fixture.outputRoot, blockedCharacter, "identity.txt"), "utf8"),
      `new:${blockedCharacter}`,
    );
    await assertOriginalAt(fixture.backupRoot, blockedCharacter);
    for (const characterId of INSTALL_CHARACTER_IDS.slice(1)) {
      await assertOriginalAt(fixture.outputRoot, characterId);
    }
    assert.equal(existsSync(fixture.backupRoot), true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

for (const [position, failedCharacter] of [
  ["first", INSTALL_CHARACTER_IDS[3]],
  ["middle", INSTALL_CHARACTER_IDS[1]],
]) {
  test(`cohort rollback continues after the ${position} backup restoration fails`, async () => {
    const { installCharacterCohort } = await import("./office-v2-character-art.mjs");
    const fixture = await makeInstallFixture();
    let installRenames = 0;
    try {
      await assert.rejects(
        installCharacterCohort({
          ...fixture,
          characterIds: INSTALL_CHARACTER_IDS,
          fileSystem: {
            rename: async (source, destination) => {
              if (path.dirname(source) === fixture.stageRoot && ++installRenames === 3) {
                throw new Error("injected install rename failure");
              }
              if (source === path.join(fixture.backupRoot, failedCharacter)) {
                throw new Error(`injected ${position} restore failure`);
              }
              await rename(source, destination);
            },
          },
        }),
        new RegExp(`rollback failed.*${fixture.backupRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
      );
      await assertOriginalAt(fixture.backupRoot, failedCharacter);
      for (const characterId of INSTALL_CHARACTER_IDS.filter((id) => id !== failedCharacter)) {
        await assertOriginalAt(fixture.outputRoot, characterId);
      }
      assert.equal(existsSync(fixture.backupRoot), true);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
}

test("cohort installation retains all originals when committed backup cleanup fails", async () => {
  const { installCharacterCohort } = await import("./office-v2-character-art.mjs");
  const fixture = await makeInstallFixture();
  try {
    await assert.rejects(
      installCharacterCohort({
        ...fixture,
        characterIds: INSTALL_CHARACTER_IDS,
        fileSystem: {
          rm: async (target, options) => {
            if (target === fixture.backupRoot) throw new Error("injected backup cleanup failure");
            await rm(target, options);
          },
        },
      }),
      new RegExp(`installation committed.*${fixture.backupRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
    );
    for (const characterId of INSTALL_CHARACTER_IDS) {
      assert.equal(
        await readFile(path.join(fixture.outputRoot, characterId, "identity.txt"), "utf8"),
        `new:${characterId}`,
      );
      await assertOriginalAt(fixture.backupRoot, characterId);
    }
    assert.equal(existsSync(fixture.backupRoot), true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
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
