import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";
import {
  OFFICE_BACKGROUND_PROMPT,
  OFFICE_CANVAS,
  OFFICE_MODULE_IDS,
  OFFICE_SLOT_RECTS,
  getBreakSheetPrompt,
  getStationPairPrompt,
} from "./office-art-spec.mjs";

const execFileAsync = promisify(execFile);
const normalizerPath = fileURLToPath(new URL("./normalize-office-art.mjs", import.meta.url));
let browser;
let fixtureDirectory;
let page;

const pngDataUrl = async ({ width, height, rectangles, background = null }) => page.evaluate((spec) => {
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext("2d");
  if (spec.background) {
    context.fillStyle = spec.background;
    context.fillRect(0, 0, spec.width, spec.height);
  }
  for (const rectangle of spec.rectangles) {
    context.fillStyle = rectangle.color;
    context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  }
  return canvas.toDataURL("image/png");
}, { width, height, rectangles, background });

const writeDataUrl = async (path, dataUrl) => {
  await writeFile(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
};

const inspectImage = async (path, samplePoints = []) => {
  const source = `data:image/webp;base64,${(await readFile(path)).toString("base64")}`;
  return page.evaluate(async ({ imageSource, points }) => {
    const image = new Image();
    image.src = imageSource;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight).data;
    let minX = image.naturalWidth;
    let minY = image.naturalHeight;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < image.naturalHeight; y += 1) {
      for (let x = 0; x < image.naturalWidth; x += 1) {
        if (pixels[((y * image.naturalWidth) + x) * 4 + 3] <= 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      alphaBounds: maxX >= 0 ? {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      } : null,
      corners: [
        context.getImageData(0, 0, 1, 1).data[3],
        context.getImageData(image.naturalWidth - 1, 0, 1, 1).data[3],
        context.getImageData(0, image.naturalHeight - 1, 1, 1).data[3],
        context.getImageData(image.naturalWidth - 1, image.naturalHeight - 1, 1, 1).data[3],
      ],
      samples: points.map(({ x, y }) => [...context.getImageData(x, y, 1, 1).data]),
    };
  }, { imageSource: source, points: samplePoints });
};

const runNormalizer = (...args) => execFileAsync(process.execPath, [normalizerPath, ...args]);

before(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), "office-art-normalizer-"));
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});

after(async () => {
  await browser?.close();
  await rm(fixtureDirectory, { recursive: true, force: true });
});

test("defines ten station and four break assets without duplicates", () => {
  assert.equal(OFFICE_MODULE_IDS.length, 14);
  assert.equal(new Set(OFFICE_MODULE_IDS).size, 14);
  assert.equal(OFFICE_MODULE_IDS.filter((id) => id.includes("active-shell")).length, 5);
  assert.equal(OFFICE_MODULE_IDS.filter((id) => id.startsWith("break-")).length, 4);
});

test("keeps immutable art rectangles aligned to the 1080x1920 office hit areas", () => {
  assert.deepEqual(OFFICE_CANVAS, { width: 1080, height: 1920 });
  assert.deepEqual(OFFICE_SLOT_RECTS, {
    boss: { x: 346, y: 307, width: 389, height: 269 },
    employee1: { x: 86, y: 749, width: 346, height: 288 },
    employee2: { x: 648, y: 749, width: 346, height: 288 },
    employee3: { x: 86, y: 1114, width: 346, height: 288 },
    employee4: { x: 648, y: 1114, width: 346, height: 288 },
    break: { x: 32, y: 1613, width: 454, height: 250 },
  });
  for (const rect of Object.values(OFFICE_SLOT_RECTS)) {
    assert.ok(rect.x >= 0 && rect.y >= 0);
    assert.ok(rect.x + rect.width <= OFFICE_CANVAS.width);
    assert.ok(rect.y + rect.height <= OFFICE_CANVAS.height);
  }
});

test("records the architecture-only background direction verbatim", () => {
  assert.match(OFFICE_BACKGROUND_PROMPT, /architecture and built-ins only/);
  assert.match(OFFICE_BACKGROUND_PROMPT, /Avoid: freestanding desks, office chairs, stools/);
  assert.match(OFFICE_BACKGROUND_PROMPT, /pearl white dominant/);
  assert.doesNotMatch(OFFICE_BACKGROUND_PROMPT, /transparent background/);
});

