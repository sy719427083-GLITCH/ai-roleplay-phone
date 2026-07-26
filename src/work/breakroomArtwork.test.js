import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ASSET_ROOT = new URL("../../public/work-office-assets/", import.meta.url);

function readPngHeader(fileName) {
  const bytes = readFileSync(new URL(fileName, ASSET_ROOT));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${fileName} is PNG`);
  return {
    bytes,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

test("breakroom background matches the office portrait canvas", () => {
  const image = readPngHeader("orbit-breakroom-background.png");
  assert.equal(image.width, 852);
  assert.equal(image.height, 1846);
  assert.ok([2, 6].includes(image.colorType));
});

test("every clickable replacement is a substantial alpha PNG", () => {
  for (const fileName of [
    "orbit-drink-counter.png",
    "orbit-coffee-machine.png",
    "orbit-fridge.png",
    "orbit-microwave.png",
    "orbit-snack-cabinet.png",
    "orbit-dining-table.png",
    "orbit-print-station.png",
  ]) {
    const image = readPngHeader(fileName);
    assert.equal(image.colorType, 6, `${fileName} has RGBA pixels`);
    assert.ok(image.width >= 512, `${fileName} has production width`);
    assert.ok(image.height >= 320, `${fileName} has production height`);
    assert.ok(image.bytes.length >= 40_000, `${fileName} is not an empty placeholder`);
  }
});
