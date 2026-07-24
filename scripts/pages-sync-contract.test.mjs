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

test("syncs only current release directories and matches dist", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pages-sync-"));
  try {
    await writeFixture(root, "package.json", JSON.stringify({ version: "9.9.9" }));
    await writeFixture(root, "dist/index.html", "release html");
    await writeFixture(root, "dist/assets/app.js", "release js");
    await writeFixture(root, "dist/worldbook-assets/cover.webp", "worldbook");
    await writeFixture(root, "docs/assets/stale.js", "stale");
    await writeFixture(root, "docs/worldbook-assets/stale.webp", "stale worldbook");
    await writeFixture(root, "docs/notes/keep.txt", "keep");

    const result = await syncPages({ repositoryRoot: root });

    assert.deepEqual(result.assetDirectories, ["assets", "worldbook-assets"]);
    assert.equal(await readFile(path.join(root, "docs/index.html"), "utf8"), "release html");
    assert.equal(await readFile(path.join(root, "docs/.deploy-version"), "utf8"), "9.9.9");
    await assert.rejects(readFile(path.join(root, "docs/assets/stale.js"), "utf8"), /ENOENT/u);
    await assert.rejects(readFile(path.join(root, "docs/worldbook-assets/stale.webp"), "utf8"), /ENOENT/u);
    assert.equal(await readFile(path.join(root, "docs/worldbook-assets/cover.webp"), "utf8"), "worldbook");
    assert.equal(await readFile(path.join(root, "docs/notes/keep.txt"), "utf8"), "keep");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
