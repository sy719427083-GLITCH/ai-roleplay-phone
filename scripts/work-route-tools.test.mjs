import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import {
  buildVisibleSegments,
  serializeRouteRecord,
  validateCalibrationRoute,
} from "./work-route-calibrator.js";
import {
  buildScreenshotPath,
  isProcessAlive,
  resolveVerificationPlan,
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

test("serializeRouteRecord exports deterministic samples and visible segments from break indices", () => {
  const routeRecord = serializeRouteRecord({
    home: MODERN_THEME_FIXTURE.home,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: [
      { x: 50, y: 10 },
      { x: 50, y: 14.25 },
      { x: 44, y: 17 },
      { x: 28, y: 19 },
      { x: 18, y: 19 },
    ],
    breakIndices: [2],
  });

  assert.deepEqual(routeRecord, {
    pin: { x: 18, y: 19 },
    distanceMeters: 420,
    samples: [
      { x: 50, y: 10 },
      { x: 50, y: 14.25 },
      { x: 44, y: 17 },
      { x: 28, y: 19 },
      { x: 18, y: 19 },
    ],
    visibleSegments: [
      "M 50 10 L 50 14.25 L 44 17",
      "M 44 17 L 28 19 L 18 19",
    ],
  });
});

test("validateCalibrationRoute rejects out-of-range coordinates and invalid break indices", () => {
  assert.deepEqual(validateCalibrationRoute({
    home: MODERN_THEME_FIXTURE.home,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: [
      { x: 50, y: 10 },
      { x: 101, y: 14 },
      { x: 18, y: 19 },
    ],
    breakIndices: [],
  }), ["samples[1] must stay within normalized 0..100 bounds"]);

  assert.deepEqual(validateCalibrationRoute({
    home: MODERN_THEME_FIXTURE.home,
    pin: MODERN_THEME_FIXTURE.places[0].pin,
    distanceMeters: 420,
    samples: [
      { x: 50, y: 10 },
      { x: 44, y: 17 },
      { x: 18, y: 19 },
    ],
    breakIndices: [0, 2],
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
