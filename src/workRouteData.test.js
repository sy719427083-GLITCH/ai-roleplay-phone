import test from "node:test";
import assert from "node:assert/strict";
import {
  WORK_ROUTE_DATA,
  getWorkRouteTheme,
  interpolateWorkRoute,
  validateWorkRouteTheme,
} from "./workRouteData.js";

const MODERN_THEME_FIXTURE = Object.freeze({
  id: "modern",
  places: [
    { type: "bookstore", pin: { x: 18, y: 19 } },
    { type: "flower_shop", pin: { x: 80, y: 19 } },
    { type: "clinic", pin: { x: 16, y: 41 } },
    { type: "parcel_station", pin: { x: 84, y: 41 } },
    { type: "cafe", pin: { x: 50, y: 47 } },
  ],
});

const serializeSamples = (samples) => JSON.stringify(samples.map(({ x, y }) => [x, y]));

const buildThemePatternSignature = (routeTheme) => JSON.stringify(
  Object.values(routeTheme.routes)
    .map(({ samples }) => samples.map(({ x, y }) => [
      Math.round((x - routeTheme.home.x) * 100) / 100,
      Math.round((y - routeTheme.home.y) * 100) / 100,
    ]))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
);

test("only modern is calibrated and its route theme matches the exact contract", () => {
  assert.deepEqual(Object.keys(WORK_ROUTE_DATA), ["modern"]);
  assert.deepEqual(validateWorkRouteTheme("modern", MODERN_THEME_FIXTURE, getWorkRouteTheme("modern")), []);
  assert.equal(getWorkRouteTheme("xuanhuan"), null);
});

test("no calibrated route reuses another route sample list or translated five-route pattern", () => {
  const routeThemes = Object.values(WORK_ROUTE_DATA);
  const routeSignatures = routeThemes.flatMap((routeTheme) => Object.values(routeTheme.routes).map(({ samples }) => (
    serializeSamples(samples)
  )));
  assert.equal(new Set(routeSignatures).size, routeSignatures.length);

  const themePatternSignatures = routeThemes.map(buildThemePatternSignature);
  assert.equal(new Set(themePatternSignatures).size, themePatternSignatures.length);
});

test("interpolateWorkRoute keeps constant speed through a right-angle turn", () => {
  const samples = [{ x: 10, y: 40 }, { x: 10, y: 20 }, { x: 70, y: 20 }];
  assert.deepEqual(interpolateWorkRoute(samples, 0.25), { x: 10, y: 20 });
  assert.deepEqual(interpolateWorkRoute(samples, 0.5), { x: 30, y: 20 });
});
