import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { syncPages } from "./pages-sync-contract.mjs";

const writeFixture = async (root, relativePath, content = relativePath) => {
  const file = path.join(root, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
};

test("syncs only release directories, removes the legacy office directory, and matches dist", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "office-pages-sync-"));
  const retiredOfficeDirectory = ["work", "office", "assets"].join("-");
  try {
    await writeFixture(root, "package.json", JSON.stringify({ version: "0.2.98" }));
    await writeFixture(root, "dist/index.html", "release html");
    await writeFixture(root, "dist/assets/app.js", "release js");
    await writeFixture(root, "dist/work-office-v2/scenes/office.webp", "office-v2");
    await writeFixture(root, "dist/worldbook-assets/cover.webp", "worldbook");
    await writeFixture(root, "docs/assets/stale.js", "stale");
    await writeFixture(root, `docs/${retiredOfficeDirectory}/stale.webp`, "legacy");
    await writeFixture(root, "docs/work-office-v2/stale.webp", "stale office");

    const result = await syncPages({ repositoryRoot: root });

    assert.deepEqual(result.assetDirectories, ["assets", "work-office-v2", "worldbook-assets"]);
    assert.equal(await readFile(path.join(root, "docs/index.html"), "utf8"), "release html");
    assert.equal(await readFile(path.join(root, "docs/.deploy-version"), "utf8"), "0.2.98");
    await assert.rejects(readFile(path.join(root, "docs/assets/stale.js"), "utf8"), /ENOENT/u);
    await assert.rejects(readFile(path.join(root, "docs", retiredOfficeDirectory, "stale.webp"), "utf8"), /ENOENT/u);
    await assert.rejects(readFile(path.join(root, "docs/work-office-v2/stale.webp"), "utf8"), /ENOENT/u);
    assert.equal(await readFile(path.join(root, "docs/work-office-v2/scenes/office.webp"), "utf8"), "office-v2");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
