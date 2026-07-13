import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WORK_ROUTE_DATA,
  getWorkRouteTheme,
  interpolateWorkRoute,
  validateWorkRouteTheme,
} from "./workRouteData.js";
import { WORK_MAP_THEMES } from "./workThemes.js";

const serializeSamples = (samples) => JSON.stringify(samples.map(({ x, y }) => [x, y]));

const buildThemePatternSignature = (routeTheme) => JSON.stringify(
  Object.values(routeTheme.routes)
    .map(({ samples }) => samples.map(({ x, y }) => [
      Math.round((x - routeTheme.home.x) * 100) / 100,
      Math.round((y - routeTheme.home.y) * 100) / 100,
    ]))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
);

const validateBookstoreRoute = (mutateRoute) => {
  const routeTheme = structuredClone(getWorkRouteTheme("modern"));
  mutateRoute(routeTheme.routes.bookstore);
  return validateWorkRouteTheme("modern", WORK_MAP_THEMES.modern, routeTheme);
};

test("registers exactly 25 calibrated themes and 125 validated routes", () => {
  assert.equal(Object.keys(WORK_ROUTE_DATA).length, 25);
  assert.equal(
    Object.values(WORK_ROUTE_DATA).reduce((count, routeTheme) => (
      count + Object.keys(routeTheme.routes).length
    ), 0),
    125,
  );
  assert.deepEqual(Object.keys(WORK_ROUTE_DATA).sort(), Object.keys(WORK_MAP_THEMES).sort());

  for (const [themeId, theme] of Object.entries(WORK_MAP_THEMES)) {
    assert.deepEqual(
      validateWorkRouteTheme(themeId, theme, getWorkRouteTheme(themeId)),
      [],
      `${themeId} route data must validate`,
    );
  }
});

test("route validation independently requires exactly five theme places and route keys", () => {
  const routeTheme = getWorkRouteTheme("modern");
  const fourPlaceTheme = {
    ...WORK_MAP_THEMES.modern,
    places: WORK_MAP_THEMES.modern.places.slice(0, 4),
  };
  const fourRouteTheme = {
    ...routeTheme,
    routes: Object.fromEntries(Object.entries(routeTheme.routes).slice(0, 4)),
  };

  assert.ok(
    validateWorkRouteTheme("modern", fourPlaceTheme, routeTheme)
      .includes("modern: expected exactly 5 theme places, received 4"),
  );
  assert.ok(
    validateWorkRouteTheme("modern", WORK_MAP_THEMES.modern, fourRouteTheme)
      .includes("modern: expected exactly 5 route keys, received 4"),
  );
});

test("legacy generic route fallback identifiers are absent from route integration sources", () => {
  const sources = ["workRouteData.js", "workThemes.js"]
    .map((fileName) => readFileSync(new URL(fileName, import.meta.url), "utf8"))
    .join("\n");

  for (const identifier of [
    "MAP_PLACE_LAYOUTS",
    "GENERATED_MAP_COORDINATES",
    "buildGeneratedRoadRoute",
  ]) {
    assert.doesNotMatch(sources, new RegExp(`\\b${identifier}\\b`));
  }
});

test("route validation accepts explicit M, L, and C command syntax", () => {
  const issues = validateBookstoreRoute((bookstore) => {
    bookstore.visibleSegments = ["M 50 10 C 50 14, 46 17, 38 17 L 18 19"];
  });

  assert.deepEqual(issues, []);
});

test("route validation rejects malformed SVG commands and numeric arity", () => {
  for (const segment of ["M ", "M 10", "M 10 20 L", "M 10 20 C 1 2 3 4 5", "M 10 20 Q 30 40"]) {
    const issues = validateBookstoreRoute((bookstore) => {
      bookstore.visibleSegments = [segment];
    });
    assert.ok(issues.includes("modern:bookstore has invalid SVG segments"), segment);
  }
});

test("route validation rejects invalid and out-of-range normalized coordinates", () => {
  for (const segment of ["M 50 10 L 101 20", "M 50 10 C 10 10 20 20 1e309 30"]) {
    const issues = validateBookstoreRoute((bookstore) => {
      bookstore.visibleSegments = [segment];
    });
    assert.ok(issues.includes("modern:bookstore has invalid SVG segments"), segment);
  }

  const sampleIssues = validateBookstoreRoute((bookstore) => {
    bookstore.samples[1] = { x: Number.POSITIVE_INFINITY, y: 12 };
    bookstore.samples[2] = { x: 50, y: -1 };
  });
  assert.ok(sampleIssues.includes("modern:bookstore has invalid sample coordinates"));
});

test("route validation rejects nonpositive distance", () => {
  const issues = validateBookstoreRoute((bookstore) => {
    bookstore.distanceMeters = 0;
  });

  assert.ok(issues.includes("modern:bookstore invalid distance"));
});

test("route validation rejects a route start that does not match home", () => {
  const issues = validateBookstoreRoute((bookstore) => {
    bookstore.samples[0] = { x: 49, y: 10 };
  });

  assert.ok(issues.includes("modern:bookstore must start at home"));
});

test("route validation rejects a route end that does not match its pin", () => {
  const issues = validateBookstoreRoute((bookstore) => {
    bookstore.samples[bookstore.samples.length - 1] = { x: 19, y: 19 };
  });

  assert.ok(issues.includes("modern:bookstore must end at pin"));
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
