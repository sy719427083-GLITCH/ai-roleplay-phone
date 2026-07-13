import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORK_MAP_THEMES } from "./workThemes.js";
import { WORK_ROUTE_BATCH_D } from "./workRouteBatches/batch-d.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BATCH_D_THEME_IDS = ["hong_kong", "modern", "campus", "ice_age", "wasteland"];
const SVG_COMMAND_ARITY = Object.freeze({ M: 2, L: 2, C: 6 });
const SVG_TOKEN_PATTERN = /[MLC]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
const SVG_COMMANDS = new Set(Object.keys(SVG_COMMAND_ARITY));

const samePoint = (left, right) => left?.x === right?.x && left?.y === right?.y;

const isFiniteCoordinate = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

const isPoint = (value) => Boolean(
  value
  && isFiniteCoordinate(value.x)
  && isFiniteCoordinate(value.y),
);

const tokenizeSvgRoutePath = (pathValue) => {
  if (typeof pathValue !== "string") return null;

  const tokens = [];
  let previousEnd = 0;
  for (const match of pathValue.matchAll(SVG_TOKEN_PATTERN)) {
    const separator = pathValue.slice(previousEnd, match.index);
    const previousToken = tokens.at(-1);
    const currentToken = match[0];
    const separatesNumbers = previousToken
      && !SVG_COMMANDS.has(previousToken)
      && !SVG_COMMANDS.has(currentToken);
    const validSeparator = /^\s*$/.test(separator)
      || (separatesNumbers && /^\s*,\s*$/.test(separator));
    if (!validSeparator) return null;

    tokens.push(currentToken);
    previousEnd = match.index + currentToken.length;
  }

  if (!/^\s*$/.test(pathValue.slice(previousEnd))) return null;
  return tokens;
};

const isValidSvgRoutePath = (pathValue) => {
  const tokens = tokenizeSvgRoutePath(pathValue);
  if (!tokens?.length || tokens[0] !== "M") return false;

  let tokenIndex = 0;
  let hasDrawCommand = false;
  while (tokenIndex < tokens.length) {
    const command = tokens[tokenIndex];
    const arity = SVG_COMMAND_ARITY[command];
    if (!arity || (tokenIndex > 0 && command === "M")) return false;
    hasDrawCommand ||= command === "L" || command === "C";
    tokenIndex += 1;

    for (let coordinateIndex = 0; coordinateIndex < arity; coordinateIndex += 1) {
      const coordinateToken = tokens[tokenIndex];
      if (coordinateToken === undefined || SVG_COMMANDS.has(coordinateToken)) return false;
      if (!isFiniteCoordinate(Number(coordinateToken))) return false;
      tokenIndex += 1;
    }

    if (tokenIndex < tokens.length && !SVG_COMMANDS.has(tokens[tokenIndex])) return false;
  }

  return hasDrawCommand;
};

const readPngSize = (assetPath) => {
  const png = fs.readFileSync(assetPath);
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${assetPath} is a PNG`);
  assert.equal(png.toString("ascii", 12, 16), "IHDR", `${assetPath} has an IHDR chunk`);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
};

const serializeSamples = (samples) => JSON.stringify(samples.map(({ x, y }) => [x, y]));

test("batch D exports exactly five calibrated route themes and twenty-five routes", () => {
  assert.deepEqual(Object.keys(WORK_ROUTE_BATCH_D), BATCH_D_THEME_IDS);

  const routeCount = BATCH_D_THEME_IDS.reduce((sum, themeId) => (
    sum + Object.keys(WORK_ROUTE_BATCH_D[themeId].routes).length
  ), 0);
  assert.equal(routeCount, 25);
});

test("batch D route keys match the five place types declared by each work theme", () => {
  for (const themeId of BATCH_D_THEME_IDS) {
    const expectedTypes = WORK_MAP_THEMES[themeId].places.map((place) => place.type).sort();
    const actualTypes = Object.keys(WORK_ROUTE_BATCH_D[themeId].routes).sort();
    assert.deepEqual(actualTypes, expectedTypes, themeId);
  }
});

test("batch D routes have normalized endpoints, dense samples, distances, and SVG segments", () => {
  for (const themeId of BATCH_D_THEME_IDS) {
    const routeTheme = WORK_ROUTE_BATCH_D[themeId];
    assert.ok(isPoint(routeTheme.home), `${themeId}: valid home`);

    for (const [placeType, route] of Object.entries(routeTheme.routes)) {
      assert.ok(isPoint(route.pin), `${themeId}:${placeType} valid pin`);
      assert.ok(Number.isFinite(route.distanceMeters) && route.distanceMeters > 0, `${themeId}:${placeType} distance`);
      assert.ok(Array.isArray(route.samples), `${themeId}:${placeType} samples array`);
      assert.ok(route.samples.length >= 12, `${themeId}:${placeType} has at least 12 samples`);
      assert.ok(route.samples.every(isPoint), `${themeId}:${placeType} normalized finite samples`);
      assert.ok(samePoint(route.samples[0], routeTheme.home), `${themeId}:${placeType} starts at home`);
      assert.ok(samePoint(route.samples.at(-1), route.pin), `${themeId}:${placeType} ends at pin`);
      assert.ok(Array.isArray(route.visibleSegments) && route.visibleSegments.length >= 1, `${themeId}:${placeType} segments`);
      assert.ok(route.visibleSegments.every(isValidSvgRoutePath), `${themeId}:${placeType} valid M/L/C segments`);
    }
  }
});

test("batch D routes use unique sample arrays", () => {
  const sampleLists = BATCH_D_THEME_IDS.flatMap((themeId) => (
    Object.values(WORK_ROUTE_BATCH_D[themeId].routes).map(({ samples }) => serializeSamples(samples))
  ));

  assert.equal(new Set(sampleLists).size, sampleLists.length);
});

test("batch D map assets exist and are exact 9:16 portrait PNGs", () => {
  for (const themeId of BATCH_D_THEME_IDS) {
    const assetPath = path.join(PROJECT_ROOT, "public", "work-map-assets", WORK_MAP_THEMES[themeId].asset);
    assert.ok(fs.existsSync(assetPath), `${themeId}: asset exists`);

    const { width, height } = readPngSize(assetPath);
    assert.ok(width > 0 && height > width, `${themeId}: portrait dimensions`);
    assert.equal(width * 16, height * 9, `${themeId}: exact 9:16`);
  }
});
