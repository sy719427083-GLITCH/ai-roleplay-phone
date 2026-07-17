import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
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
  backgroundSize: "800% 800%",
  backgroundPosition: `${(column / 7) * 100}% ${(row / 7) * 100}%`,
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
