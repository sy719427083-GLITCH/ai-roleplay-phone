export const OFFICE_RELEASE_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 375, height: 812, deviceScaleFactor: 2 }),
  Object.freeze({ width: 390, height: 844, deviceScaleFactor: 2 }),
  Object.freeze({ width: 1280, height: 720, deviceScaleFactor: 2 }),
]);

const colorKey = (pixels, index) => (
  `${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}:${pixels[index + 3]}`
);

export function analyzePixelSample(pixels) {
  const colors = new Set();
  let nonTransparent = 0;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] > 0) nonTransparent += 1;
    colors.add(colorKey(pixels, index));
  }
  return {
    nonTransparent,
    uniqueColors: colors.size,
    nonBlank: nonTransparent > 0 && colors.size > 1,
  };
}

export function assertActorMotionEvidence({ samples = [], transitions = [] } = {}, {
  maxSpeed = 220,
  minChangedPixels = 20,
  minDirectionalPixels = 8,
} = {}) {
  if (samples.length < 5 || transitions.length < samples.length - 1) {
    throw new Error("insufficient live actor motion samples");
  }
  if (samples.some((sample) => !Number.isFinite(sample.time) || !Number.isFinite(sample.x)
    || !Number.isFinite(sample.y) || !Number.isInteger(sample.frame))) {
    throw new Error("invalid actor motion coordinates or locomotion frame");
  }
  if (samples.some((sample) => !Number.isFinite(sample.nonBackgroundPixels)
    || sample.nonBackgroundPixels <= 0)) {
    throw new Error("actor pixels are missing from a sampled canvas crop");
  }

  const positions = new Set(samples.map(({ x, y }) => `${x.toFixed(2)}:${y.toFixed(2)}`));
  if (positions.size < 4) throw new Error("actor world position is frozen");
  if (new Set(samples.map(({ frame }) => frame)).size < 3) throw new Error("locomotion frame is frozen");

  const changedFrameFingerprints = samples.slice(1).filter((sample, index) => (
    sample.frame !== samples[index].frame
    && sample.cropFingerprint !== samples[index].cropFingerprint
  ));
  if (changedFrameFingerprints.length < 2) {
    throw new Error("canvas pixel fingerprints did not change with locomotion frames");
  }

  for (const transition of transitions.slice(0, samples.length - 1)) {
    const elapsedSeconds = transition.elapsedMs / 1_000;
    const speed = transition.distance / elapsedSeconds;
    if (!Number.isFinite(transition.distance) || transition.distance <= 0
      || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0
      || !Number.isFinite(speed) || speed > maxSpeed) {
      throw new Error(`actor movement is discontinuous (${transition.distance})`);
    }
    if (transition.oldRegionChangedPixels < minChangedPixels
      || transition.newRegionChangedPixels < minChangedPixels) {
      throw new Error("canvas actor pixels did not change at both old and new positions");
    }
    if (transition.oldRegionClearedPixels < minDirectionalPixels
      || transition.newRegionAppearedPixels < minDirectionalPixels) {
      throw new Error("canvas actor pixels did not clear and appear along the route");
    }
  }
  return true;
}

const rectanglesOverlap = (left, right) => (
  Math.min(left.right, right.right) > Math.max(left.left, right.left)
  && Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top)
);

export function assertDisjointRectangles(rectangles, bounds) {
  rectangles.forEach((rectangle, index) => {
    if (
      rectangle.left < bounds.left
      || rectangle.top < bounds.top
      || rectangle.right > bounds.right
      || rectangle.bottom > bounds.bottom
    ) {
      throw new Error(`${rectangle.id || index} is outside the scene bounds`);
    }
    for (const other of rectangles.slice(index + 1)) {
      if (rectanglesOverlap(rectangle, other)) {
        throw new Error(`${rectangle.id || index} overlaps ${other.id || "overlay"}; left=${JSON.stringify(rectangle)} right=${JSON.stringify(other)}`);
      }
    }
  });
  return true;
}

export function assertConversationActivityCoverage(conversations = [], expectedActivityIds = []) {
  const actual = conversations.map(({ activityId }) => String(activityId || "")).sort();
  const expected = [...new Set(expectedActivityIds.map((activityId) => String(activityId || "")))].sort();
  if (actual.some((activityId) => !activityId) || actual.length !== expected.length
    || actual.some((activityId, index) => activityId !== expected[index])) {
    throw new Error(`conversation activity mismatch: expected=${expected.join(",")} actual=${actual.join(",")}`);
  }
  return true;
}
