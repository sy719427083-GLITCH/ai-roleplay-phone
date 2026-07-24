import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { OFFICE_BACKGROUND_URL, OFFICE_FURNITURE, OFFICE_OBJECT_ASSETS } from "./officeAssets.js";

const publicPath = (url) => `public${url.replace("/ai-roleplay-phone", "")}`;
const pngColorType = (path) => readFileSync(path)[25];

test("declares a separate alpha PNG for every clickable office object", () => {
  assert.equal(OFFICE_BACKGROUND_URL, "/ai-roleplay-phone/work-office-assets/orbit-office-background.png");
  assert.deepEqual(OFFICE_FURNITURE.map((item) => item.id), [
    "leftDoor", "rightTopDoor", "rightMidDoor", "bossDesk",
    "employee1Desk", "employee2Desk", "employee3Desk", "employee4Desk",
    "employee5Desk", "employee6Desk", "tea",
  ]);
  assert.equal(OFFICE_FURNITURE.filter((item) => item.kind.includes("desk")).length, 7);
  assert.equal(OFFICE_FURNITURE.filter((item) => item.kind.includes("door")).length, 3);
  for (const item of OFFICE_FURNITURE) {
    assert.match(item.asset, /\.png$/);
    assert.ok(item.destination);
    const path = publicPath(item.asset);
    assert.equal(existsSync(path), true, `${item.id} PNG exists`);
    assert.ok([4, 6].includes(pngColorType(path)), `${item.id} PNG has alpha`);
  }
  assert.equal(Object.keys(OFFICE_OBJECT_ASSETS).length, 5);
});
