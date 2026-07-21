import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_RELEASE_VIEWPORTS,
  analyzePixelSample,
  assertActorMotionEvidence,
  assertConversationActivityCoverage,
  assertDisjointRectangles,
} from "./office-release-contract.mjs";

test("release QA covers both phone sizes and desktop at device scale two", () => {
  assert.deepEqual(OFFICE_RELEASE_VIEWPORTS, [
    { width: 375, height: 812, deviceScaleFactor: 2 },
    { width: 390, height: 844, deviceScaleFactor: 2 },
    { width: 1280, height: 720, deviceScaleFactor: 2 },
  ]);
});

test("pixel analysis rejects blank samples and accepts varied opaque rendering", () => {
  const blank = new Uint8ClampedArray(64 * 4).fill(255);
  assert.deepEqual(analyzePixelSample(blank), { nonTransparent: 64, uniqueColors: 1, nonBlank: false });

  const varied = new Uint8ClampedArray(blank);
  varied.set([15, 30, 45, 255], 0);
  varied.set([90, 80, 70, 255], 4);
  assert.deepEqual(analyzePixelSample(varied), { nonTransparent: 64, uniqueColors: 3, nonBlank: true });
});

test("rectangle contract rejects overlay overlap and viewport overflow", () => {
  const valid = [
    { id: "boss", left: 5, top: 5, right: 105, bottom: 45 },
    { id: "employee1", left: 115, top: 5, right: 215, bottom: 45 },
  ];
  assert.doesNotThrow(() => assertDisjointRectangles(valid, { left: 0, top: 0, right: 220, bottom: 60 }));
  assert.throws(() => assertDisjointRectangles([
    ...valid,
    { id: "employee2", left: 100, top: 10, right: 150, bottom: 35 },
  ], { left: 0, top: 0, right: 220, bottom: 60 }), /overlap/u);
  assert.throws(() => assertDisjointRectangles([
    { id: "employee3", left: -1, top: 10, right: 50, bottom: 35 },
  ], { left: 0, top: 0, right: 220, bottom: 60 }), /outside/u);
});

test("conversation evidence requires the exact requested activity sessions", () => {
  const conversations = [
    { id: "dining", activityId: "diningChat" },
    { id: "sofa", activityId: "sofaChat" },
  ];
  assert.doesNotThrow(() => assertConversationActivityCoverage(conversations, ["diningChat", "sofaChat"]));
  assert.throws(() => assertConversationActivityCoverage(conversations, ["diningChat", "chatting"]), /activity/iu);
  assert.throws(() => assertConversationActivityCoverage([
    ...conversations,
    { id: "unknown", activityId: "unexpected" },
  ], ["diningChat", "sofaChat"]), /activity/iu);
});

test("motion evidence requires live canvas actor pixels at old and new positions", () => {
  const moving = {
    samples: Array.from({ length: 6 }, (_, index) => ({
      time: index * 80,
      x: 100 + index * 5,
      y: 220 + index,
      frame: index % 4,
      cropFingerprint: `frame-${index % 4}-${index}`,
      nonBackgroundPixels: 160 + index,
    })),
    transitions: Array.from({ length: 5 }, (_, index) => ({
      distance: Math.hypot(5, 1),
      elapsedMs: 80,
      oldRegionChangedPixels: 120 + index,
      newRegionChangedPixels: 110 + index,
      oldRegionClearedPixels: 44 + index,
      newRegionAppearedPixels: 48 + index,
    })),
  };
  assert.doesNotThrow(() => assertActorMotionEvidence(moving));

  const frozenCanvas = {
    ...moving,
    samples: moving.samples.map((sample) => ({ ...sample, cropFingerprint: "frozen" })),
    transitions: moving.transitions.map((transition) => ({
      ...transition,
      oldRegionChangedPixels: 0,
      newRegionChangedPixels: 0,
      oldRegionClearedPixels: 0,
      newRegionAppearedPixels: 0,
    })),
  };
  assert.throws(() => assertActorMotionEvidence(frozenCanvas), /canvas|pixel/iu);

  const missingActor = {
    ...moving,
    samples: moving.samples.map((sample) => ({ ...sample, nonBackgroundPixels: 0 })),
  };
  assert.throws(() => assertActorMotionEvidence(missingActor), /actor pixels/iu);

  const teleportingActor = {
    ...moving,
    transitions: moving.transitions.map((transition) => ({
      ...transition,
      distance: 120,
      elapsedMs: 40,
    })),
  };
  assert.throws(() => assertActorMotionEvidence(teleportingActor), /discontinuous/iu);
});
