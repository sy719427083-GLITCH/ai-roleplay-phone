import assert from "node:assert/strict";
import test from "node:test";
import { getAvatarCropDraw } from "./avatarCrop.js";

test("centers a landscape avatar before drag and zoom", () => {
  const draw = getAvatarCropDraw({
    imageWidth: 800,
    imageHeight: 400,
    outputSize: 200,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });

  assert.deepEqual(draw, {
    dx: -100,
    dy: 0,
    dWidth: 400,
    dHeight: 200,
  });
});

test("applies drag offset and zoom around the output center", () => {
  const draw = getAvatarCropDraw({
    imageWidth: 400,
    imageHeight: 400,
    outputSize: 200,
    zoom: 1.5,
    offsetX: 12,
    offsetY: -8,
  });

  assert.deepEqual(draw, {
    dx: -38,
    dy: -58,
    dWidth: 300,
    dHeight: 300,
  });
});
