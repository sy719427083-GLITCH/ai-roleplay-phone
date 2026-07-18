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
  OFFICE_CHARACTER_SPECS,
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

const inspectAtlas = async (path, columns, rows, gutter) => {
  const source = `data:image/webp;base64,${(await readFile(path)).toString("base64")}`;
  return page.evaluate(async (spec) => {
    const image = new Image();
    image.src = spec.source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const cellWidth = canvas.width / spec.columns;
    const cellHeight = canvas.height / spec.rows;
    let populatedCells = 0;
    let gutterOpaquePixels = 0;
    for (let row = 0; row < spec.rows; row += 1) {
      for (let column = 0; column < spec.columns; column += 1) {
        let populated = false;
        for (let y = row * cellHeight; y < (row + 1) * cellHeight; y += 1) {
          for (let x = column * cellWidth; x < (column + 1) * cellWidth; x += 1) {
            const alpha = pixels[((y * canvas.width) + x) * 4 + 3];
            if (alpha <= 16) continue;
            populated = true;
            const localX = x - (column * cellWidth);
            const localY = y - (row * cellHeight);
            if (
              localX < spec.gutter
              || localY < spec.gutter
              || localX >= cellWidth - spec.gutter
              || localY >= cellHeight - spec.gutter
            ) gutterOpaquePixels += 1;
          }
        }
        if (populated) populatedCells += 1;
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      cellWidth,
      cellHeight,
      populatedCells,
      gutterOpaquePixels,
    };
  }, { source, columns, rows, gutter });
};

const sampleAtlasCenters = async (path, columns, rows) => {
  const source = `data:image/webp;base64,${(await readFile(path)).toString("base64")}`;
  return page.evaluate(async (spec) => {
    const image = new Image();
    image.src = spec.source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const cellWidth = canvas.width / spec.columns;
    const cellHeight = canvas.height / spec.rows;
    return Array.from({ length: spec.rows }, (_, row) => (
      Array.from({ length: spec.columns }, (_, column) => (
        [...context.getImageData(
          Math.floor((column + 0.5) * cellWidth),
          Math.floor((row + 0.5) * cellHeight),
          1,
          1,
        ).data]
      ))
    ));
  }, { source, columns, rows });
};

const countAtlasColorMismatches = async (path, expectedRows) => {
  const source = `data:image/webp;base64,${(await readFile(path)).toString("base64")}`;
  return page.evaluate(async (spec) => {
    const image = new Image();
    image.src = spec.source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const rows = spec.expectedRows.length;
    const columns = spec.expectedRows[0].length;
    const cellWidth = canvas.width / columns;
    const cellHeight = canvas.height / rows;
    return spec.expectedRows.map((expectedRow, row) => expectedRow.map((expected, column) => {
      let mismatches = 0;
      for (let y = row * cellHeight; y < (row + 1) * cellHeight; y += 1) {
        for (let x = column * cellWidth; x < (column + 1) * cellWidth; x += 1) {
          const offset = ((y * canvas.width) + x) * 4;
          if (data[offset + 3] <= 128) continue;
          if (
            Math.abs(data[offset] - expected[0]) > 48
            || Math.abs(data[offset + 1] - expected[1]) > 48
            || Math.abs(data[offset + 2] - expected[2]) > 48
          ) mismatches += 1;
        }
      }
      return mismatches;
    }));
  }, { source, expectedRows });
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

test("defines sixteen distinct office characters and required female silhouettes", () => {
  assert.equal(OFFICE_CHARACTER_SPECS.length, 16);
  assert.equal(new Set(OFFICE_CHARACTER_SPECS.map(({ id }) => id)).size, 16);
  const women = OFFICE_CHARACTER_SPECS.filter(({ id }) => id.includes("-f-"));
  assert.equal(women.length, 8);
  assert.equal(women.every(({ hair }) => hair.includes("long")), true);
  for (const garment of [
    "fitted charcoal short skirt",
    "midi dress",
    "short A-line skirt",
    "pleated short skirt",
  ]) {
    assert.equal(women.some(({ outfit }) => outfit.includes(garment)), true, garment);
  }
});

test("keeps immutable art rectangles aligned to the 1080x1920 office hit areas", () => {
  assert.deepEqual(OFFICE_CANVAS, { width: 1080, height: 1920 });
  assert.deepEqual(OFFICE_SLOT_RECTS, {
    boss: { x: 346, y: 395, width: 389, height: 269 },
    employee1: { x: 100, y: 673, width: 346, height: 288 },
    employee2: { x: 634, y: 673, width: 346, height: 288 },
    employee3: { x: 100, y: 1080, width: 346, height: 288 },
    employee4: { x: 634, y: 1080, width: 346, height: 288 },
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
  assert.match(OFFICE_BACKGROUND_PROMPT, /continuous open-plan floor/);
  assert.match(OFFICE_BACKGROUND_PROMPT, /empty center/);
  assert.match(OFFICE_BACKGROUND_PROMPT, /desk can be placed exactly in the middle/);
  assert.match(OFFICE_BACKGROUND_PROMPT, /no interior walls, half-height walls, cubicle dividers, or privacy partitions/);
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
  assert.match(prompt, /front-facing workstation/);
  assert.match(prompt, /desk's long front edge perfectly horizontal/);
  assert.match(prompt, /no diagonal, rotated, or corner-facing desk/);
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
    width: 401,
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

test("normalizes all atlas cells to a sharp 2048 grid with transparent gutters", async () => {
  const input = join(fixtureDirectory, "atlas.png");
  const output = join(fixtureDirectory, "atlas.webp");
  const rectangles = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      rectangles.push({
        x: (column * 64) + 16,
        y: (row * 64) + 12,
        width: 32,
        height: 40,
        color: (row + column) % 2 === 0 ? "#df3048" : "#367de0",
      });
    }
  }
  rectangles.push({ x: 1, y: 0, width: 3, height: 512, color: "#808080" });
  await writeDataUrl(input, await pngDataUrl({ width: 512, height: 512, rectangles }));

  await runNormalizer(
    "atlas",
    "--input", input,
    "--output", output,
    "--size", "2048",
    "--columns", "8",
    "--rows", "8",
    "--gutter", "12",
  );

  assert.deepEqual(await inspectAtlas(output, 8, 8, 12), {
    width: 2048,
    height: 2048,
    cellWidth: 256,
    cellHeight: 256,
    populatedCells: 64,
    gutterOpaquePixels: 0,
  });
});

test("regrids ten generated columns into the required eight-frame contract", async () => {
  const input = join(fixtureDirectory, "wide-atlas.png");
  const output = join(fixtureDirectory, "wide-atlas.webp");
  const colors = [
    "#d02030", "#d07020", "#c0a020", "#70a020", "#20a050",
    "#2090a0", "#2060d0", "#6030c0", "#a030a0", "#d03070",
  ];
  const rectangles = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      rectangles.push({
        x: (column * 64) + 12,
        y: (row * 64) + 12,
        width: 40,
        height: 40,
        color: colors[column],
      });
    }
  }
  await writeDataUrl(input, await pngDataUrl({ width: 640, height: 512, rectangles }));

  await runNormalizer(
    "atlas",
    "--input", input,
    "--output", output,
    "--size", "2048",
    "--columns", "8",
    "--rows", "8",
    "--source-columns", "10",
    "--source-rows", "8",
    "--gutter", "12",
  );

  const samples = await sampleAtlasCenters(output, 8, 8);
  const dominant = (rgba) => rgba.slice(0, 3).map((value) => Math.round(value / 16) * 16);
  assert.deepEqual(samples[0].map(dominant), [0, 1, 3, 4, 5, 6, 8, 9].map((index) => dominant([
    Number.parseInt(colors[index].slice(1, 3), 16),
    Number.parseInt(colors[index].slice(3, 5), 16),
    Number.parseInt(colors[index].slice(5, 7), 16),
    255,
  ])));
  assert.deepEqual(samples[3].map(dominant), [0, 1, 2, 3, 6, 7, 8, 9].map((index) => dominant([
    Number.parseInt(colors[index].slice(1, 3), 16),
    Number.parseInt(colors[index].slice(3, 5), 16),
    Number.parseInt(colors[index].slice(5, 7), 16),
    255,
  ])));
});

test("regrids nine generated columns without slicing neighboring poses", async () => {
  const input = join(fixtureDirectory, "nine-column-atlas.png");
  const output = join(fixtureDirectory, "nine-column-atlas.webp");
  const colors = [
    "#d02030", "#d07020", "#c0a020", "#70a020", "#20a050",
    "#2090a0", "#2060d0", "#6030c0", "#a030a0",
  ];
  const unevenStarts = [5, 55, 125, 195, 260, 325, 390, 455, 520];
  const rectangles = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      rectangles.push({
        x: unevenStarts[column],
        y: (row * 64) + 12,
        width: 42,
        height: 40,
        color: colors[column],
      });
    }
  }
  await writeDataUrl(input, await pngDataUrl({ width: 576, height: 512, rectangles }));

  await runNormalizer(
    "atlas",
    "--input", input,
    "--output", output,
    "--size", "2048",
    "--columns", "8",
    "--rows", "8",
    "--source-columns", "9",
    "--source-rows", "8",
    "--gutter", "12",
  );

  const samples = await sampleAtlasCenters(output, 8, 8);
  const dominant = (rgba) => rgba.slice(0, 3).map((value) => Math.round(value / 16) * 16);
  const expected = [0, 1, 2, 3, 5, 6, 7, 8].map((index) => dominant([
    Number.parseInt(colors[index].slice(1, 3), 16),
    Number.parseInt(colors[index].slice(3, 5), 16),
    Number.parseInt(colors[index].slice(5, 7), 16),
    255,
  ]));
  assert.deepEqual(samples[0].map(dominant), expected);
  assert.deepEqual(samples[3].map(dominant), expected);
  const exactColors = [0, 1, 2, 3, 5, 6, 7, 8].map((index) => [
    Number.parseInt(colors[index].slice(1, 3), 16),
    Number.parseInt(colors[index].slice(3, 5), 16),
    Number.parseInt(colors[index].slice(5, 7), 16),
  ]);
  const mismatches = await countAtlasColorMismatches(
    output,
    Array.from({ length: 8 }, () => exactColors),
  );
  assert.equal(mismatches.flat().every((count) => count === 0), true, JSON.stringify(mismatches));
});

test("supports ten walk frames and nine paired-action frames in one source", async () => {
  const input = join(fixtureDirectory, "mixed-column-atlas.png");
  const output = join(fixtureDirectory, "mixed-column-atlas.webp");
  const colors = [
    "#d02030", "#d07020", "#c0a020", "#70a020", "#20a050",
    "#2090a0", "#2060d0", "#6030c0", "#a030a0", "#d03070",
  ];
  const rectangles = [];
  for (let row = 0; row < 8; row += 1) {
    const sourceColumns = row < 3 ? 10 : 9;
    const stride = 640 / sourceColumns;
    for (let column = 0; column < sourceColumns; column += 1) {
      rectangles.push({
        x: Math.floor(column * stride) + 12,
        y: (row * 64) + 12,
        width: 40,
        height: 40,
        color: colors[column],
      });
    }
  }
  await writeDataUrl(input, await pngDataUrl({ width: 640, height: 512, rectangles }));

  await runNormalizer(
    "atlas",
    "--input", input,
    "--output", output,
    "--size", "2048",
    "--columns", "8",
    "--rows", "8",
    "--source-columns-by-row", "10,10,10,9,9,9,9,9",
    "--source-rows", "8",
    "--gutter", "12",
  );

  const samples = await sampleAtlasCenters(output, 8, 8);
  const dominant = (rgba) => rgba.slice(0, 3).map((value) => Math.round(value / 16) * 16);
  const expectedColors = (indices) => indices.map((index) => dominant([
    Number.parseInt(colors[index].slice(1, 3), 16),
    Number.parseInt(colors[index].slice(3, 5), 16),
    Number.parseInt(colors[index].slice(5, 7), 16),
    255,
  ]));
  assert.deepEqual(samples[0].map(dominant), expectedColors([0, 1, 3, 4, 5, 6, 8, 9]));
  assert.deepEqual(samples[3].map(dominant), expectedColors([0, 1, 2, 3, 5, 6, 7, 8]));
});

test("regrids eleven generated poses symmetrically into eight frames", async () => {
  const input = join(fixtureDirectory, "eleven-column-atlas.png");
  const output = join(fixtureDirectory, "eleven-column-atlas.webp");
  const colors = [
    "#d02030", "#d07020", "#c0a020", "#70a020", "#20a050", "#208080",
    "#2090a0", "#2060d0", "#6030c0", "#a030a0", "#d03070",
  ];
  const rectangles = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 11; column += 1) {
      rectangles.push({
        x: (column * 60) + 10,
        y: (row * 64) + 12,
        width: 38,
        height: 40,
        color: colors[column],
      });
    }
    rectangles.push({
      x: 288,
      y: (row * 64) + 30,
      width: 22,
      height: 3,
      color: colors[4],
    });
  }
  await writeDataUrl(input, await pngDataUrl({ width: 660, height: 512, rectangles }));
  await runNormalizer(
    "atlas", "--input", input, "--output", output,
    "--size", "2048", "--columns", "8", "--rows", "8",
    "--source-columns", "11", "--source-rows", "8", "--gutter", "12",
  );
  const samples = await sampleAtlasCenters(output, 8, 8);
  const dominant = (rgba) => rgba.slice(0, 3).map((value) => Math.round(value / 16) * 16);
  const expected = [0, 1, 3, 4, 6, 7, 9, 10].map((index) => dominant([
    Number.parseInt(colors[index].slice(1, 3), 16),
    Number.parseInt(colors[index].slice(3, 5), 16),
    Number.parseInt(colors[index].slice(5, 7), 16),
    255,
  ]));
  assert.deepEqual(samples[0].map(dominant), expected);
  assert.deepEqual(samples[4].map(dominant), expected);
});

test("detects uneven source row bands without horizontal pose fragments", async () => {
  const input = join(fixtureDirectory, "uneven-row-atlas.png");
  const output = join(fixtureDirectory, "uneven-row-atlas.webp");
  const colors = [
    "#d02030", "#d07020", "#c0a020", "#70a020",
    "#20a050", "#2090a0", "#2060d0", "#6030c0",
  ];
  const unevenStarts = [5, 55, 125, 195, 260, 325, 390, 455];
  const rectangles = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      rectangles.push({
        x: (column * 64) + 12,
        y: unevenStarts[row],
        width: 40,
        height: 42,
        color: colors[row],
      });
    }
  }
  await writeDataUrl(input, await pngDataUrl({ width: 512, height: 512, rectangles }));

  await runNormalizer(
    "atlas",
    "--input", input,
    "--output", output,
    "--size", "2048",
    "--columns", "8",
    "--rows", "8",
    "--gutter", "12",
  );

  const expectedRows = colors.map((color) => Array.from({ length: 8 }, () => [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]));
  const mismatches = await countAtlasColorMismatches(output, expectedRows);
  assert.equal(mismatches.flat().every((count) => count === 0), true, JSON.stringify(mismatches));
});
