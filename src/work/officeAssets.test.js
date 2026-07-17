import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  OFFICE_CANVAS,
  OFFICE_MODULE_IDS,
  OFFICE_SLOT_RECTS,
} from "../../scripts/office-art-spec.mjs";
import {
  OFFICE_CHIBIS,
  getActivityFrame,
  getOfficeChibi,
} from "./officeAssets.js";

const CATEGORIES = [
  ["boss", "female", "boss-f", "女老板"],
  ["boss", "male", "boss-m", "男老板"],
  ["employee", "female", "employee-f", "女员工"],
  ["employee", "male", "employee-m", "男员工"],
];

const EXPECTED_IDS = CATEGORIES.flatMap(([, , prefix]) => (
  Array.from({ length: 4 }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`)
));

const EXPECTED_NAMES = CATEGORIES.flatMap(([, , , label]) => (
  Array.from({ length: 4 }, (_, index) => `${label} ${String(index + 1).padStart(2, "0")}`)
));

const publicAssetUrl = (src) => new URL(
  `../../public${src.replace(/^\/ai-roleplay-phone/, "")}`,
  import.meta.url,
);

const chibiAssetDirectory = fileURLToPath(new URL(
  "../../public/work-office-assets/chibi/",
  import.meta.url,
));

const readUint24LE = (buffer, offset) => (
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
);

const frame = (row, column) => ({
  index: (row * 8) + column,
  row,
  column,
  frameX: column * 104,
  frameY: row * 104,
  backgroundWidth: 832,
  backgroundHeight: 832,
  "--office-frame-index": (row * 8) + column,
  "--office-frame-row": row,
  "--office-frame-column": column,
});

test("ships sixteen transparent 8x8 WebP atlases", async () => {
  assert.equal(OFFICE_CHIBIS.length, 16);
  assert.deepEqual(OFFICE_CHIBIS.map((item) => item.id), EXPECTED_IDS);
  assert.deepEqual(OFFICE_CHIBIS.map((item) => item.name), EXPECTED_NAMES);
  assert.equal(new Set(OFFICE_CHIBIS.map((item) => item.src)).size, 16);

  for (const [kind, gender] of CATEGORIES) {
    assert.equal(
      OFFICE_CHIBIS.filter((item) => item.kind === kind && item.gender === gender).length,
      4,
    );
  }

  const assetFiles = (await readdir(chibiAssetDirectory)).sort();
  const expectedFiles = OFFICE_CHIBIS.map(({ id }) => `${id}.webp`).sort();
  const hashes = new Set();

  assert.deepEqual(assetFiles, expectedFiles);
  assert.equal(assetFiles.some((file) => file.endsWith(".png")), false);

  for (const item of OFFICE_CHIBIS) {
    assert.deepEqual(Object.keys(item), ["id", "name", "kind", "gender", "src", "columns", "rows"]);
    assert.ok(item.name.length > 0, `${item.id} should have a display name`);
    assert.match(item.src, /\/work-office-assets\/chibi\/(boss|employee)-[fm]-\d{2}\.webp$/);
    assert.equal(item.columns, 8);
    assert.equal(item.rows, 8);
    await access(publicAssetUrl(item.src));

    const asset = await readFile(publicAssetUrl(item.src));
    assert.equal(asset.toString("ascii", 0, 4), "RIFF", `${item.id} should be RIFF WebP`);
    assert.equal(asset.toString("ascii", 8, 12), "WEBP", `${item.id} should be WebP`);
    assert.equal(asset.toString("ascii", 12, 16), "VP8X", `${item.id} should use extended WebP`);
    assert.ok(asset[20] & 0x10, `${item.id} should declare an alpha channel`);
    assert.ok(asset.includes(Buffer.from("ALPH")), `${item.id} should contain alpha data`);
    assert.equal(readUint24LE(asset, 24) + 1, 1024, `${item.id} should be 1024px wide`);
    assert.equal(readUint24LE(asset, 27) + 1, 1024, `${item.id} should be 1024px tall`);
    hashes.add(createHash("sha256").update(asset).digest("hex"));
  }

  assert.equal(hashes.size, OFFICE_CHIBIS.length, "every chibi atlas should be unique");
});

const inspectDecodedAsset = async (page, buffer, rectangle = null) => page.evaluate(async (spec) => {
  const image = new Image();
  image.src = `data:image/webp;base64,${spec.base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let opaquePixels = 0;
  let outsideOpaquePixels = 0;
  let chromaFringePixels = 0;
  let transparentPixels = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = ((y * canvas.width) + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      if (alpha === 0) transparentPixels += 1;
      if (alpha >= 220) {
        opaquePixels += 1;
        if (spec.rectangle && (
          x < spec.rectangle.x
          || y < spec.rectangle.y
          || x >= spec.rectangle.x + spec.rectangle.width
          || y >= spec.rectangle.y + spec.rectangle.height
        )) outsideOpaquePixels += 1;
      }
      if (alpha > 0 && green > 180 && red < 100 && blue < 130) chromaFringePixels += 1;
    }
  }
  return {
    width: canvas.width,
    height: canvas.height,
    corners: [
      data[3],
      data[((canvas.width - 1) * 4) + 3],
      data[(((canvas.height - 1) * canvas.width) * 4) + 3],
      data[(((canvas.height * canvas.width) - 1) * 4) + 3],
    ],
    opaquePixels,
    outsideOpaquePixels,
    chromaFringePixels,
    transparentPixels,
  };
}, { base64: buffer.toString("base64"), rectangle });

test("ships one opaque background and fourteen unique transparent office modules", async () => {
  const officeAssetUrl = new URL("../../public/work-office-assets/", import.meta.url);
  const stationAssetUrl = new URL("stations/", officeAssetUrl);
  const breakAssetUrl = new URL("break/", officeAssetUrl);
  const rootFiles = (await readdir(officeAssetUrl)).sort();
  const stationFiles = (await readdir(stationAssetUrl)).sort();
  const breakFiles = (await readdir(breakAssetUrl)).sort();
  const expectedStationFiles = OFFICE_MODULE_IDS
    .filter((id) => !id.startsWith("break-"))
    .map((id) => `${id}.webp`)
    .sort();
  const expectedBreakFiles = OFFICE_MODULE_IDS
    .filter((id) => id.startsWith("break-"))
    .map((id) => `${id.slice("break-".length)}.webp`)
    .sort();
  const background = await readFile(new URL("office-bg.webp", officeAssetUrl));

  assert.ok(rootFiles.includes("office-bg.webp"));
  assert.equal(rootFiles.some((file) => file.endsWith(".png")), false);
  assert.deepEqual(stationFiles, expectedStationFiles);
  assert.deepEqual(breakFiles, expectedBreakFiles);
  assert.equal(stationFiles.some((file) => file.endsWith(".png")), false);
  assert.equal(breakFiles.some((file) => file.endsWith(".png")), false);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const decodedBackground = await inspectDecodedAsset(page, background);
    assert.deepEqual(
      [decodedBackground.width, decodedBackground.height],
      [OFFICE_CANVAS.width, OFFICE_CANVAS.height],
    );
    assert.deepEqual(decodedBackground.corners, [255, 255, 255, 255]);
    assert.equal(decodedBackground.transparentPixels, 0);

    const hashes = new Set();
    for (const id of OFFICE_MODULE_IDS) {
      const isBreak = id.startsWith("break-");
      const filename = isBreak ? `${id.slice("break-".length)}.webp` : `${id}.webp`;
      const directory = isBreak ? breakAssetUrl : stationAssetUrl;
      const rectangle = isBreak ? OFFICE_SLOT_RECTS.break : OFFICE_SLOT_RECTS[id.split("-")[0]];
      const asset = await readFile(new URL(filename, directory));
      const decoded = await inspectDecodedAsset(page, asset, rectangle);
      assert.deepEqual([decoded.width, decoded.height], [1080, 1920], `${id} dimensions`);
      assert.deepEqual(decoded.corners, [0, 0, 0, 0], `${id} transparent corners`);
      if (id === "break-both-occupied") {
        assert.equal(decoded.opaquePixels, 0, `${id} should let the built-in counter remain unobstructed`);
      } else {
        assert.ok(decoded.opaquePixels > 500, `${id} should contain decoded opaque subject pixels`);
      }
      assert.ok(decoded.transparentPixels > 500, `${id} should retain decoded transparency`);
      assert.equal(decoded.outsideOpaquePixels, 0, `${id} subject should remain inside its fixed slot`);
      assert.equal(decoded.chromaFringePixels, 0, `${id} should not retain green-key fringe`);
      hashes.add(createHash("sha256").update(asset).digest("hex"));
    }
    assert.equal(hashes.size, OFFICE_MODULE_IDS.length, "every office module should be unique");
  } finally {
    await browser.close();
  }
});

