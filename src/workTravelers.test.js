import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import * as workTravelers from "./workTravelers.js";

const {
  DEFAULT_WORK_TRAVELER_ID,
  WORK_TRAVELER_GROUPS,
  WORK_TRAVELER_STORAGE_KEY,
  formatWorkDuration,
  getWorkTraveler,
  getWorkTravelerFallbackAsset,
  normalizeWorkTravelerId,
  persistWorkTravelerId,
  readStoredWorkTravelerId,
} = workTravelers;

const flattenTravelers = () => WORK_TRAVELER_GROUPS.flatMap((group) => group.travelers.map((traveler) => ({
  ...traveler,
  groupId: group.id,
})));

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const parseRgbaPng = (filePath) => {
  const data = readFileSync(filePath);
  assert.equal(data.toString("ascii", 1, 4), "PNG", `${filePath} must be a PNG`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      assert.equal(chunk[8], 8, `${filePath} must use 8-bit channels`);
      colorType = chunk[9];
      assert.equal(chunk[10], 0, `${filePath} must use deflate compression`);
      assert.equal(chunk[11], 0, `${filePath} must use standard PNG filter method`);
      assert.equal(chunk[12], 0, `${filePath} must be non-interlaced`);
    }

    if (type === "IDAT") {
      idatChunks.push(chunk);
    }

    offset += length + 12;
  }

  assert.equal(colorType, 6, `${filePath} must be RGBA color type 6`);
  assert.ok(width > 0 && height > 0, `${filePath} must declare dimensions`);

  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;
  let targetOffset = 0;
  let previousLine = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const line = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + scanlineLength));
    sourceOffset += scanlineLength;

    for (let x = 0; x < scanlineLength; x += 1) {
      const left = x >= bytesPerPixel ? line[x - bytesPerPixel] : 0;
      const up = previousLine[x] || 0;
      const upLeft = x >= bytesPerPixel ? previousLine[x - bytesPerPixel] : 0;

      if (filter === 1) {
        line[x] = (line[x] + left) & 255;
      } else if (filter === 2) {
        line[x] = (line[x] + up) & 255;
      } else if (filter === 3) {
        line[x] = (line[x] + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        line[x] = (line[x] + predictor) & 255;
      } else {
        assert.equal(filter, 0, `${filePath} must use a valid PNG filter`);
      }
    }

    line.copy(pixels, targetOffset);
    targetOffset += scanlineLength;
    previousLine = line;
  }

  return { width, height, pixels };
};

const alphaAt = ({ width, pixels }, x, y) => pixels[((y * width + x) * 4) + 3];

const getOpaqueCoverage = ({ pixels }) => {
  let opaquePixels = 0;

  for (let offset = 3; offset < pixels.length; offset += 4) {
    if (pixels[offset] > 220) {
      opaquePixels += 1;
    }
  }

  return opaquePixels / (pixels.length / 4);
};

test("defines four traveler groups with two distinct travelers each", () => {
  assert.deepEqual(
    WORK_TRAVELER_GROUPS.map((group) => ({ id: group.id, label: group.label })),
    [
      { id: "campus", label: "校园清新" },
      { id: "trend", label: "甜酷潮流" },
      { id: "literary", label: "温柔文艺" },
      { id: "luxe", label: "轻奢日常" },
    ],
  );

  const travelers = flattenTravelers();

  assert.equal(WORK_TRAVELER_GROUPS.length, 4);
  assert.ok(WORK_TRAVELER_GROUPS.every((group) => group.travelers.length === 2));
  assert.equal(travelers.length, 8);
  assert.equal(new Set(travelers.map((traveler) => traveler.id)).size, 8);
  assert.equal(new Set(travelers.map((traveler) => traveler.asset)).size, 8);
});

test("stores detailed metadata so travelers are not simple recolors", () => {
  const travelers = flattenTravelers();
  const femaleTravelers = travelers.filter((traveler) => traveler.gender === "female");
  const metadataSignature = (traveler) => [
    traveler.hair,
    traveler.headwear,
    traveler.bag,
    traveler.outfit,
    traveler.accent,
    traveler.shoes,
    traveler.silhouette,
  ].join("|");

  assert.equal(femaleTravelers.length, 4);
  assert.ok(femaleTravelers.every((traveler) => traveler.hair.startsWith("long-")));
  assert.ok(travelers.every((traveler) => (
    traveler.hair
    && traveler.headwear
    && traveler.bag
    && traveler.outfit
    && traveler.accent
    && traveler.shoes
    && traveler.silhouette
  )));
  assert.equal(new Set(travelers.map((traveler) => traveler.shoes)).size, travelers.length);
  assert.equal(new Set(travelers.map((traveler) => traveler.silhouette)).size, travelers.length);
  assert.equal(new Set(travelers.map(metadataSignature)).size, travelers.length);
  assert.ok(WORK_TRAVELER_GROUPS.every((group) => {
    const signatures = group.travelers.map(metadataSignature);
    return new Set(signatures).size === signatures.length;
  }));
});

test("normalizes invalid traveler ids back to the default traveler", () => {
  assert.equal(DEFAULT_WORK_TRAVELER_ID, "campus-female");
  assert.equal(normalizeWorkTravelerId(" trend-male "), "trend-male");
  assert.equal(normalizeWorkTravelerId("missing-traveler"), DEFAULT_WORK_TRAVELER_ID);
  assert.equal(normalizeWorkTravelerId(""), DEFAULT_WORK_TRAVELER_ID);
  assert.equal(getWorkTraveler("literary-male").name, "言舟");
  assert.equal(getWorkTraveler("missing-traveler").id, DEFAULT_WORK_TRAVELER_ID);
});

