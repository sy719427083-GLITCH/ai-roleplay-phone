import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WORK_MAP_THEMES } from "./workThemes.js";
import { WORK_ROUTE_BATCH_B } from "./workRouteBatches/batch-b.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const BATCH_B_THEME_IDS = Object.freeze([
  "mystic_realm",
  "underworld",
  "medieval",
  "western_fantasy",
  "fantasy",
]);

const REVIEWED_HOME_DOORS = Object.freeze({
  medieval: { x: 24, y: 32 },
  western_fantasy: { x: 78, y: 42 },
  fantasy: { x: 71, y: 64 },
});

const SVG_COMMAND_ARITY = Object.freeze({ M: 2, L: 2, C: 6 });
const SVG_TOKEN_PATTERN = /[MLC]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
const SVG_COMMANDS = new Set(Object.keys(SVG_COMMAND_ARITY));

const serializeSamples = (samples) => JSON.stringify(samples.map(({ x, y }) => [x, y]));

const readPngDimensions = (assetPath) => {
  const buffer = readFileSync(assetPath);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", `${assetPath} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const tokenizeSvgRoutePath = (path) => {
  if (typeof path !== "string") return null;

  const tokens = [];
  let previousEnd = 0;
  for (const match of path.matchAll(SVG_TOKEN_PATTERN)) {
    const separator = path.slice(previousEnd, match.index);
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

  if (!/^\s*$/.test(path.slice(previousEnd))) return null;
  return tokens;
};

const isValidSvgRoutePath = (path) => {
  const tokens = tokenizeSvgRoutePath(path);
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
      const coordinate = Number(coordinateToken);
      if (!Number.isFinite(coordinate) || coordinate < 0 || coordinate > 100) return false;
      tokenIndex += 1;
    }

    if (tokenIndex < tokens.length && !SVG_COMMANDS.has(tokens[tokenIndex])) return false;
  }

  return hasDrawCommand;
};

test("batch B exports exactly the five mystic and western fantasy themes", () => {
  assert.deepEqual(Object.keys(WORK_ROUTE_BATCH_B), BATCH_B_THEME_IDS);

  const routeCount = BATCH_B_THEME_IDS.reduce((total, themeId) => (
    total + Object.keys(WORK_ROUTE_BATCH_B[themeId].routes).length
  ), 0);
  assert.equal(routeCount, 25);
});

test("batch B route keys match the five place types for each theme", () => {
  for (const themeId of BATCH_B_THEME_IDS) {
    const theme = WORK_MAP_THEMES[themeId];
    const routeTheme = WORK_ROUTE_BATCH_B[themeId];
    const expectedPlaceTypes = theme.places.map((place) => place.type);

    assert.deepEqual(Object.keys(routeTheme.routes), expectedPlaceTypes, themeId);
  }
});

test("reviewed batch B homes are anchored to their visible doors", () => {
  for (const [themeId, homeDoor] of Object.entries(REVIEWED_HOME_DOORS)) {
    assert.deepEqual(WORK_ROUTE_BATCH_B[themeId].home, homeDoor, themeId);
  }
});

test("batch B routes use finite endpoints, distances, samples, and SVG segments", () => {
  for (const themeId of BATCH_B_THEME_IDS) {
    const routeTheme = WORK_ROUTE_BATCH_B[themeId];
    for (const [placeType, route] of Object.entries(routeTheme.routes)) {
      assert.ok(Number.isFinite(route.distanceMeters) && route.distanceMeters > 0, `${themeId}:${placeType}`);
      assert.ok(Array.isArray(route.samples) && route.samples.length >= 12, `${themeId}:${placeType}`);
      assert.deepEqual(route.samples[0], routeTheme.home, `${themeId}:${placeType} starts at home`);
      assert.deepEqual(route.samples.at(-1), route.pin, `${themeId}:${placeType} ends at pin`);
      for (const point of [route.pin, ...route.samples]) {
        assert.ok(Number.isFinite(point.x) && point.x >= 0 && point.x <= 100, `${themeId}:${placeType} x`);
        assert.ok(Number.isFinite(point.y) && point.y >= 0 && point.y <= 100, `${themeId}:${placeType} y`);
      }
      assert.ok(route.visibleSegments.length > 0, `${themeId}:${placeType} visible segments`);
      assert.ok(route.visibleSegments.every(isValidSvgRoutePath), `${themeId}:${placeType} visible segments`);
    }
  }
});

test("batch B routes are independently authored and assets exist at exact 9:16", () => {
  const sampleSignatures = [];

  for (const themeId of BATCH_B_THEME_IDS) {
    const theme = WORK_MAP_THEMES[themeId];
    const assetPath = join(projectRoot, "public", "work-map-assets", theme.asset);
    assert.ok(statSync(assetPath).isFile(), `${themeId} asset exists`);

    const { width, height } = readPngDimensions(assetPath);
    assert.equal(width * 16, height * 9, `${themeId} asset must be exact 9:16`);

    for (const route of Object.values(WORK_ROUTE_BATCH_B[themeId].routes)) {
      sampleSignatures.push(serializeSamples(route.samples));
    }
  }

  assert.equal(new Set(sampleSignatures).size, sampleSignatures.length);
});
