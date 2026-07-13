import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { WORK_MAP_THEMES } from "./workThemes.js";
import { WORK_ROUTE_BATCH_A } from "./workRouteBatches/batch-a.js";

const BATCH_A_THEME_IDS = Object.freeze([
  "prehistoric",
  "ancient",
  "western_regions",
  "xianxia",
  "xuanhuan",
]);

const SVG_COMMAND_ARITY = Object.freeze({ M: 2, L: 2, C: 6 });
const SVG_COMMANDS = new Set(Object.keys(SVG_COMMAND_ARITY));
const SVG_TOKEN_PATTERN = /[MLC]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;

const serializeSamples = (samples) => JSON.stringify(samples.map(({ x, y }) => [x, y]));

const buildThemePatternSignature = (routeTheme) => JSON.stringify(
  Object.values(routeTheme.routes)
    .map(({ samples }) => samples.map(({ x, y }) => [
      Math.round((x - routeTheme.home.x) * 100) / 100,
      Math.round((y - routeTheme.home.y) * 100) / 100,
    ]))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
);

const isFiniteCoordinate = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

const isPoint = (value) => Boolean(
  value
  && isFiniteCoordinate(value.x)
  && isFiniteCoordinate(value.y),
);

const samePoint = (left, right) => left?.x === right?.x && left?.y === right?.y;

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

const readPngDimensions = (assetPath) => {
  const buffer = readFileSync(assetPath);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

test("batch A exports exactly the five ancient/eastern route themes", () => {
  assert.deepEqual(Object.keys(WORK_ROUTE_BATCH_A), BATCH_A_THEME_IDS);

  const routes = BATCH_A_THEME_IDS.flatMap((themeId) => {
    const theme = WORK_MAP_THEMES[themeId];
    const routeTheme = WORK_ROUTE_BATCH_A[themeId];
    assert.ok(routeTheme, `${themeId} missing route theme`);
    assert.ok(isPoint(routeTheme.home), `${themeId} invalid home`);

    const expectedPlaceTypes = theme.places.map((place) => place.type);
    assert.deepEqual(Object.keys(routeTheme.routes), expectedPlaceTypes, `${themeId} route keys`);

    return expectedPlaceTypes.map((placeType) => ({ themeId, placeType, routeTheme }));
  });

  assert.equal(routes.length, 25);
});

test("batch A route records contain real calibrated endpoints, distances, samples, and visible segments", () => {
  for (const [themeId, routeTheme] of Object.entries(WORK_ROUTE_BATCH_A)) {
    for (const [placeType, routeRecord] of Object.entries(routeTheme.routes)) {
      assert.ok(isPoint(routeRecord.pin), `${themeId}:${placeType} invalid pin`);
      assert.ok(Number.isFinite(routeRecord.distanceMeters), `${themeId}:${placeType} distance must be finite`);
      assert.ok(routeRecord.distanceMeters > 0, `${themeId}:${placeType} distance must be positive`);

      assert.ok(Array.isArray(routeRecord.samples), `${themeId}:${placeType} samples must be an array`);
      assert.ok(routeRecord.samples.length >= 12, `${themeId}:${placeType} needs at least 12 samples`);
      assert.ok(routeRecord.samples.every(isPoint), `${themeId}:${placeType} samples must be normalized finite points`);
      assert.ok(samePoint(routeRecord.samples[0], routeTheme.home), `${themeId}:${placeType} must start at home`);
      assert.ok(samePoint(routeRecord.samples.at(-1), routeRecord.pin), `${themeId}:${placeType} must end at pin`);

      assert.ok(Array.isArray(routeRecord.visibleSegments), `${themeId}:${placeType} visibleSegments must be an array`);
      assert.ok(routeRecord.visibleSegments.length >= 1, `${themeId}:${placeType} needs visibleSegments`);
      assert.ok(
        routeRecord.visibleSegments.every(isValidSvgRoutePath),
        `${themeId}:${placeType} visibleSegments must use valid uppercase M/L/C syntax`,
      );
    }
  }
});

test("batch A routes are independently authored and not reused templates", () => {
  const routeSignatures = Object.values(WORK_ROUTE_BATCH_A).flatMap((routeTheme) => (
    Object.values(routeTheme.routes).map(({ samples }) => serializeSamples(samples))
  ));
  assert.equal(new Set(routeSignatures).size, routeSignatures.length);

  const themePatternSignatures = Object.values(WORK_ROUTE_BATCH_A).map(buildThemePatternSignature);
  assert.equal(new Set(themePatternSignatures).size, themePatternSignatures.length);
});

test("batch A map assets exist as exact 9:16 portrait PNGs", () => {
  for (const themeId of BATCH_A_THEME_IDS) {
    const assetName = WORK_MAP_THEMES[themeId].asset;
    const assetPath = path.resolve(process.cwd(), "public/work-map-assets", assetName);
    assert.equal(existsSync(assetPath), true, `${themeId} asset missing`);

    const { width, height } = readPngDimensions(assetPath);
    assert.ok(width > 0 && height > 0, `${themeId} asset dimensions must be positive`);
    assert.equal(width * 16, height * 9, `${themeId} asset must be exact 9:16`);
  }
});
