import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

const rendererPath = new URL("./createOfficeRenderer.js", import.meta.url);
const canvasPath = new URL("./OfficeCanvas.jsx", import.meta.url);
const sceneViewPath = new URL("./OfficeSceneView.js", import.meta.url);
const manifestPath = new URL("./officeAssetManifest.js", import.meta.url);

const readSource = (path) => readFileSync(path, "utf8");

test("initializes an async high-density Pixi application and mounts its canvas", () => {
  assert.ok(existsSync(rendererPath), "createOfficeRenderer.js must exist");
  const source = readSource(rendererPath);

  assert.match(source, /new Application\(\)/);
  assert.match(source, /await app\.init\(\{[\s\S]*resizeTo:\s*host/);
  assert.match(source, /autoDensity:\s*true/);
  assert.match(source, /resolution:\s*Math\.min\(2,\s*Math\.max\(1,\s*globalThis\.devicePixelRatio\s*\|\|\s*1\)\)/);
  assert.match(source, /antialias:\s*true/);
  assert.match(source, /backgroundAlpha:\s*0/);
  assert.match(source, /preference:\s*["']webgl["']/);
  assert.match(source, /app\.canvas\.dataset\.officeRenderer\s*=\s*["']pixi["']/);
  assert.match(source, /host\.replaceChildren\(app\.canvas\)/);
});

test("keeps office and lounge roots alive while changing visibility and interaction", () => {
  assert.ok(existsSync(rendererPath), "createOfficeRenderer.js must exist");
  const source = readSource(rendererPath);

  assert.match(source, /new Container\(\).*office|office.*new Container\(\)/s);
  assert.match(source, /new Container\(\).*lounge|lounge.*new Container\(\)/s);
  assert.match(source, /\.visible\s*=/);
  assert.match(source, /\.eventMode\s*=/);
  assert.match(source, /setVisibleScene\s*=\s*\(sceneId\)/);
  assert.match(source, /worldToScreen\(point\s*=\s*\{\}\)/);
});

test("unloads character action strips and destroys the Pixi application once", () => {
  assert.ok(existsSync(rendererPath), "createOfficeRenderer.js must exist");
  const source = readSource(rendererPath);

  assert.match(source, /app\.ticker\.remove/);
  assert.match(source, /Assets\.unload/);
  assert.match(source, /app\.destroy\(true,\s*\{\s*children:\s*true,\s*texture:\s*true\s*\}\)/);
  assert.match(source, /if \(destroyed\) return/);
});

test("bridges renderer setup, prop synchronization, errors, and unmount races into React", () => {
  assert.ok(existsSync(canvasPath), "OfficeCanvas.jsx must exist");
  const source = readSource(canvasPath);

  assert.match(source, /export default function OfficeCanvas\(\{\s*world,\s*visibleSceneId,\s*onFrame,\s*onDoorSelect,\s*onActorSelect,\s*onReady,\s*onError,?\s*\}\)/s);
  assert.match(source, /createOfficeRenderer/);
  assert.match(source, /await import\(["']\.\/createOfficeRenderer\.js["']\)/);
  assert.doesNotMatch(source, /^import \{ createOfficeRenderer \}/m);
  assert.match(source, /renderer\.sync\(world\)/);
  assert.match(source, /renderer\.setVisibleScene\(visibleSceneId\)/);
  assert.match(source, /cancelled\s*=\s*true/);
  assert.match(source, /renderer\.destroy\(\)/);
  assert.match(source, /onReady/);
  assert.match(source, /onError/);
});

test("defines lazy future-facing assets and an empty scene view without fabricated art", () => {
  assert.ok(existsSync(sceneViewPath), "OfficeSceneView.js must exist");
  assert.ok(existsSync(manifestPath), "officeAssetManifest.js must exist");
  const manifestSource = readSource(manifestPath);
  const sceneViewSource = readSource(sceneViewPath);

  assert.match(manifestSource, /characterActionStrips/);
  assert.match(manifestSource, /work-office-v2/);
  assert.match(sceneViewSource, /class OfficeSceneView extends Container/);
  assert.doesNotMatch(manifestSource, /office-bg\.webp|stations\//);
});

test("mounts one high-density Pixi canvas in the Work screen", async () => {
  const vite = await createServer({
    appType: "spa",
    logLevel: "silent",
    root: fileURLToPath(new URL("../../..", import.meta.url)),
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  const address = vite.httpServer.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    await page.goto(`http://127.0.0.1:${port}/ai-roleplay-phone/`, { waitUntil: "networkidle" });
    await page.getByText("tap or swipe to unlock").click();
    await page.getByRole("button", { name: "工作" }).click();
    const canvas = page.locator('canvas[data-office-renderer="pixi"]');
    await canvas.waitFor({ state: "attached" });

    assert.equal(await canvas.count(), 1);
    const dimensions = await canvas.evaluate((element) => ({
      width: element.width,
      height: element.height,
    }));
    assert.ok(dimensions.width > 0);
    assert.ok(dimensions.height > 0);
  } finally {
    await browser.close();
    await vite.close();
  }
});
