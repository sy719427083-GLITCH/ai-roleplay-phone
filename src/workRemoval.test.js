import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const removedPaths = [
  "src/work",
  "public/work-office-assets",
  "docs/work-office-assets",
  "artifacts/work-office-qa",
  "scripts/verify-work-office.mjs",
  "scripts/verify-work-project-reward.mjs",
  "scripts/verify-work-projects-preview.mjs",
];

test("removes the previous Work implementation and assets", () => {
  for (const path of removedPaths) assert.equal(existsSync(path), false, path);
});

test("keeps no deploy or package references to Work office assets", () => {
  const packageJson = readFileSync("package.json", "utf8");
  const pages = readFileSync("scripts/pages-sync-contract.mjs", "utf8");
  assert.doesNotMatch(packageJson, /verify:work/);
  assert.doesNotMatch(pages, /work-office-assets/);
});
