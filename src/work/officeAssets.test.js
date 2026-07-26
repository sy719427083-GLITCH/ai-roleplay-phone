import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  OFFICE_BACKGROUND_URL,
  OFFICE_FURNITURE,
  OFFICE_OBJECT_ASSETS,
  WORK_COMPANY_SCENE_ASSETS,
} from "./officeAssets.js";

const publicPath = (url) => `public${url.replace("/ai-roleplay-phone", "")}`;
const pngColorType = (path) => readFileSync(path)[25];
const pngDimensions = (path) => {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

test("declares portrait fullscreen company animation scenes", () => {
  assert.deepEqual(WORK_COMPANY_SCENE_ASSETS, {
    launch: "/ai-roleplay-phone/work-office-assets/work-company-launch-background.png",
    enter: "/ai-roleplay-phone/work-office-assets/work-company-enter-background.png",
  });
  for (const url of Object.values(WORK_COMPANY_SCENE_ASSETS)) {
    const path = publicPath(url);
    assert.equal(existsSync(path), true, `${url} exists`);
    const { width, height } = pngDimensions(path);
    assert.ok(height > width, `${url} is portrait`);
    assert.ok(width >= 1024, `${url} is high resolution`);
  }
});

test("declares a separate alpha PNG for every clickable office object", () => {
  assert.equal(OFFICE_BACKGROUND_URL, "/ai-roleplay-phone/work-office-assets/orbit-office-background.png");
  assert.deepEqual(OFFICE_FURNITURE.map((item) => item.id), [
    "bossDesk", "employee1Desk", "employee2Desk", "employee3Desk",
    "employee4Desk", "employee5Desk", "employee6Desk", "printStation",
  ]);
  assert.equal(OFFICE_FURNITURE.filter((item) => item.kind.includes("desk")).length, 7);
  assert.equal(OFFICE_FURNITURE.filter((item) => item.kind.includes("door")).length, 0);
  for (const item of OFFICE_FURNITURE) {
    assert.match(item.asset, /\.png$/);
    assert.ok(item.destination);
    const path = publicPath(item.asset);
    assert.equal(existsSync(path), true, `${item.id} PNG exists`);
    assert.ok([4, 6].includes(pngColorType(path)), `${item.id} PNG has alpha`);
  }
  assert.deepEqual(Object.keys(OFFICE_OBJECT_ASSETS).sort(), ["bossDesk", "employeeDesk", "printStation"]);
});
