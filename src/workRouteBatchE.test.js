import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WORK_MAP_THEMES } from "./workThemes.js";
import { WORK_ROUTE_BATCH_E } from "./workRouteBatches/batch-e.js";

const BATCH_E_THEME_IDS = Object.freeze([
  "cyberpunk",
  "scifi",
  "alien_civilization",
  "online_game",
  "cthulhu",
]);

const SVG_TOKEN_PATTERN = /[MLC]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
const SVG_COMMANDS = new Set(["M", "L", "C"]);
const SVG_COMMAND_ARITY = Object.freeze({ M: 2, L: 2, C: 6 });

const isFiniteCoordinate = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
const isPoint = (value) => Boolean(value && isFiniteCoordinate(value.x) && isFiniteCoordinate(value.y));
const samePoint = (left, right) => left?.x === right?.x && left?.y === right?.y;

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
      if (!isFiniteCoordinate(Number(coordinateToken))) return false;
      tokenIndex += 1;
    }

    if (tokenIndex < tokens.length && !SVG_COMMANDS.has(tokens[tokenIndex])) return false;
  }

  return hasDrawCommand;
};

const readPngDimensions = (assetPath) => {
  const header = readFileSync(assetPath).subarray(0, 24);
  assert.equal(header.toString("ascii", 1, 4), "PNG", `${assetPath} must be a PNG`);
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
};

const serializeSamples = (samples) => JSON.stringify(samples.map(({ x, y }) => [x, y]));

const buildThemePatternSignature = (routeTheme) => JSON.stringify(
  Object.values(routeTheme.routes)
    .map(({ samples }) => samples.map(({ x, y }) => [
      Math.round((x - routeTheme.home.x) * 100) / 100,
      Math.round((y - routeTheme.home.y) * 100) / 100,
    ]))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
);

test("batch E contains exactly five route themes and twenty-five complete routes", () => {
  assert.deepEqual(Object.keys(WORK_ROUTE_BATCH_E), BATCH_E_THEME_IDS);

  const routeCount = BATCH_E_THEME_IDS.reduce((count, themeId) => {
    const routeTheme = WORK_ROUTE_BATCH_E[themeId];
    assert.ok(isPoint(routeTheme.home), `${themeId} needs a normalized home entrance`);

    const expectedPlaceTypes = WORK_MAP_THEMES[themeId].places.map((place) => place.type);
    assert.deepEqual(Object.keys(routeTheme.routes), expectedPlaceTypes, `${themeId} route keys must match place types`);
    return count + Object.keys(routeTheme.routes).length;
  }, 0);

  assert.equal(routeCount, 25);
});

test("batch E routes have valid endpoints, samples, segments, and distances", () => {
  for (const [themeId, routeTheme] of Object.entries(WORK_ROUTE_BATCH_E)) {
    for (const [placeType, route] of Object.entries(routeTheme.routes)) {
      assert.ok(isPoint(route.pin), `${themeId}:${placeType} needs a normalized pin`);
      assert.ok(Number.isFinite(route.distanceMeters) && route.distanceMeters > 0, `${themeId}:${placeType} distance`);
      assert.ok(Array.isArray(route.samples) && route.samples.length >= 16, `${themeId}:${placeType} sample count`);
      assert.ok(route.samples.every(isPoint), `${themeId}:${placeType} normalized samples`);
      assert.ok(samePoint(route.samples[0], routeTheme.home), `${themeId}:${placeType} starts at home`);
      assert.ok(samePoint(route.samples.at(-1), route.pin), `${themeId}:${placeType} ends at pin`);
      assert.ok(Array.isArray(route.visibleSegments) && route.visibleSegments.length >= 1, `${themeId}:${placeType} segments`);
      assert.ok(route.visibleSegments.every(isValidSvgRoutePath), `${themeId}:${placeType} valid SVG segments`);
    }
  }
});

test("batch E routes use unique authored sample lists and theme patterns", () => {
  const routeThemes = Object.values(WORK_ROUTE_BATCH_E);
  const routeSignatures = routeThemes.flatMap((routeTheme) => Object.values(routeTheme.routes).map(({ samples }) => (
    serializeSamples(samples)
  )));
  assert.equal(new Set(routeSignatures).size, routeSignatures.length);

  const themePatternSignatures = routeThemes.map(buildThemePatternSignature);
  assert.equal(new Set(themePatternSignatures).size, themePatternSignatures.length);
});

test("batch E map assets exist and are exact 9:16 PNGs", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  for (const themeId of BATCH_E_THEME_IDS) {
    const assetName = WORK_MAP_THEMES[themeId].asset;
    const assetPath = `${root}/public/work-map-assets/${assetName}`;
    assert.ok(existsSync(assetPath), `${themeId} asset exists`);

    const { width, height } = readPngDimensions(assetPath);
    assert.equal(width * 16, height * 9, `${themeId} asset must be exact 9:16`);
  }
});
