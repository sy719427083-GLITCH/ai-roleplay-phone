import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { WORK_ROUTE_BATCH_C } from "./workRouteBatches/batch-c.js";
import { WORK_MAP_THEMES } from "./workThemes.js";
import { validateWorkRouteTheme } from "./workRouteData.js";

const THEME_IDS = Object.freeze([
  "magic_world",
  "magic_academy",
  "island",
  "ocean",
  "republican",
]);

const PNG_IHDR_WIDTH_OFFSET = 16;
const PNG_IHDR_HEIGHT_OFFSET = 20;

const serializeSamples = (samples) => JSON.stringify(samples.map(({ x, y }) => [x, y]));

const isFiniteCoordinate = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

const assertValidPoint = (point, label) => {
  assert.ok(point, `${label} missing`);
  assert.ok(isFiniteCoordinate(point.x), `${label}.x must be finite normalized coordinate`);
  assert.ok(isFiniteCoordinate(point.y), `${label}.y must be finite normalized coordinate`);
};

const readPngDimensions = async (asset) => {
  const buffer = await readFile(path.join("public", "work-map-assets", asset));
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${asset} must be a PNG`);
  assert.ok(buffer.length > PNG_IHDR_HEIGHT_OFFSET, `${asset} PNG is too small`);
  return {
    width: buffer.readUInt32BE(PNG_IHDR_WIDTH_OFFSET),
    height: buffer.readUInt32BE(PNG_IHDR_HEIGHT_OFFSET),
  };
};

test("batch C exports exactly its five calibrated route themes", () => {
  assert.deepEqual(Object.keys(WORK_ROUTE_BATCH_C), THEME_IDS);

  for (const themeId of THEME_IDS) {
    const theme = WORK_MAP_THEMES[themeId];
    const routeTheme = WORK_ROUTE_BATCH_C[themeId];
    const themeWithBatchPins = {
      ...theme,
      places: theme.places.map((place) => ({
        ...place,
        pin: routeTheme.routes[place.type]?.pin,
      })),
    };

    assert.deepEqual(validateWorkRouteTheme(themeId, themeWithBatchPins, routeTheme), []);
    assert.deepEqual(
      Object.keys(routeTheme.routes),
      theme.places.map((place) => place.type),
      `${themeId} route keys must match theme place types in order`,
    );
  }
});

test("batch C routes have authored normalized samples, endpoints, distances, and visible segments", () => {
  const completeSampleLists = [];

  for (const themeId of THEME_IDS) {
    const theme = WORK_MAP_THEMES[themeId];
    const routeTheme = WORK_ROUTE_BATCH_C[themeId];
    assertValidPoint(routeTheme.home, `${themeId}.home`);

    for (const place of theme.places) {
      const route = routeTheme.routes[place.type];
      assert.ok(route.distanceMeters > 0, `${themeId}:${place.type} distance must be positive`);
      assertValidPoint(route.pin, `${themeId}:${place.type}.pin`);
      assert.ok(Array.isArray(route.samples), `${themeId}:${place.type} samples must be an array`);
      assert.ok(route.samples.length >= 12, `${themeId}:${place.type} needs at least 12 samples`);
      assert.deepEqual(route.samples[0], routeTheme.home, `${themeId}:${place.type} must start at home`);
      assert.deepEqual(route.samples.at(-1), route.pin, `${themeId}:${place.type} must end at pin`);
      route.samples.forEach((sample, index) => assertValidPoint(sample, `${themeId}:${place.type}.samples[${index}]`));
      assert.ok(route.visibleSegments.length >= 1, `${themeId}:${place.type} needs visible segments`);
      route.visibleSegments.forEach((segment) => {
        assert.match(segment, /^M\s/, `${themeId}:${place.type} segment must start with uppercase M`);
        assert.match(segment, /\s[LC]\s/, `${themeId}:${place.type} segment needs uppercase L or C draw command`);
      });
      completeSampleLists.push(serializeSamples(route.samples));
    }
  }

  assert.equal(new Set(completeSampleLists).size, completeSampleLists.length);
});

test("batch C map assets exist as exact 9:16 portrait PNGs", async () => {
  for (const themeId of THEME_IDS) {
    const { asset } = WORK_MAP_THEMES[themeId];
    const dimensions = await readPngDimensions(asset);
    assert.ok(dimensions.height > dimensions.width, `${asset} must be portrait`);
    assert.equal(dimensions.width * 16, dimensions.height * 9, `${asset} must be exact 9:16`);
  }
});
