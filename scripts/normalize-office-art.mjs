import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { chromium } from "playwright";
import { OFFICE_CANVAS, OFFICE_SLOT_RECTS } from "./office-art-spec.mjs";

const WEBP_QUALITY = 0.96;
const ATLAS_WEBP_QUALITY = 0.98;
const BREAK_STATES = ["both-empty", "left-occupied", "right-occupied", "both-occupied"];

const usage = () => `Usage:
  node scripts/normalize-office-art.mjs background --input <image> --output <webp> --width 1080 --height 1920
  node scripts/normalize-office-art.mjs station-pair --input <image> --slot <slot> --out-dir <directory>
  node scripts/normalize-office-art.mjs break-sheet --input <image> --out-dir <directory>
  node scripts/normalize-office-art.mjs atlas --input <image> --output <webp> --size 2048 --columns 8 --rows 8 --gutter 12 [--source-columns 10 | --source-columns-by-row 10,10,10,9,9,9,9,9] [--source-rows 8]`;

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
  const cellWidth = image.naturalWidth / spec.columns;
  const cellHeight = image.naturalHeight / spec.rows;
  return spec.targets.map((target, index) => {
    const column = index % spec.columns;
    const row = Math.floor(index / spec.columns);
    const cellCanvas = document.createElement("canvas");
    cellCanvas.width = Math.ceil(cellWidth);
    cellCanvas.height = Math.ceil(cellHeight);
    const cellContext = cellCanvas.getContext("2d", { willReadFrequently: true });
    cellContext.drawImage(
      image,
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      cellCanvas.width,
      cellCanvas.height,
    );
    const pixels = cellContext.getImageData(0, 0, cellCanvas.width, cellCanvas.height).data;
    let minX = cellCanvas.width;
    let minY = cellCanvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < cellCanvas.height; y += 1) {
      for (let x = 0; x < cellCanvas.width; x += 1) {
        if (pixels[((y * cellCanvas.width) + x) * 4 + 3] <= 16) continue;
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

const renderAtlas = (
  page,
  source,
  size,
  columns,
  rows,
  gutter,
  sourceColumnsByRow,
  sourceRows,
  columnMaps,
) => page.evaluate(async (spec) => {
  const image = new Image();
  image.src = spec.source;
  await image.decode();
  const targetCellWidth = spec.size / spec.columns;
  const targetCellHeight = spec.size / spec.rows;
  const output = document.createElement("canvas");
  output.width = spec.size;
  output.height = spec.size;
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  outputContext.clearRect(0, 0, output.width, output.height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0);
  const sourcePixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
  const rowOccupancy = [];
  for (let y = 0; y < sourceCanvas.height; y += 1) {
    let opaqueCount = 0;
    for (let x = 0; x < sourceCanvas.width; x += 1) {
      if (sourcePixels[((y * sourceCanvas.width) + x) * 4 + 3] > 16) opaqueCount += 1;
    }
    rowOccupancy.push(opaqueCount);
  }
  const nominalRowHeight = sourceCanvas.height / spec.sourceRows;
  const rowBoundaries = [0];
  for (let index = 1; index < spec.sourceRows; index += 1) {
    const nominal = index * nominalRowHeight;
    const radius = nominalRowHeight * 0.45;
    const minimum = Math.max(rowBoundaries[index - 1] + 1, Math.floor(nominal - radius));
    const maximum = Math.min(
      sourceCanvas.height - (spec.sourceRows - index),
      Math.ceil(nominal + radius),
    );
    let boundary = minimum;
    for (let y = minimum + 1; y <= maximum; y += 1) {
      if (rowOccupancy[y] < rowOccupancy[boundary]) boundary = y;
      else if (
        rowOccupancy[y] === rowOccupancy[boundary]
        && Math.abs(y - nominal) < Math.abs(boundary - nominal)
      ) boundary = y;
    }
    rowBoundaries.push(boundary);
  }
  rowBoundaries.push(sourceCanvas.height);
  const sourceRowBounds = rowBoundaries.slice(0, -1).map((start, index) => ({
    y: start,
    height: rowBoundaries[index + 1] - start,
  }));

  const sourceBoundsByRow = [];
  for (let row = 0; row < spec.sourceRows; row += 1) {
    const expectedSourceColumns = spec.sourceColumnsByRow[row];
    const detectedRow = sourceRowBounds[row];
    const sourceY = detectedRow.y;
    const sourceHeight = detectedRow.height;
    const rowCanvas = document.createElement("canvas");
    rowCanvas.width = image.naturalWidth;
    rowCanvas.height = Math.ceil(sourceHeight);
    const rowContext = rowCanvas.getContext("2d", { willReadFrequently: true });
    rowContext.drawImage(
      image,
      0,
      sourceY,
      image.naturalWidth,
      sourceHeight,
      0,
      0,
      rowCanvas.width,
      rowCanvas.height,
    );
    const rowPixels = rowContext.getImageData(0, 0, rowCanvas.width, rowCanvas.height).data;
    const runs = [];
    const columnOccupancy = [];
    let runStart = -1;
    for (let x = 0; x < rowCanvas.width; x += 1) {
      let opaqueCount = 0;
      for (let y = 0; y < rowCanvas.height; y += 1) {
        if (rowPixels[((y * rowCanvas.width) + x) * 4 + 3] > 16) opaqueCount += 1;
      }
      columnOccupancy.push(opaqueCount);
      const active = opaqueCount > 2;
      if (active && runStart < 0) runStart = x;
      if ((!active || x === rowCanvas.width - 1) && runStart >= 0) {
        const runEnd = active ? x : x - 1;
        if (runEnd - runStart >= 6) runs.push({ x: runStart, width: runEnd - runStart + 1, pad: true });
        runStart = -1;
      }
    }
    while (runs.length > expectedSourceColumns) {
      let closestIndex = 0;
      let closestGap = Number.POSITIVE_INFINITY;
      for (let index = 0; index < runs.length - 1; index += 1) {
        const gap = runs[index + 1].x - (runs[index].x + runs[index].width);
        if (gap < closestGap) {
          closestGap = gap;
          closestIndex = index;
        }
      }
      const first = runs[closestIndex];
      const second = runs[closestIndex + 1];
      runs.splice(closestIndex, 2, {
        x: first.x,
        width: (second.x + second.width) - first.x,
        pad: true,
      });
    }
    if (runs.length < expectedSourceColumns) {
      const nominalColumnWidth = rowCanvas.width / expectedSourceColumns;
      const columnBoundaries = [0];
      for (let index = 1; index < expectedSourceColumns; index += 1) {
        const nominal = index * nominalColumnWidth;
        const radius = nominalColumnWidth * 0.45;
        const minimum = Math.max(columnBoundaries[index - 1] + 1, Math.floor(nominal - radius));
        const maximum = Math.min(
          rowCanvas.width - (expectedSourceColumns - index),
          Math.ceil(nominal + radius),
        );
        let boundary = minimum;
        for (let x = minimum + 1; x <= maximum; x += 1) {
          if (columnOccupancy[x] < columnOccupancy[boundary]) boundary = x;
          else if (
            columnOccupancy[x] === columnOccupancy[boundary]
            && Math.abs(x - nominal) < Math.abs(boundary - nominal)
          ) boundary = x;
        }
        columnBoundaries.push(boundary);
      }
      columnBoundaries.push(rowCanvas.width);
      runs.splice(0, runs.length, ...columnBoundaries.slice(0, -1).map((start, index) => ({
        x: start,
        width: columnBoundaries[index + 1] - start,
        pad: false,
      })));
    }
    if (runs.length !== expectedSourceColumns) {
      throw new Error(`Atlas row ${row} contains ${runs.length} detected poses, expected ${expectedSourceColumns}`);
    }
    sourceBoundsByRow.push(runs);
  }

  for (let row = 0; row < spec.rows; row += 1) {
    for (let column = 0; column < spec.columns; column += 1) {
      const sourceColumn = spec.columnMaps[row][column];
      const detectedBounds = sourceBoundsByRow[row][sourceColumn];
      const detectedRow = sourceRowBounds[row];
      const padding = detectedBounds.pad ? 2 : 0;
      const sourceX = Math.max(0, detectedBounds.x - padding);
      const sourceWidth = Math.min(
        image.naturalWidth - sourceX,
        detectedBounds.width + (padding * 2),
      );
      const sourceY = detectedRow.y;
      const sourceHeight = detectedRow.height;
      const cell = document.createElement("canvas");
      cell.width = Math.ceil(sourceWidth);
      cell.height = Math.ceil(sourceHeight);
      const cellContext = cell.getContext("2d", { willReadFrequently: true });
      cellContext.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        cell.width,
        cell.height,
      );
      const pixels = cellContext.getImageData(0, 0, cell.width, cell.height).data;
      let minX = cell.width;
      let minY = cell.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < cell.height; y += 1) {
        for (let x = 0; x < cell.width; x += 1) {
          if (pixels[((y * cell.width) + x) * 4 + 3] <= 16) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      const cellIndex = (row * spec.columns) + column;
      if (maxX < minX || maxY < minY) throw new Error(`Atlas cell ${cellIndex} is empty`);

      const contentWidth = maxX - minX + 1;
      const contentHeight = maxY - minY + 1;
      const inset = spec.gutter + 2;
      const availableWidth = targetCellWidth - (inset * 2);
      const availableHeight = targetCellHeight - (inset * 2);
      const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
      const drawWidth = contentWidth * scale;
      const drawHeight = contentHeight * scale;
      const drawX = (column * targetCellWidth) + ((targetCellWidth - drawWidth) / 2);
      const drawY = (row * targetCellHeight) + ((targetCellHeight - drawHeight) / 2);
      outputContext.drawImage(
        cell,
        minX,
        minY,
        contentWidth,
        contentHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    }
  }

  const outputPixels = outputContext.getImageData(0, 0, output.width, output.height);
  for (let offset = 0; offset < outputPixels.data.length; offset += 4) {
    if (outputPixels.data[offset + 3] > 8) continue;
    outputPixels.data[offset] = 0;
    outputPixels.data[offset + 1] = 0;
    outputPixels.data[offset + 2] = 0;
    outputPixels.data[offset + 3] = 0;
  }
  outputContext.putImageData(outputPixels, 0, 0);

  for (let row = 0; row < spec.rows; row += 1) {
    for (let column = 0; column < spec.columns; column += 1) {
      let populated = false;
      for (let y = row * targetCellHeight; y < (row + 1) * targetCellHeight; y += 1) {
        for (let x = column * targetCellWidth; x < (column + 1) * targetCellWidth; x += 1) {
          const alpha = outputPixels.data[((y * output.width) + x) * 4 + 3];
          if (alpha <= 16) continue;
          populated = true;
          const localX = x - (column * targetCellWidth);
          const localY = y - (row * targetCellHeight);
          if (
            localX < spec.gutter
            || localY < spec.gutter
            || localX >= targetCellWidth - spec.gutter
            || localY >= targetCellHeight - spec.gutter
          ) {
            throw new Error(`Atlas cell ${(row * spec.columns) + column} violates the ${spec.gutter}px gutter`);
          }
        }
      }
      if (!populated) throw new Error(`Atlas cell ${(row * spec.columns) + column} is empty after normalization`);
    }
  }
  return output.toDataURL("image/webp", spec.quality);
}, {
  source,
  size,
  columns,
  rows,
  gutter,
  sourceColumnsByRow,
  sourceRows,
  columnMaps,
  quality: ATLAS_WEBP_QUALITY,
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

const normalizeAtlas = async (page, options) => {
  const input = requireOption(options, "input");
  const output = requireOption(options, "output");
  const size = Number(requireOption(options, "size"));
  const columns = Number(requireOption(options, "columns"));
  const rows = Number(requireOption(options, "rows"));
  const gutter = Number(requireOption(options, "gutter"));
  const sourceColumns = Number(options["source-columns"] || columns);
  const sourceRows = Number(options["source-rows"] || rows);
  const sourceColumnsByRow = options["source-columns-by-row"]
    ? options["source-columns-by-row"].split(",").map((value) => Number(value.trim()))
    : Array.from({ length: rows }, () => sourceColumns);
  if (![size, columns, rows, gutter, sourceColumns, sourceRows, ...sourceColumnsByRow].every(Number.isInteger)
    || size <= 0 || columns <= 0 || rows <= 0 || gutter < 0 || sourceColumns <= 0 || sourceRows <= 0
    || sourceColumnsByRow.some((value) => value <= 0)) {
    throw new Error("--size, --columns, and --rows must be positive integers; --gutter must be a non-negative integer");
  }
  if (size % columns !== 0 || size % rows !== 0) {
    throw new Error(`Atlas size ${size} must be divisible by ${columns} columns and ${rows} rows`);
  }
  const cellWidth = size / columns;
  const cellHeight = size / rows;
  if ((gutter * 2) >= cellWidth || (gutter * 2) >= cellHeight) {
    throw new Error(`Atlas gutter ${gutter} leaves no drawable cell area`);
  }
  if (sourceRows !== rows) throw new Error(`Atlas source rows ${sourceRows} must match output rows ${rows}`);
  if (sourceColumnsByRow.length !== rows) {
    throw new Error(`--source-columns-by-row must contain exactly ${rows} values`);
  }
  const columnMaps = sourceColumnsByRow.map((sourceColumnCount, row) => {
    if (sourceColumnCount === columns) return Array.from({ length: columns }, (_, index) => index);
    if (sourceColumnCount === 9 && columns === 8) return [0, 1, 2, 3, 5, 6, 7, 8];
    if (sourceColumnCount === 10 && columns === 8) {
      return row < 3
        ? [0, 1, 3, 4, 5, 6, 8, 9]
        : [0, 1, 2, 3, 6, 7, 8, 9];
    }
    if (sourceColumnCount === 11 && columns === 8) return [0, 1, 3, 4, 6, 7, 9, 10];
    throw new Error(`Unsupported atlas column regrid in row ${row}: ${sourceColumnCount} to ${columns}`);
  });
  const result = await renderAtlas(
    page,
    await readImageDataUrl(input),
    size,
    columns,
    rows,
    gutter,
    sourceColumnsByRow,
    sourceRows,
    columnMaps,
  );
  await writeDataUrl(output, result);
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
    else if (mode === "atlas") await normalizeAtlas(page, options);
    else throw new Error(`Unknown mode: ${mode}\n${usage()}`);
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
