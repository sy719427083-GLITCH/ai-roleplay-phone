import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { OFFICE_BACKGROUND_URL, OFFICE_FURNITURE } from "./officeAssets.js";

test("declares every clickable furniture destination", () => {
  assert.equal(OFFICE_BACKGROUND_URL, "/ai-roleplay-phone/work-office-assets/office-background.png");
  assert.deepEqual(OFFICE_FURNITURE.map((item) => item.id), ["leftDoor", "rightTopDoor", "rightMidDoor", "bossDesk", "employee1Desk", "employee2Desk", "employee3Desk", "employee4Desk", "tea"]);
  assert.equal(existsSync("public/work-office-assets/office-background.png"), true);
});
