import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const ASSET_ROOT = new URL("../../public/work-office-assets/", import.meta.url);
const BREAKROOM_FILES = [
  "orbit-breakroom-background.png",
  "orbit-drink-counter.png",
  "orbit-coffee-machine.png",
  "orbit-fridge.png",
  "orbit-microwave.png",
  "orbit-snack-cabinet.png",
  "orbit-dining-table.png",
];

test("retains the production smart print station artwork", () => {
  const bytes = readFileSync(new URL("orbit-print-station.png", ASSET_ROOT));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(bytes.readUInt8(25), 6);
  assert.ok(bytes.readUInt32BE(16) >= 512);
  assert.ok(bytes.readUInt32BE(20) >= 320);
  assert.ok(bytes.length >= 40_000);
});

test("removes every breakroom-only source and published image", () => {
  for (const fileName of BREAKROOM_FILES) {
    assert.equal(existsSync(new URL(fileName, ASSET_ROOT)), false, `${fileName} removed from public`);
    assert.equal(existsSync(new URL(`../../docs/work-office-assets/${fileName}`, import.meta.url)), false, `${fileName} removed from docs`);
  }
});