test("looks up a chibi within its role and falls back within the requested role", () => {
  assert.equal(getOfficeChibi("boss-m-03", "boss").id, "boss-m-03");
  assert.equal(getOfficeChibi("employee-f-04", "employee").id, "employee-f-04");
  assert.equal(getOfficeChibi("missing", "boss").id, "boss-f-01");
  assert.equal(getOfficeChibi("boss-f-01", "employee").id, "employee-f-01");
});

test("maps every direction and activity to the fixed atlas contract", () => {
  assert.deepEqual(getActivityFrame("walking", 7, "right"), frame(0, 7));
  assert.deepEqual(getActivityFrame("walking", 7, "front"), frame(1, 7));
  assert.deepEqual(getActivityFrame("walking", 7, "back"), frame(2, 7));
  assert.deepEqual(getActivityFrame("working", 3, "front"), frame(3, 3));
  assert.deepEqual(getActivityFrame("slacking", 3, "front"), frame(3, 7));
  assert.deepEqual(getActivityFrame("eating", 3, "front"), frame(4, 3));
  assert.deepEqual(getActivityFrame("gaming", 3, "front"), frame(4, 7));
  assert.deepEqual(getActivityFrame("reading", 3, "front"), frame(5, 3));
  assert.deepEqual(getActivityFrame("watchingSeries", 3, "front"), frame(5, 7));
  assert.deepEqual(getActivityFrame("watchingShortVideo", 3, "front"), frame(6, 3));
  assert.deepEqual(getActivityFrame("chatting", 3, "front"), frame(6, 7));
  assert.deepEqual(getActivityFrame("idle", 3, "front"), frame(7, 3));
  assert.deepEqual(getActivityFrame("listening", 3, "front"), frame(7, 7));
});

test("returns background-grid values that can be spread into a sprite style", () => {
  assert.deepEqual(getActivityFrame("working", 1), frame(3, 1));

  assert.deepEqual(getActivityFrame("unknown", 99), getActivityFrame("idle", 0));
});

test("uses integer CSS pixels for every atlas frame", () => {
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const value = getActivityFrame(
        row < 3 ? "walking" : "working",
        column,
        row === 1 ? "front" : row === 2 ? "back" : "right",
      );
      for (const key of ["frameX", "frameY", "backgroundWidth", "backgroundHeight"]) {
        assert.equal(Number.isInteger(value[key]), true, `${row}:${column} ${key}`);
      }
    }
  }
});
