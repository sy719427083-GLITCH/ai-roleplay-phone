import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  OFFICE_CHARACTER_IDS,
  OFFICE_CLIP_IDS,
  OFFICE_CLIP_METADATA,
} from "../src/work/pixi/officeCharacterClips.js";
import { OFFICE_V2_CHARACTER_CONTRACT } from "./office-v2-art-spec.mjs";

export const CHARACTER_COHORTS = Object.freeze(["employee-f", "employee-m", "boss-f", "boss-m"]);
export const CHARACTER_SOURCE_MIN_CELL_SIZE = OFFICE_V2_CHARACTER_CONTRACT.source.minimumCellSize;

const ALPHA_THRESHOLD = 12;
const POPULATED_ALPHA_THRESHOLD = 32;
const WEBP_PATTERN = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/;

export function getCharacterIdsForCohort(cohort) {
  if (!CHARACTER_COHORTS.includes(cohort)) {
    throw new Error(`Character cohort must be one of: ${CHARACTER_COHORTS.join(", ")}`);
  }
  return OFFICE_CHARACTER_IDS.filter((id) => id.startsWith(`${cohort}-`));
}

export function validateCharacterMasterDimensions({ width, height, metadata }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Character master dimensions must be positive integers, received ${width}x${height}`);
  }
  if (width % metadata.columns !== 0 || height % metadata.rows !== 0) {
    throw new Error(
      `Character master ${width}x${height} must be divisible by ${metadata.columns} columns and ${metadata.rows} rows`,
    );
  }
  const sourceCellWidth = width / metadata.columns;
  const sourceCellHeight = height / metadata.rows;
  if (sourceCellWidth < CHARACTER_SOURCE_MIN_CELL_SIZE || sourceCellHeight < CHARACTER_SOURCE_MIN_CELL_SIZE) {
    throw new Error(
      `Character source cells must be at least 512x512, received ${sourceCellWidth}x${sourceCellHeight}`,
    );
  }
  return { sourceCellWidth, sourceCellHeight };
}

export function decodeWebPDataUrl(dataUrl) {
  const match = typeof dataUrl === "string" ? dataUrl.match(WEBP_PATTERN) : null;
  if (!match || !match[1]) throw new Error("Expected a valid WebP base64 data URL");
  const buffer = Buffer.from(match[1], "base64");
  const isWebP = buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isWebP) throw new Error("Expected a valid WebP base64 data URL");
  return buffer;
}

async function decodeImageDimensions(page, dataUrl) {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, dataUrl);
}

export function analyzeFurnitureLikeComponents({ alpha, width, height, alphaThreshold = 32 }) {
  const visited = new Uint8Array(width * height);
  const components = [];
  const neighborOffsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];

  for (let start = 0; start < alpha.length; start += 1) {
    if (visited[start] || alpha[start] <= alphaThreshold) continue;
    const pending = [start];
    visited[start] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    const rows = new Map();

    while (pending.length > 0) {
      const index = pending.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const row = rows.get(y) || { minX: width, maxX: -1, count: 0 };
      row.minX = Math.min(row.minX, x);
      row.maxX = Math.max(row.maxX, x);
      row.count += 1;
      rows.set(y, row);

      for (const [offsetX, offsetY] of neighborOffsets) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = (nextY * width) + nextX;
        if (visited[next] || alpha[next] <= alphaThreshold) continue;
        visited[next] = 1;
        pending.push(next);
      }
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const density = area / (componentWidth * componentHeight);
    const rowStats = [...rows.values()];
    const coreRows = rowStats.filter(({ count }) => count >= componentWidth * 0.7);
    const leftEdges = coreRows.map(({ minX: edge }) => edge);
    const rightEdges = coreRows.map(({ maxX: edge }) => edge);
    const rowWidths = coreRows.map(({ minX: left, maxX: right }) => right - left + 1);
    const spread = (values) => values.length > 0 ? Math.max(...values) - Math.min(...values) : Infinity;
    const rowFill = coreRows.length > 0
      ? coreRows.reduce((total, row) => total + (row.count / (row.maxX - row.minX + 1)), 0) / coreRows.length
      : 0;
    const broad = componentWidth >= width * 0.6;
    const sufficientlyTall = componentHeight >= height * 0.16;
    const dense = density >= 0.78;
    const stableEdges = spread(leftEdges) <= componentWidth * 0.06
      && spread(rightEdges) <= componentWidth * 0.06;
    const stableWidth = spread(rowWidths) <= componentWidth * 0.12;
    const rectangularRows = coreRows.length >= componentHeight * 0.75 && rowFill >= 0.9;
    const furnitureLike = broad && sufficientlyTall && dense && stableEdges && stableWidth && rectangularRows;
    components.push({
      area,
      bounds: { minX, minY, maxX, maxY, width: componentWidth, height: componentHeight },
      density,
      coreRows: coreRows.length,
      rowFill,
      stableEdges,
      stableWidth,
      furnitureLike,
    });
  }

  const minimumCoreWidth = Math.ceil(width * 0.57);
  const minimumCoreHeight = Math.ceil(height * 0.16);
  const denseRows = [];
  for (let y = 0; y < height; y += 1) {
    let minX = width;
    let maxX = -1;
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (alpha[(y * width) + x] <= alphaThreshold) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      count += 1;
    }
    const span = maxX >= minX ? maxX - minX + 1 : 0;
    denseRows.push(span >= minimumCoreWidth && count / span >= 0.92
      ? { y, minX, maxX, count, span }
      : null);
  }

  const rectangularCores = [];
  let runStart = 0;
  while (runStart < denseRows.length) {
    while (runStart < denseRows.length && denseRows[runStart] === null) runStart += 1;
    if (runStart >= denseRows.length) break;
    let runEnd = runStart;
    while (runEnd + 1 < denseRows.length && denseRows[runEnd + 1] !== null) runEnd += 1;
    const rows = denseRows.slice(runStart, runEnd + 1);
    if (rows.length >= minimumCoreHeight) {
      const widths = rows.map(({ span }) => span).sort((left, right) => left - right);
      const medianWidth = widths[Math.floor(widths.length / 2)];
      const leftEdges = rows.map(({ minX }) => minX);
      const rightEdges = rows.map(({ maxX }) => maxX);
      const edgeTolerance = Math.max(4, medianWidth * 0.06);
      const widthTolerance = Math.max(4, medianWidth * 0.1);
      const leftSpread = Math.max(...leftEdges) - Math.min(...leftEdges);
      const rightSpread = Math.max(...rightEdges) - Math.min(...rightEdges);
      const widthSpread = Math.max(...widths) - Math.min(...widths);
      const density = rows.reduce((total, row) => total + row.count, 0)
        / rows.reduce((total, row) => total + row.span, 0);
      const stableEdges = leftSpread <= edgeTolerance && rightSpread <= edgeTolerance;
      const stableWidth = widthSpread <= widthTolerance;
      const furnitureLike = density >= 0.94 && stableEdges && stableWidth;
      rectangularCores.push({
        bounds: {
          minX: Math.min(...leftEdges),
          minY: rows[0].y,
          maxX: Math.max(...rightEdges),
          maxY: rows.at(-1).y,
        },
        density,
        stableEdges,
        stableWidth,
        furnitureLike,
      });
    }
    runStart = runEnd + 1;
  }

  // Geometry rejects obvious baked furniture; contact-sheet visual QA remains the final body-only check.
  return {
    furnitureLike: components.some((component) => component.furnitureLike)
      || rectangularCores.some((core) => core.furnitureLike),
    components,
    rectangularCores,
  };
}

export async function writeValidatedWebPDataUrl(file, dataUrl, { expectedWidth, expectedHeight, page } = {}) {
  const buffer = decodeWebPDataUrl(dataUrl);
  if (!page) throw new Error("A browser page is required to validate encoded WebP dimensions");
  const beforeWrite = await decodeImageDimensions(page, dataUrl);
  if (beforeWrite.width !== expectedWidth || beforeWrite.height !== expectedHeight) {
    throw new Error(
      `${file}: encoded WebP is ${beforeWrite.width}x${beforeWrite.height}, expected ${expectedWidth}x${expectedHeight}`,
    );
  }

  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, buffer);
    const written = await readFile(temporary);
    if (written.length === 0) throw new Error(`${file}: encoded WebP is empty`);
    const writtenDataUrl = `data:image/webp;base64,${written.toString("base64")}`;
    decodeWebPDataUrl(writtenDataUrl);
    const afterWrite = await decodeImageDimensions(page, writtenDataUrl);
    if (afterWrite.width !== expectedWidth || afterWrite.height !== expectedHeight) {
      throw new Error(
        `${file}: written WebP is ${afterWrite.width}x${afterWrite.height}, expected ${expectedWidth}x${expectedHeight}`,
      );
    }
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function inspectCharacterStrip({ page, dataUrl, metadata, label = "character strip" }) {
  return page.evaluate(async ({
    source,
    metadata,
    label,
    alphaThreshold,
    populatedThreshold,
    padding,
    furnitureAnalyzerSource,
  }) => {
    const analyzeFurniture = Function(`return (${furnitureAnalyzerSource})`)();
    const image = new Image();
    image.src = source;
    await image.decode();
    if (image.naturalWidth !== metadata.width || image.naturalHeight !== metadata.height) {
      throw new Error(
        `${label}: dimensions ${image.naturalWidth}x${image.naturalHeight}, expected ${metadata.width}x${metadata.height}`,
      );
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const frames = [];
    const emptyFrames = [];
    const gutterViolations = [];
    const furnitureLikeFrames = [];

    for (let row = 0; row < metadata.rows; row += 1) {
      for (let column = 0; column < metadata.columns; column += 1) {
        const frameIndex = (row * metadata.columns) + column;
        const originX = column * metadata.cellSize;
        const originY = row * metadata.cellSize;
        let useful = 0;
        let transparent = 0;
        let gutterOpaque = 0;
        let minX = metadata.cellSize;
        let minY = metadata.cellSize;
        let maxX = -1;
        let maxY = -1;
        const frameAlpha = new Uint8Array(metadata.cellSize * metadata.cellSize);

        for (let y = 0; y < metadata.cellSize; y += 1) {
          for (let x = 0; x < metadata.cellSize; x += 1) {
            const alpha = pixels[(((originY + y) * canvas.width) + originX + x) * 4 + 3];
            frameAlpha[(y * metadata.cellSize) + x] = alpha;
            if (alpha <= alphaThreshold) transparent += 1;
            if (alpha > alphaThreshold) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
              if (x < padding || y < padding || x >= metadata.cellSize - padding || y >= metadata.cellSize - padding) {
                gutterOpaque += 1;
              }
            }
            if (alpha > populatedThreshold) {
              useful += 1;
            }
          }
        }

        if (useful < 64) emptyFrames.push(frameIndex);
        if (gutterOpaque > 0) gutterViolations.push(frameIndex);
        const furnitureDiagnostic = analyzeFurniture({
          alpha: frameAlpha,
          width: metadata.cellSize,
          height: metadata.cellSize,
          alphaThreshold: populatedThreshold,
        });
        const furnitureLike = furnitureDiagnostic.furnitureLike;
        if (furnitureLike) furnitureLikeFrames.push(frameIndex);

        let footMinX = metadata.cellSize;
        let footMaxX = -1;
        if (maxY >= 0) {
          const footBandStart = Math.max(minY, maxY - Math.max(2, Math.round((maxY - minY + 1) * 0.04)));
          for (let y = footBandStart; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
              const alpha = pixels[(((originY + y) * canvas.width) + originX + x) * 4 + 3];
              if (alpha <= alphaThreshold) continue;
              footMinX = Math.min(footMinX, x);
              footMaxX = Math.max(footMaxX, x);
            }
          }
        }
        frames.push({
          index: frameIndex,
          usefulPixels: useful,
          transparentPixels: transparent,
          gutterOpaque,
          furnitureLike,
          furnitureDiagnostic,
          footAnchor: {
            x: footMaxX >= footMinX ? Math.round((footMinX + footMaxX) / 2) : null,
            y: maxY >= 0 ? maxY : null,
          },
        });
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      frames,
      emptyFrames,
      gutterViolations,
      furnitureLikeFrames,
    };
  }, {
    source: dataUrl,
    metadata,
    label,
    alphaThreshold: ALPHA_THRESHOLD,
    populatedThreshold: POPULATED_ALPHA_THRESHOLD,
    padding: OFFICE_V2_CHARACTER_CONTRACT.normalization.transparentEdgePadding,
    furnitureAnalyzerSource: analyzeFurnitureLikeComponents.toString(),
  });
}

export async function normalizeCharacterMaster({ page, sourceDataUrl, metadata, label = "character master" }) {
  const dimensions = await decodeImageDimensions(page, sourceDataUrl);
  const sourceCells = validateCharacterMasterDimensions({ ...dimensions, metadata });
  const normalization = OFFICE_V2_CHARACTER_CONTRACT.normalization;
  const outputDataUrl = await page.evaluate(async ({
    source,
    metadata,
    sourceCells,
    normalization,
    alphaThreshold,
  }) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const output = document.createElement("canvas");
    output.width = metadata.width;
    output.height = metadata.height;
    const outputContext = output.getContext("2d");

    const sharpen = (frameContext, size) => {
      const imageData = frameContext.getImageData(0, 0, size, size);
      const sourcePixels = new Uint8ClampedArray(imageData.data);
      const target = imageData.data;
      const { amount, threshold } = normalization.sharpening;
      for (let y = 1; y < size - 1; y += 1) {
        for (let x = 1; x < size - 1; x += 1) {
          const index = ((y * size) + x) * 4;
          const alpha = sourcePixels[index + 3];
          if (alpha <= alphaThreshold) continue;
          const totals = [0, 0, 0];
          let weight = 0;
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
              const neighbor = ((((y + offsetY) * size) + x + offsetX) * 4);
              const neighborAlpha = sourcePixels[neighbor + 3];
              if (neighborAlpha <= alphaThreshold || Math.abs(neighborAlpha - alpha) > 48) continue;
              const sampleWeight = offsetX === 0 && offsetY === 0 ? 4 : (offsetX === 0 || offsetY === 0 ? 2 : 1);
              for (let channel = 0; channel < 3; channel += 1) totals[channel] += sourcePixels[neighbor + channel] * sampleWeight;
              weight += sampleWeight;
            }
          }
          if (weight === 0) continue;
          for (let channel = 0; channel < 3; channel += 1) {
            const current = sourcePixels[index + channel];
            const delta = current - (totals[channel] / weight);
            if (Math.abs(delta) >= threshold) {
              target[index + channel] = Math.max(0, Math.min(255, Math.round(current + (delta * amount))));
            }
          }
        }
      }
      frameContext.putImageData(imageData, 0, 0);
    };

    for (let row = 0; row < metadata.rows; row += 1) {
      for (let column = 0; column < metadata.columns; column += 1) {
        const sourceCell = document.createElement("canvas");
        sourceCell.width = sourceCells.sourceCellWidth;
        sourceCell.height = sourceCells.sourceCellHeight;
        const sourceContext = sourceCell.getContext("2d", { willReadFrequently: true });
        sourceContext.drawImage(
          image,
          column * sourceCells.sourceCellWidth,
          row * sourceCells.sourceCellHeight,
          sourceCells.sourceCellWidth,
          sourceCells.sourceCellHeight,
          0,
          0,
          sourceCells.sourceCellWidth,
          sourceCells.sourceCellHeight,
        );
        const sourcePixels = sourceContext.getImageData(0, 0, sourceCell.width, sourceCell.height).data;
        let minX = sourceCell.width;
        let minY = sourceCell.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < sourceCell.height; y += 1) {
          for (let x = 0; x < sourceCell.width; x += 1) {
            if (sourcePixels[((y * sourceCell.width) + x) * 4 + 3] <= alphaThreshold) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
        if (maxX < minX || maxY < minY) throw new Error(`frame ${row * metadata.columns + column} is empty`);
        const subjectWidth = maxX - minX + 1;
        const subjectHeight = maxY - minY + 1;
        const footBandStart = Math.max(minY, maxY - Math.max(2, Math.round(subjectHeight * 0.04)));
        let footMinX = sourceCell.width;
        let footMaxX = -1;
        for (let y = footBandStart; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            if (sourcePixels[((y * sourceCell.width) + x) * 4 + 3] <= alphaThreshold) continue;
            footMinX = Math.min(footMinX, x);
            footMaxX = Math.max(footMaxX, x);
          }
        }
        const footCenter = footMaxX >= footMinX ? (footMinX + footMaxX) / 2 : (minX + maxX) / 2;
        const leftExtent = Math.max(1, footCenter - minX);
        const rightExtent = Math.max(1, (maxX + 1) - footCenter);
        const { cellSize, feetAnchor, transparentEdgePadding } = normalization;
        const scale = Math.min(
          (feetAnchor.x - transparentEdgePadding) / leftExtent,
          ((cellSize - transparentEdgePadding) - feetAnchor.x) / rightExtent,
          ((feetAnchor.y + 1) - transparentEdgePadding) / subjectHeight,
        );
        const frame = document.createElement("canvas");
        frame.width = cellSize;
        frame.height = cellSize;
        const frameContext = frame.getContext("2d");
        frameContext.imageSmoothingEnabled = true;
        frameContext.imageSmoothingQuality = "high";
        const drawWidth = subjectWidth * scale;
        const drawHeight = subjectHeight * scale;
        const drawX = feetAnchor.x - ((footCenter - minX) * scale);
        const drawY = (feetAnchor.y + 1) - drawHeight;
        frameContext.drawImage(sourceCell, minX, minY, subjectWidth, subjectHeight, drawX, drawY, drawWidth, drawHeight);
        sharpen(frameContext, cellSize);
        outputContext.drawImage(frame, column * cellSize, row * cellSize);
      }
    }
    return output.toDataURL("image/webp", normalization.output.quality / 100);
  }, {
    source: sourceDataUrl,
    metadata,
    sourceCells,
    normalization,
    alphaThreshold: ALPHA_THRESHOLD,
  });

  decodeWebPDataUrl(outputDataUrl);
  const inspection = await inspectCharacterStrip({ page, dataUrl: outputDataUrl, metadata, label });
  if (inspection.emptyFrames.length > 0) throw new Error(`${label}: empty frames ${inspection.emptyFrames.join(", ")}`);
  if (inspection.gutterViolations.length > 0) {
    throw new Error(`${label}: frames violate 24px transparent gutter: ${inspection.gutterViolations.join(", ")}`);
  }
  if (inspection.furnitureLikeFrames.length > 0) {
    throw new Error(`${label}: furniture-like rectangular mass in frames ${inspection.furnitureLikeFrames.join(", ")}`);
  }
  const misaligned = inspection.frames.filter(({ footAnchor }) => (
    footAnchor.x !== normalization.feetAnchor.x || footAnchor.y !== normalization.feetAnchor.y
  ));
  if (misaligned.length > 0) throw new Error(`${label}: encoded feet do not share the required anchor`);
  return outputDataUrl;
}

async function safeReadDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function collectCharacterCohortInventory(characterRoot, cohort) {
  const characterIds = getCharacterIdsForCohort(cohort);
  const rootEntries = await safeReadDirectory(characterRoot);
  const presentIds = rootEntries
    .filter((entry) => entry.isDirectory() && characterIds.includes(entry.name))
    .map((entry) => entry.name);
  const unexpected = rootEntries
    .filter((entry) => entry.name.startsWith(`${cohort}-`) && !characterIds.includes(entry.name))
    .map((entry) => entry.name);
  const missing = [];

  for (const characterId of characterIds) {
    const directory = path.join(characterRoot, characterId);
    if (!presentIds.includes(characterId)) {
      missing.push(`${characterId}/`);
      missing.push(...OFFICE_CLIP_IDS.map((clipId) => `${characterId}/${clipId}.webp`));
      continue;
    }
    const entries = await safeReadDirectory(directory);
    const expectedFiles = new Set(OFFICE_CLIP_IDS.map((clipId) => `${clipId}.webp`));
    for (const file of expectedFiles) {
      if (!entries.some((entry) => entry.isFile() && entry.name === file)) missing.push(`${characterId}/${file}`);
    }
    for (const entry of entries) {
      if (!entry.isFile() || !expectedFiles.has(entry.name)) unexpected.push(`${characterId}/${entry.name}`);
    }
  }

  const state = presentIds.length === 0 && unexpected.length === 0
    ? "absent"
    : (missing.length === 0 && unexpected.length === 0 ? "complete" : "partial");
  return { state, cohort, characterIds, presentIds, missing, unexpected };
}

async function collectCharacterSourceInventory(sourceRoot, cohort) {
  const characterIds = getCharacterIdsForCohort(cohort);
  const sources = [];
  const missing = [];
  const duplicates = [];
  for (const characterId of characterIds) {
    for (const clipId of OFFICE_CLIP_IDS) {
      const candidates = ["png", "webp"].map((extension) => path.join(sourceRoot, characterId, `${clipId}.${extension}`));
      const found = candidates.filter((candidate) => existsSync(candidate));
      if (found.length === 0) missing.push(path.relative(sourceRoot, candidates[0]).replace(/\.png$/, ".(png|webp)"));
      else if (found.length > 1) duplicates.push(...found.map((candidate) => path.relative(sourceRoot, candidate)));
      else sources.push({ characterId, clipId, source: found[0], metadata: OFFICE_CLIP_METADATA[clipId] });
    }
  }
  return { characterIds, sources, missing, duplicates };
}

const DEFAULT_INSTALL_FILE_SYSTEM = Object.freeze({ existsSync, mkdir, rename, rm });

function describeErrors(errors) {
  return errors.map((error) => error?.message || String(error)).join("; ");
}

export async function installCharacterCohort({
  outputRoot,
  stageRoot,
  backupRoot,
  characterIds,
  fileSystem: overrides = {},
}) {
  const fileSystem = { ...DEFAULT_INSTALL_FILE_SYSTEM, ...overrides };
  await fileSystem.mkdir(outputRoot, { recursive: true });
  await fileSystem.mkdir(backupRoot, { recursive: true });
  const backedUp = [];
  const installed = [];
  try {
    for (const characterId of characterIds) {
      const destination = path.join(outputRoot, characterId);
      if (!fileSystem.existsSync(destination)) continue;
      await fileSystem.rename(destination, path.join(backupRoot, characterId));
      backedUp.push(characterId);
    }
    for (const characterId of characterIds) {
      await fileSystem.rename(path.join(stageRoot, characterId), path.join(outputRoot, characterId));
      installed.push(characterId);
    }
  } catch (installationError) {
    const rollbackErrors = [installationError];
    for (const characterId of [...installed].reverse()) {
      try {
        await fileSystem.rm(path.join(outputRoot, characterId), { recursive: true, force: true });
      } catch (error) {
        rollbackErrors.push(new Error(`Could not remove installed ${characterId}: ${error.message}`, { cause: error }));
      }
    }
    for (const characterId of [...backedUp].reverse()) {
      try {
        await fileSystem.rename(path.join(backupRoot, characterId), path.join(outputRoot, characterId));
      } catch (error) {
        rollbackErrors.push(new Error(`Could not restore original ${characterId}: ${error.message}`, { cause: error }));
      }
    }

    const unrestored = backedUp.filter((characterId) => (
      fileSystem.existsSync(path.join(backupRoot, characterId))
      || !fileSystem.existsSync(path.join(outputRoot, characterId))
    ));
    if (unrestored.length > 0) {
      rollbackErrors.push(new Error(`Unrestored original character directories: ${unrestored.join(", ")}`));
      throw new AggregateError(
        rollbackErrors,
        `Character cohort installation rollback failed; backup retained at ${backupRoot}: ${describeErrors(rollbackErrors)}`,
      );
    }

    try {
      await fileSystem.rm(backupRoot, { recursive: true, force: true });
    } catch (error) {
      rollbackErrors.push(new Error(`Could not clean restored backup root: ${error.message}`, { cause: error }));
      throw new AggregateError(
        rollbackErrors,
        `Character cohort installation rollback cleanup failed; backup retained at ${backupRoot}: ${describeErrors(rollbackErrors)}`,
      );
    }
    throw new AggregateError(
      rollbackErrors,
      `Character cohort installation failed: ${describeErrors(rollbackErrors)}; rollback restored all originals`,
    );
  }

  try {
    await fileSystem.rm(backupRoot, { recursive: true, force: true });
  } catch (error) {
    throw new AggregateError(
      [error],
      `Character cohort installation committed, but backup cleanup failed; backup retained at ${backupRoot}: ${error.message}`,
    );
  }
}

export async function normalizeCharacterCohort({
  sourceRoot,
  outputRoot,
  cohort,
  browserFactory = () => chromium.launch({ headless: true }),
}) {
  const inventory = await collectCharacterSourceInventory(sourceRoot, cohort);
  if (inventory.missing.length > 0) {
    throw new Error(
      `Missing ${inventory.missing.length} character source masters under ${sourceRoot}:\n${inventory.missing.join("\n")}`,
    );
  }
  if (inventory.duplicates.length > 0) {
    throw new Error(`Provide exactly one PNG or WebP source per clip:\n${inventory.duplicates.join("\n")}`);
  }

  const token = `${cohort}-${process.pid}-${Date.now()}`;
  const stageRoot = path.join(path.dirname(outputRoot), `.office-v2-character-stage-${token}`);
  const backupRoot = path.join(path.dirname(outputRoot), `.office-v2-character-backup-${token}`);
  await mkdir(stageRoot, { recursive: true });
  let browser;
  try {
    browser = await browserFactory();
    const page = await browser.newPage();
    for (const item of inventory.sources) {
      const extension = path.extname(item.source).toLowerCase();
      const mime = extension === ".webp" ? "image/webp" : "image/png";
      const sourceDataUrl = `data:${mime};base64,${(await readFile(item.source)).toString("base64")}`;
      const label = `${item.characterId}/${item.clipId}`;
      const outputDataUrl = await normalizeCharacterMaster({
        page,
        sourceDataUrl,
        metadata: item.metadata,
        label,
      });
      await writeValidatedWebPDataUrl(
        path.join(stageRoot, item.characterId, `${item.clipId}.webp`),
        outputDataUrl,
        { expectedWidth: item.metadata.width, expectedHeight: item.metadata.height, page },
      );
    }

    for (const characterId of inventory.characterIds) {
      const hashes = new Map();
      for (const clipId of OFFICE_CLIP_IDS) {
        const file = path.join(stageRoot, characterId, `${clipId}.webp`);
        const hash = createHash("sha256").update(await readFile(file)).digest("hex");
        if (hashes.has(hash)) throw new Error(`${characterId}: duplicate strips ${hashes.get(hash)} and ${clipId}`);
        hashes.set(hash, clipId);
      }
    }
    await installCharacterCohort({
      outputRoot,
      stageRoot,
      backupRoot,
      characterIds: inventory.characterIds,
    });
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await rm(stageRoot, { recursive: true, force: true });
    }
  }
  return { cohort, characters: inventory.characterIds.length, clipsPerCharacter: OFFICE_CLIP_IDS.length };
}
