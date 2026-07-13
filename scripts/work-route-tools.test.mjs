import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import {
  buildRouteDraft,
  buildVisibleSegments,
  clearRouteDraft,
  createThemeExport,
  isEditableTarget,
  serializeRouteRecord,
  validateCalibrationRoute,
} from "./work-route-calibrator.js";
import {
  buildScreenshotPath,
  createResourceLifecycle,
  isProcessAlive,
  resolveVerificationPlan,
  resolveVerificationTimeoutMs,
  stopProcessGroup,
  withTimeout,
} from "./verify-work-routes.mjs";

const MODERN_THEME_FIXTURE = Object.freeze({
  id: "modern",
  home: { x: 50, y: 10 },
  places: [
    { type: "bookstore", pin: { x: 18, y: 19 } },
    { type: "flower_shop", pin: { x: 80, y: 19 } },
    { type: "clinic", pin: { x: 16, y: 41 } },
    { type: "parcel_station", pin: { x: 84, y: 41 } },
    { type: "cafe", pin: { x: 50, y: 47 } },
  ],
});

const buildCompleteSamples = (home, pin) => Array.from({ length: 12 }, (_, index) => ({
  x: home.x + ((pin.x - home.x) * index) / 11,
  y: home.y + ((pin.y - home.y) * index) / 11,
}));

const buildAuthoredThemeDraft = () => ({
  home: MODERN_THEME_FIXTURE.home,
  routes: Object.fromEntries(MODERN_THEME_FIXTURE.places.map((place) => [
    place.type,
    {
      authored: true,
      pin: place.pin,
      distanceMeters: 420,
      samples: buildCompleteSamples(MODERN_THEME_FIXTURE.home, place.pin),
      breakIndices: [],
    },
  ])),
});

test("serializeRouteRecord exports deterministic samples and visible segments from break indices", () => {
  const routeRecord = serializeRouteRecord({
    home: MODERN_THEME_FIXTURE.home,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: [
      { x: 50, y: 10 },
      { x: 49, y: 11 },
      { x: 48, y: 12 },
      { x: 47, y: 13 },
      { x: 46, y: 14.25 },
      { x: 44, y: 17 },
      { x: 40, y: 18 },
      { x: 36, y: 18.5 },
      { x: 32, y: 19 },
      { x: 28, y: 19 },
      { x: 23, y: 19 },
      { x: 18, y: 19 },
    ],
    breakIndices: [5],
  });

  assert.deepEqual(routeRecord, {
    pin: { x: 18, y: 19 },
    distanceMeters: 420,
    samples: [
      { x: 50, y: 10 },
      { x: 49, y: 11 },
      { x: 48, y: 12 },
      { x: 47, y: 13 },
      { x: 46, y: 14.25 },
      { x: 44, y: 17 },
      { x: 40, y: 18 },
      { x: 36, y: 18.5 },
      { x: 32, y: 19 },
      { x: 28, y: 19 },
      { x: 23, y: 19 },
      { x: 18, y: 19 },
    ],
    visibleSegments: [
      "M 50 10 L 49 11 L 48 12 L 47 13 L 46 14.25 L 44 17",
      "M 44 17 L 40 18 L 36 18.5 L 32 19 L 28 19 L 23 19 L 18 19",
    ],
  });
});

test("two-point and cleared routes cannot be exported as calibrated", () => {
  const twoPointRoute = {
    home: MODERN_THEME_FIXTURE.home,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: [MODERN_THEME_FIXTURE.home, MODERN_THEME_FIXTURE.places[0].pin],
    breakIndices: [],
  };

  assert.throws(
    () => serializeRouteRecord(twoPointRoute),
    /samples must contain at least 12 points; currently 2; add 10 more/,
  );
  const { home: _home, ...routeFields } = twoPointRoute;
  const clearedRoute = { ...routeFields, authored: true };
  clearRouteDraft(clearedRoute);
  assert.deepEqual(clearedRoute, {
    authored: false,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: [],
    breakIndices: [],
  });
  assert.throws(
    () => serializeRouteRecord({ home: MODERN_THEME_FIXTURE.home, ...clearedRoute }),
    /route is unauthored; add road-center samples before export/,
  );
});

test("uncalibrated legacy route metadata is never imported as authored samples", () => {
  const placeMeta = {
    type: "bookstore",
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    route: buildCompleteSamples(MODERN_THEME_FIXTURE.home, MODERN_THEME_FIXTURE.places[0].pin),
  };

  assert.deepEqual(buildRouteDraft(MODERN_THEME_FIXTURE.home, placeMeta, null), {
    authored: false,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: [],
    breakIndices: [],
  });
});

