import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { chromium } from "playwright";
import { OFFICE_CANVAS, OFFICE_SLOT_RECTS } from "./office-art-spec.mjs";

const WEBP_QUALITY = 0.96;
const BREAK_STATES = ["both-empty", "left-occupied", "right-occupied", "both-occupied"];

const usage = () => `Usage:
  node scripts/normalize-office-art.mjs background --input <image> --output <webp> --width 1080 --height 1920
  node scripts/normalize-office-art.mjs station-pair --input <image> --slot <slot> --out-dir <directory>
  node scripts/normalize-office-art.mjs break-sheet --input <image> --out-dir <directory>`;

const parseArguments = (values) => {
  const [mode, ...rest] = values;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(usage());
    options[name.slice(2)] = value;
  }
  return { mode, options };
};

const requireOption = (options, name) => {
  const value = options[name];
  if (!value) throw new Error(`Missing --${name}\n${usage()}`);
  return value;
};

const getMimeType = (path) => {
  const extension = extname(path).toLowerCase();
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "image/png";
};

const readImageDataUrl = async (path) => {
  const buffer = await readFile(path);
  return `data:${getMimeType(path)};base64,${buffer.toString("base64")}`;
};

const writeDataUrl = async (path, dataUrl) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
};

const renderBackground = (page, source, width, height) => page.evaluate(async (spec) => {
  const image = new Image();
  image.src = spec.source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const scale = Math.max(spec.width / image.naturalWidth, spec.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (spec.width - drawWidth) / 2,
    (spec.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return canvas.toDataURL("image/webp", spec.quality);
}, { source, width, height, quality: WEBP_QUALITY });

const renderCells = (page, source, columns, rows, targets) => page.evaluate(async (spec) => {
  const image = new Image();
  image.src = spec.source;
  await image.decode();
  if (image.naturalWidth % spec.columns !== 0 || image.naturalHeight % spec.rows !== 0) {
    throw new Error(`Sheet dimensions ${image.naturalWidth}x${image.naturalHeight} are not divisible by ${spec.columns}x${spec.rows}`);
  }
  const cellWidth = image.naturalWidth / spec.columns;
  const cellHeight = image.naturalHeight / spec.rows;
  return spec.targets.map((target, index) => {
    const column = index % spec.columns;
    const row = Math.floor(index / spec.columns);
    const cellCanvas = document.createElement("canvas");
    cellCanvas.width = cellWidth;
    cellCanvas.height = cellHeight;
    const cellContext = cellCanvas.getContext("2d", { willReadFrequently: true });
    cellContext.drawImage(
      image,
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      cellWidth,
      cellHeight,
    );
    const pixels = cellContext.getImageData(0, 0, cellWidth, cellHeight).data;
    let minX = cellWidth;
    let minY = cellHeight;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < cellHeight; y += 1) {
      for (let x = 0; x < cellWidth; x += 1) {
        if (pixels[((y * cellWidth) + x) * 4 + 3] <= 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = spec.canvas.width;
    canvas.height = spec.canvas.height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (maxX < minX || maxY < minY) {
      if (!target.allowEmpty) throw new Error(`Sheet cell ${index} is empty`);
      return canvas.toDataURL("image/webp", spec.quality);
    }
    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    const scale = Math.min(target.width / contentWidth, target.height / contentHeight) * 0.94;
    const drawWidth = contentWidth * scale;
    const drawHeight = contentHeight * scale;
    const drawX = target.x + ((target.width - drawWidth) / 2);
    const drawY = target.y + ((target.height - drawHeight) / 2);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      cellCanvas,
      minX,
      minY,
      contentWidth,
      contentHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
    const outputPixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let offset = 0; offset < outputPixels.data.length; offset += 4) {
      if (outputPixels.data[offset + 3] > 8) continue;
      outputPixels.data[offset] = 0;
      outputPixels.data[offset + 1] = 0;
      outputPixels.data[offset + 2] = 0;
      outputPixels.data[offset + 3] = 0;
    }
    context.putImageData(outputPixels, 0, 0);
    return canvas.toDataURL("image/webp", spec.quality);
  });
}, {
  source,
  columns,
  rows,
  targets,
  canvas: OFFICE_CANVAS,
  quality: WEBP_QUALITY,
});

const normalizeBackground = async (page, options) => {
  const input = requireOption(options, "input");
  const output = requireOption(options, "output");
  const width = Number(requireOption(options, "width"));
  const height = Number(requireOption(options, "height"));
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error("--width and --height must be positive integers");
  }
  const result = await renderBackground(page, await readImageDataUrl(input), width, height);
  await writeDataUrl(output, result);
};

const normalizeStationPair = async (page, options) => {
  const input = requireOption(options, "input");
  const slot = requireOption(options, "slot");
  const outputDirectory = requireOption(options, "out-dir");
  const rectangle = OFFICE_SLOT_RECTS[slot];
  if (!rectangle || slot === "break") throw new Error(`Unknown office station: ${slot}`);
  const results = await renderCells(page, await readImageDataUrl(input), 2, 1, [rectangle, rectangle]);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeDataUrl(join(outputDirectory, `${slot}-empty.webp`), results[0]),
    writeDataUrl(join(outputDirectory, `${slot}-active-shell.webp`), results[1]),
  ]);
};

const normalizeBreakSheet = async (page, options) => {
  const input = requireOption(options, "input");
  const outputDirectory = requireOption(options, "out-dir");
  const results = await renderCells(
    page,
    await readImageDataUrl(input),
    2,
    2,
    BREAK_STATES.map((state) => ({
      ...OFFICE_SLOT_RECTS.break,
      allowEmpty: state === "both-occupied",
    })),
  );
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(BREAK_STATES.map((state, index) => (
    writeDataUrl(join(outputDirectory, `${state}.webp`), results[index])
  )));
};

const main = async () => {
  const { mode, options } = parseArguments(process.argv.slice(2));
  if (!mode) throw new Error(usage());
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    if (mode === "background") await normalizeBackground(page, options);
    else if (mode === "station-pair") await normalizeStationPair(page, options);
    else if (mode === "break-sheet") await normalizeBreakSheet(page, options);
    else throw new Error(`Unknown mode: ${mode}\n${usage()}`);
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
