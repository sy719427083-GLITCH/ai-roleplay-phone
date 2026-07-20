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
        throw new Error(`${rectangle.id || index} overlaps ${other.id || "overlay"}`);
      }
    }
  });
  return true;
}