test("theme export rejects every unauthored or invalid route with actionable route labels", () => {
  const themeDraft = buildAuthoredThemeDraft();
  themeDraft.routes.flower_shop.authored = false;
  themeDraft.routes.flower_shop.samples = [];
  themeDraft.routes.clinic.samples = themeDraft.routes.clinic.samples.slice(0, 2);

  assert.throws(
    () => createThemeExport("modern", themeDraft),
    (error) => {
      assert.match(error.message, /modern:flower_shop route is unauthored/);
      assert.match(error.message, /modern:clinic samples must contain at least 12 points; currently 2; add 10 more/);
      return true;
    },
  );
});

test("complete authored routes with 12 or more samples export individually and as a theme", () => {
  const themeDraft = buildAuthoredThemeDraft();
  const thirteenSamples = [...themeDraft.routes.bookstore.samples];
  thirteenSamples.splice(-1, 0, { x: 20, y: 19 });

  assert.equal(serializeRouteRecord({
    home: themeDraft.home,
    ...themeDraft.routes.bookstore,
    samples: thirteenSamples,
  }).samples.length, 13);
  assert.deepEqual(Object.keys(createThemeExport("modern", themeDraft).routes), [
    "bookstore",
    "flower_shop",
    "clinic",
    "parcel_station",
    "cafe",
  ]);
});

test("keyboard guard recognizes form controls and contenteditable targets", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
    assert.equal(isEditableTarget({ tagName }), true, tagName);
  }
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isEditableTarget({
    tagName: "SPAN",
    isContentEditable: false,
    closest: () => ({ tagName: "DIV" }),
  }), true);
  assert.equal(isEditableTarget({ tagName: "BUTTON", isContentEditable: false }), false);
});

test("validateCalibrationRoute rejects out-of-range coordinates and invalid break indices", () => {
  const outOfRangeSamples = buildCompleteSamples(
    MODERN_THEME_FIXTURE.home,
    MODERN_THEME_FIXTURE.places[0].pin,
  );
  outOfRangeSamples[1] = { x: 101, y: 14 };
  assert.deepEqual(validateCalibrationRoute({
    home: MODERN_THEME_FIXTURE.home,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: outOfRangeSamples,
    breakIndices: [],
  }), ["samples[1] must stay within normalized 0..100 bounds"]);

  const completeSamples = buildCompleteSamples(
    MODERN_THEME_FIXTURE.home,
    MODERN_THEME_FIXTURE.places[0].pin,
  );
  assert.deepEqual(validateCalibrationRoute({
    home: MODERN_THEME_FIXTURE.home,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: completeSamples,
    breakIndices: [0, completeSamples.length - 1],
  }), [
    "breakIndices must be unique ascending sample indices between 1 and samples.length - 2",
  ]);
});

test("buildVisibleSegments shares the break point between adjoining segments", () => {
  assert.deepEqual(
    buildVisibleSegments(
      [
        { x: 50, y: 10 },
        { x: 48, y: 16 },
        { x: 40, y: 22 },
        { x: 18, y: 19 },
      ],
      [2],
    ),
    [
      "M 50 10 L 48 16 L 40 22",
      "M 40 22 L 18 19",
    ],
  );
});

test("buildScreenshotPath is deterministic for every theme and place", () => {
  assert.equal(
    buildScreenshotPath("modern", "bookstore"),
    "artifacts/work-routes/modern/bookstore.png",
  );
  assert.equal(
    buildScreenshotPath("western_fantasy", "magic_academy"),
    "artifacts/work-routes/western_fantasy/magic_academy.png",
  );
});