test("builds reproducible paired station prompts with strict state invariants", () => {
  const prompt = getStationPairPrompt("employee2");

  assert.match(prompt, /strict side-by-side two-state sheet/);
  assert.match(prompt, /EMPTY state.*complete desk.*one empty chair.*idle computer.*desk lamp/s);
  assert.match(prompt, /ACTIVE-SHELL state.*identical desk geometry.*removes the chair, computer, books, phone, food, controller, and all loose props/s);
  assert.match(prompt, /perfectly flat solid #00ff00 chroma-key background/);
  assert.match(prompt, /no cast shadow beyond a soft local contact shadow/);
  assert.match(prompt, /mist-blue accent/);
  assert.throws(() => getStationPairPrompt("unknown"), /Unknown office station/);
});

test("builds a strict reading-order break sheet prompt", () => {
  const prompt = getBreakSheetPrompt();

  assert.match(prompt, /strict 2 x 2 state sheet/);
  assert.match(prompt, /top-left: both seats empty/);
  assert.match(prompt, /top-right: left occupied/);
  assert.match(prompt, /bottom-left: right occupied/);
  assert.match(prompt, /bottom-right: both occupied/);
  assert.match(prompt, /Occupied means remove the corresponding stool and loose food/);
  assert.match(prompt, /fixed break counter is already baked into the office background/);
  assert.match(prompt, /do not draw the counter in any cell/);
  assert.match(prompt, /bottom-right cell must be completely empty chroma-key background/);
  assert.match(prompt, /perfectly flat solid #00ff00 chroma-key background/);
  assert.doesNotMatch(prompt, /counter remains identical/);
});

test("normalizes a cover-cropped opaque background to 1080x1920 WebP", async () => {
  const input = join(fixtureDirectory, "background.png");
  const output = join(fixtureDirectory, "background.webp");
  await writeDataUrl(input, await pngDataUrl({
    width: 400,
    height: 200,
    background: "#f4f1ed",
    rectangles: [],
  }));

  await runNormalizer(
    "background",
    "--input", input,
    "--output", output,
    "--width", "1080",
    "--height", "1920",
  );

  const result = await inspectImage(output);
  assert.deepEqual(result, {
    width: 1080,
    height: 1920,
    alphaBounds: { x: 0, y: 0, width: 1080, height: 1920 },
    corners: [255, 255, 255, 255],
    samples: [],
  });
});

test("splits a station pair at the midpoint into aligned transparent full canvases", async () => {
  const input = join(fixtureDirectory, "employee1-pair.png");
  const outputDirectory = join(fixtureDirectory, "stations");
  await writeDataUrl(input, await pngDataUrl({
    width: 400,
    height: 200,
    rectangles: [
      { x: 20, y: 20, width: 160, height: 160, color: "#df3048" },
      { x: 220, y: 20, width: 160, height: 160, color: "#367de0" },
    ],
  }));

  await runNormalizer(
    "station-pair",
    "--input", input,
    "--slot", "employee1",
    "--out-dir", outputDirectory,
  );

  const rect = OFFICE_SLOT_RECTS.employee1;
  const sample = [{ x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) }];
  const empty = await inspectImage(join(outputDirectory, "employee1-empty.webp"), sample);
  const active = await inspectImage(join(outputDirectory, "employee1-active-shell.webp"), sample);
  assert.deepEqual([empty.width, empty.height, empty.corners], [1080, 1920, [0, 0, 0, 0]]);
  assert.deepEqual([active.width, active.height, active.corners], [1080, 1920, [0, 0, 0, 0]]);
  assert.ok(Math.abs(empty.alphaBounds.width - empty.alphaBounds.height) <= 2,
    `station object should preserve its square aspect ratio: ${empty.alphaBounds.width}x${empty.alphaBounds.height}`);
  assert.ok(Math.abs(active.alphaBounds.width - active.alphaBounds.height) <= 2,
    `station shell should preserve its square aspect ratio: ${active.alphaBounds.width}x${active.alphaBounds.height}`);
  assert.ok(empty.samples[0][0] > empty.samples[0][2], "empty state should come from the red left half");
  assert.ok(active.samples[0][2] > active.samples[0][0], "active shell should come from the blue right half");
});

test("splits a break sheet in reading order into four transparent full canvases", async () => {
  const input = join(fixtureDirectory, "break-sheet.png");
  const outputDirectory = join(fixtureDirectory, "break");
  await writeDataUrl(input, await pngDataUrl({
    width: 400,
    height: 400,
    rectangles: [
      { x: 20, y: 20, width: 160, height: 160, color: "#df3048" },
      { x: 220, y: 20, width: 160, height: 160, color: "#367de0" },
      { x: 20, y: 220, width: 160, height: 160, color: "#e3bf24" },
    ],
  }));

  await runNormalizer(
    "break-sheet",
    "--input", input,
    "--out-dir", outputDirectory,
  );

  const rect = OFFICE_SLOT_RECTS.break;
  const point = [{ x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) }];
  const files = ["both-empty", "left-occupied", "right-occupied", "both-occupied"];
  const results = await Promise.all(files.map((name) => inspectImage(join(outputDirectory, `${name}.webp`), point)));
  assert.deepEqual(results.map(({ width, height, corners }) => [width, height, corners]), [
    [1080, 1920, [0, 0, 0, 0]],
    [1080, 1920, [0, 0, 0, 0]],
    [1080, 1920, [0, 0, 0, 0]],
    [1080, 1920, [0, 0, 0, 0]],
  ]);
  assert.ok(results[0].samples[0][0] > results[0].samples[0][2], "top-left should be red");
  assert.ok(results[1].samples[0][2] > results[1].samples[0][0], "top-right should be blue");
  assert.ok(results[2].samples[0][0] > results[2].samples[0][2], "bottom-left should be yellow");
  assert.equal(results[3].alphaBounds, null, "both-occupied state should be fully transparent");
  assert.deepEqual(results[3].samples[0], [0, 0, 0, 0]);
});