test("persists a dedicated work traveler id with invalid saved ids falling back", () => {
  assert.equal(typeof readStoredWorkTravelerId, "function");
  assert.equal(typeof persistWorkTravelerId, "function");

  const savedValues = new Map();
  const storage = {
    getItem: (key) => savedValues.get(key) || null,
    setItem: (key, value) => savedValues.set(key, value),
  };

  storage.setItem(WORK_TRAVELER_STORAGE_KEY, "ghost-traveler");
  assert.equal(readStoredWorkTravelerId(storage), DEFAULT_WORK_TRAVELER_ID);

  assert.equal(persistWorkTravelerId("luxe-male", storage), "luxe-male");
  assert.equal(storage.getItem(WORK_TRAVELER_STORAGE_KEY), "luxe-male");
  assert.equal(readStoredWorkTravelerId(storage), "luxe-male");
});

test("maps every traveler to a distinct same-gender fallback from the detailed registry", () => {
  assert.equal(typeof getWorkTravelerFallbackAsset, "function");

  const travelers = flattenTravelers();
  const registryAssets = new Set(travelers.map((traveler) => traveler.asset));
  const travelerSource = readFileSync(fileURLToPath(new URL("./workTravelers.js", import.meta.url)), "utf8");
  assert.ok(travelers.every((traveler) => /traveler-.+-(female|male)\.png$/.test(traveler.asset)));
  assert.ok(travelers.every((traveler) => traveler.asset !== "work-map-assets/traveler-female.png"));
  assert.ok(travelers.every((traveler) => traveler.asset !== "work-map-assets/traveler-male.png"));
  assert.equal(travelerSource.includes("traveler-female.png"), false);
  assert.equal(travelerSource.includes("traveler-male.png"), false);

  for (const traveler of travelers) {
    const fallbackAsset = getWorkTravelerFallbackAsset(traveler.id);
    const fallbackTraveler = travelers.find((candidate) => candidate.asset === fallbackAsset);
    const expectedFallbackId = traveler.groupId === "campus"
      ? `trend-${traveler.gender}`
      : `campus-${traveler.gender}`;

    assert.ok(registryAssets.has(fallbackAsset), `${traveler.id} fallback must use a registry asset`);
    assert.ok(existsSync(join(projectRoot, "public", fallbackAsset)), `${traveler.id} fallback must exist`);
    assert.equal(fallbackTraveler.gender, traveler.gender, `${traveler.id} fallback must preserve gender`);
    assert.equal(fallbackTraveler.id, expectedFallbackId, `${traveler.id} must use the required fallback traveler`);
    assert.notEqual(fallbackAsset, traveler.asset, `${traveler.id} fallback must differ from its primary asset`);
    assert.notEqual(fallbackAsset, "work-map-assets/traveler-female.png");
    assert.notEqual(fallbackAsset, "work-map-assets/traveler-male.png");
  }

  assert.equal(getWorkTravelerFallbackAsset("missing-traveler"), getWorkTravelerFallbackAsset(DEFAULT_WORK_TRAVELER_ID));
});

test("ships eight detailed transparent 256px traveler PNG assets and removes old generic sprites", () => {
  const travelers = flattenTravelers();

  for (const traveler of travelers) {
    const assetPath = join(projectRoot, "public", traveler.asset);
    assert.ok(existsSync(assetPath), `${traveler.id} asset must exist at ${traveler.asset}`);
    assert.ok(statSync(assetPath).size > 18_000, `${traveler.id} asset must retain non-trivial detail`);

    const image = parseRgbaPng(assetPath);
    assert.equal(image.width, 256, `${traveler.id} asset width`);
    assert.equal(image.height, 256, `${traveler.id} asset height`);
    assert.equal(alphaAt(image, 0, 0), 0, `${traveler.id} top-left corner must be transparent`);
    assert.equal(alphaAt(image, image.width - 1, 0), 0, `${traveler.id} top-right corner must be transparent`);
    assert.equal(alphaAt(image, 0, image.height - 1), 0, `${traveler.id} bottom-left corner must be transparent`);
    assert.equal(alphaAt(image, image.width - 1, image.height - 1), 0, `${traveler.id} bottom-right corner must be transparent`);
    assert.ok(getOpaqueCoverage(image) > 0.1, `${traveler.id} must have meaningful opaque subject coverage`);
    assert.ok(getOpaqueCoverage(image) < 0.68, `${traveler.id} must preserve transparent padding`);
  }

  assert.equal(existsSync(join(projectRoot, "public/work-map-assets/traveler-female.png")), false);
  assert.equal(existsSync(join(projectRoot, "public/work-map-assets/traveler-male.png")), false);
});

test("formats work durations with second accuracy", () => {
  assert.equal(formatWorkDuration(0), "00:00");
  assert.equal(formatWorkDuration(59_000), "00:59");
  assert.equal(formatWorkDuration(60_000), "01:00");
  assert.equal(formatWorkDuration(3_599_000), "59:59");
  assert.equal(formatWorkDuration(3_600_000), "01:00:00");
  assert.equal(formatWorkDuration(3_661_000), "01:01:01");
});