test("resolveVerificationPlan supports focused verification now and reports incomplete full-registry coverage", () => {
  const focusedPlan = resolveVerificationPlan({
    availableThemes: { modern: MODERN_THEME_FIXTURE },
    routeData: {
      modern: {
        home: MODERN_THEME_FIXTURE.home,
        routes: Object.fromEntries(MODERN_THEME_FIXTURE.places.map((place) => [
          place.type,
          {
            pin: place.pin,
            distanceMeters: 420,
            samples: [MODERN_THEME_FIXTURE.home, place.pin, place.pin],
            visibleSegments: ["M 50 10 L 18 19"],
          },
        ])),
      },
    },
    themeId: "modern",
    placeType: "bookstore",
  });

  assert.deepEqual(focusedPlan, {
    targets: [{ themeId: "modern", placeType: "bookstore" }],
    missingThemes: [],
  });

  const fullPlan = resolveVerificationPlan({
    availableThemes: {
      modern: MODERN_THEME_FIXTURE,
      xuanhuan: { id: "xuanhuan", home: { x: 50, y: 9 }, places: MODERN_THEME_FIXTURE.places },
    },
    routeData: {
      modern: {
        home: MODERN_THEME_FIXTURE.home,
        routes: Object.fromEntries(MODERN_THEME_FIXTURE.places.map((place) => [
          place.type,
          {
            pin: place.pin,
            distanceMeters: 420,
            samples: [MODERN_THEME_FIXTURE.home, place.pin, place.pin],
            visibleSegments: ["M 50 10 L 18 19"],
          },
        ])),
      },
    },
  });

  assert.deepEqual(fullPlan, {
    targets: MODERN_THEME_FIXTURE.places.map((place) => ({ themeId: "modern", placeType: place.type })),
    missingThemes: ["xuanhuan"],
  });
});

test("full route verification scales its default timeout with screenshot count", () => {
  assert.equal(resolveVerificationTimeoutMs({ targetCount: 5 }), 45_000);
  assert.equal(resolveVerificationTimeoutMs({ targetCount: 125 }), 202_500);
  assert.equal(resolveVerificationTimeoutMs({
    targetCount: 125,
    requestedTimeoutMs: 2_000,
    timeoutWasProvided: true,
  }), 2_000);
});

test("withTimeout rejects bounded work and runs the timeout cleanup hook", async () => {
  let cleanupCalls = 0;

  await assert.rejects(
    withTimeout(
      new Promise(() => {}),
      25,
      "modern/bookstore smoke",
      async () => {
        cleanupCalls += 1;
      },
    ),
    /modern\/bookstore smoke timed out after 25ms/,
  );

  assert.equal(cleanupCalls, 1);
});

test("withTimeout rejects without awaiting a never-resolving cleanup hook", { timeout: 250 }, async () => {
  let cleanupCalls = 0;
  const startedAt = Date.now();

  await assert.rejects(
    withTimeout(
      new Promise(() => {}),
      20,
      "hung cleanup",
      () => {
        cleanupCalls += 1;
        return new Promise(() => {});
      },
    ),
    /hung cleanup timed out after 20ms/,
  );

  assert.equal(cleanupCalls, 1);
  assert.ok(Date.now() - startedAt < 150);
});

test("resources acquired after cleanup are boundedly closed after acquisition timeout", { timeout: 300 }, async () => {
  const lifecycle = createResourceLifecycle({ cleanupTimeoutMs: 25 });
  let releaseResource = null;
  let cleanupCalls = 0;
  const acquisition = new Promise((resolve) => {
    releaseResource = resolve;
  });
  const operation = lifecycle.acquire(
    "late-browser",
    acquisition,
    () => {
      cleanupCalls += 1;
      return new Promise(() => {});
    },
    { timeoutMs: 20 },
  );
  const startedAt = Date.now();

  await assert.rejects(
    operation,
    /late-browser acquisition timed out after 20ms/,
  );
  await lifecycle.cleanupAll();
  releaseResource({ id: "browser" });
  await delay(0);
  await lifecycle.cleanupAll();

  assert.equal(cleanupCalls, 1);
  assert.ok(Date.now() - startedAt < 150);
});

test("direct verifier execution never schedules or calls process.exit", async () => {
  const source = await readFile(new URL("./verify-work-routes.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(source, /scheduleForcedExit/);
  assert.doesNotMatch(source, /process\.exit\s*\(/);
});

test("stopProcessGroup terminates a detached child and its spawned descendant", async () => {
  const script = [
    "const { spawn } = require('node:child_process');",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
    "console.log(child.pid);",
    "setInterval(() => {}, 1000);",
  ].join(" ");

  const parent = spawn(process.execPath, ["-e", script], {
    detached: true,
    stdio: ["ignore", "pipe", "ignore"],
  });

  let descendantPid = 0;
  try {
    const [chunk] = await once(parent.stdout, "data");
    descendantPid = Number(String(chunk).trim());

    assert.equal(isProcessAlive(parent.pid), true);
    assert.equal(isProcessAlive(descendantPid), true);

    await stopProcessGroup(parent, { gracefulTimeoutMs: 50, forceTimeoutMs: 500 });
    await delay(75);

    assert.equal(isProcessAlive(parent.pid), false);
    assert.equal(isProcessAlive(descendantPid), false);
  } finally {
    await stopProcessGroup(parent, { gracefulTimeoutMs: 50, forceTimeoutMs: 500 }).catch(() => {});
  }
});
