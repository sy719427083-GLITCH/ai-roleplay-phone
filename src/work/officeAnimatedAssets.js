import { strFromU8, unzipSync } from "fflate";

export const MAX_CUSTOM_ANIMATION_BYTES = 2 * 1024 * 1024;
export const MAX_CUSTOM_ANIMATION_ARCHIVE_BYTES = 8 * 1024 * 1024;
export const MAX_CUSTOM_ANIMATION_UNCOMPRESSED_BYTES = 12 * 1024 * 1024;
export const MAX_CUSTOM_ANIMATION_ENTRY_BYTES = 6 * 1024 * 1024;
export const MIN_CUSTOM_ANIMATION_FRAME_SIZE = 384;

const DIRECTIONS = Object.freeze(["front", "back", "left", "right"]);
const MAX_CLIP_FRAMES = 120;
const MAX_NAMED_ACTIONS = 32;
const MAX_DECODED_PIXELS = 64 * 1024 * 1024;
const FINGERPRINT_GRID_SIZE = 8;
const LOCAL_MOTION_GRID_SIZE = 48;
const MIN_OPAQUE_FRAME_COVERAGE = 0.02;
const MIN_TRANSPARENT_CLIP_COVERAGE = 0.05;
const MIN_SIGNIFICANT_FRAME_DISTANCE = 0.01;
const MIN_LOCAL_MOTION_COVERAGE = 0.0001;
const STILL_IMAGE_SOURCE = /(?:^data:image\/|\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$)/iu;
const EMBEDDED_IMAGE_SOURCE = /^data:image\/(?:png|webp);base64,[a-z0-9+/=]+$/iu;
const ZIP_TYPES = new Set(["application/zip", "application/x-zip-compressed"]);
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const failure = (reason) => ({ ok: false, reason, manifest: null });
const success = (manifest) => ({ ok: true, reason: "", manifest });

const byteLength = (value) => {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(value).byteLength;
  return value.length;
};

const toBytes = (value) => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
};

const resolveClipUrl = (source, baseUrl, allowDataUrls) => {
  const value = cleanText(source);
  if (!value) return "";
  if (allowDataUrls && EMBEDDED_IMAGE_SOURCE.test(value)) return value;
  if (value.startsWith("data:")) return "";
  try {
    const resolved = baseUrl ? new URL(value, baseUrl) : new URL(value);
    return ["http:", "https:"].includes(resolved.protocol) ? resolved.href : "";
  } catch {
    return "";
  }
};

const normalizeStrip = (value, {
  allowDataUrls = false,
  baseUrl,
  minimumFrames = 4,
  legalFacings = DIRECTIONS,
} = {}) => {
  if (!isRecord(value) || value.alpha !== true) return { reason: "invalid-clip-manifest" };
  const frameWidth = Number(value.frameWidth ?? value.cellSize);
  const frameHeight = Number(value.frameHeight ?? value.cellSize);
  const frameCount = Number(value.frameCount);
  const columns = Number(value.columns);
  const rows = Number(value.rows ?? 1);
  const fps = Number(value.fps);
  const src = resolveClipUrl(value.src, baseUrl, allowDataUrls);
  if (!Number.isFinite(frameWidth) || !Number.isFinite(frameHeight)
    || frameWidth < MIN_CUSTOM_ANIMATION_FRAME_SIZE || frameHeight < MIN_CUSTOM_ANIMATION_FRAME_SIZE) {
    return { reason: "low-resolution" };
  }
  if (!src || frameWidth !== frameHeight || !Number.isInteger(frameCount) || frameCount < minimumFrames
    || frameCount > MAX_CLIP_FRAMES
    || !Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1
    || columns * rows < frameCount || !Number.isFinite(fps) || fps <= 0 || fps > 30) {
    return { reason: "invalid-clip-manifest" };
  }
  const declaredWidth = Number(value.width ?? frameWidth * columns);
  const declaredHeight = Number(value.height ?? frameHeight * rows);
  if (!Number.isFinite(declaredWidth) || !Number.isFinite(declaredHeight)
    || declaredWidth !== frameWidth * columns || declaredHeight !== frameHeight * rows) {
    return { reason: "invalid-clip-manifest" };
  }
  return {
    reason: "",
    strip: Object.freeze({
      src,
      alpha: true,
      family: minimumFrames >= 8 ? "locomotion" : "action",
      bodyOnly: true,
      lazy: minimumFrames < 8,
      width: declaredWidth,
      height: declaredHeight,
      cellSize: frameWidth,
      columns,
      rows,
      frameCount,
      fps,
      loop: value.loop !== false,
      legalFacings: Object.freeze([...legalFacings]),
    }),
  };
};

function validateOfficeAnimationBundleUnsafe(value, {
  allowDataUrls = value?.embedded === true,
  baseUrl = "",
  byteLength: declaredByteLength = 0,
  embedded = value?.embedded === true,
  maxBytes = MAX_CUSTOM_ANIMATION_BYTES,
} = {}) {
  if (Number(declaredByteLength) > maxBytes) return failure("oversized");
  if (typeof value === "string") {
    if (STILL_IMAGE_SOURCE.test(cleanText(value))) return failure("still-image");
    return failure("invalid-clip-manifest");
  }
  if (!isRecord(value) || value.version !== 1 || value.alpha !== true || !isRecord(value.clips)) {
    return failure("invalid-clip-manifest");
  }
  if (!isRecord(value.clips.locomotion) || !value.clips.idle || !value.clips.action) {
    return failure("invalid-clip-manifest");
  }

  const normalizeOptions = { allowDataUrls, baseUrl };
  const locomotion = {};
  for (const direction of DIRECTIONS) {
    const normalized = normalizeStrip(value.clips.locomotion[direction], {
      ...normalizeOptions,
      minimumFrames: 8,
      legalFacings: [direction],
    });
    if (normalized.reason) return failure(normalized.reason);
    locomotion[direction] = normalized.strip;
  }
  const idle = normalizeStrip(value.clips.idle, normalizeOptions);
  if (idle.reason) return failure(idle.reason);
  const action = normalizeStrip(value.clips.action, normalizeOptions);
  if (action.reason) return failure(action.reason);

  const actions = {};
  if (value.clips.actions !== undefined) {
    if (!isRecord(value.clips.actions)) return failure("invalid-clip-manifest");
    const actionEntries = Object.entries(value.clips.actions);
    if (actionEntries.length > MAX_NAMED_ACTIONS) return failure("invalid-clip-manifest");
    for (const [clipId, strip] of actionEntries) {
      if (!cleanText(clipId) || ["__proto__", "constructor", "prototype"].includes(clipId)) {
        return failure("invalid-clip-manifest");
      }
      const normalized = normalizeStrip(strip, normalizeOptions);
      if (normalized.reason) return failure(normalized.reason);
      actions[clipId] = normalized.strip;
    }
  }

  return success(Object.freeze({
    version: 1,
    alpha: true,
    ...(embedded ? { embedded: true } : {}),
    clips: Object.freeze({
      locomotion: Object.freeze(locomotion),
      idle: idle.strip,
      action: action.strip,
      actions: Object.freeze(actions),
    }),
  }));
}

export function validateOfficeAnimationBundle(value, options = {}) {
  try {
    return validateOfficeAnimationBundleUnsafe(value, options);
  } catch {
    return failure("invalid-clip-manifest");
  }
}

const isZipFile = (file) => {
  const name = cleanText(file?.name).toLowerCase();
  const type = cleanText(file?.type).toLowerCase();
  return name.endsWith(".zip") || ZIP_TYPES.has(type);
};

export function validateOfficeAnimationFile(file) {
  try {
    if (!file || typeof file !== "object") return failure("invalid-clip-manifest");
    if (cleanText(file.type).toLowerCase().startsWith("image/")) return failure("still-image");
    const name = cleanText(file.name).toLowerCase();
    const type = cleanText(file.type).toLowerCase();
    const zip = isZipFile(file);
    const maxBytes = zip ? MAX_CUSTOM_ANIMATION_ARCHIVE_BYTES : MAX_CUSTOM_ANIMATION_BYTES;
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > maxBytes) return failure("oversized");
    if (zip) return success(null);
    if (type !== "application/json" && !name.endsWith(".json")) return failure("invalid-clip-manifest");
    return success(null);
  } catch {
    return failure("invalid-clip-manifest");
  }
}

export function parseOfficeAnimationManifestText(text, options = {}) {
  try {
    if (typeof text !== "string") return failure("invalid-clip-manifest");
    const measuredBytes = byteLength(text);
    if (measuredBytes > (options.maxBytes || MAX_CUSTOM_ANIMATION_BYTES)) return failure("oversized");
    return validateOfficeAnimationBundle(JSON.parse(text), { ...options, byteLength: measuredBytes });
  } catch {
    return failure("invalid-clip-manifest");
  }
}

export async function readBoundedResponseBytes(response, maxBytes = MAX_CUSTOM_ANIMATION_BYTES) {
  try {
    const contentLengthValue = cleanText(response?.headers?.get?.("content-length"));
    if (contentLengthValue) {
      const contentLength = Number(contentLengthValue);
      if (!Number.isFinite(contentLength) || contentLength < 0) return failure("invalid-clip-manifest");
      if (contentLength > maxBytes) return failure("oversized");
    }
    const reader = response?.body?.getReader?.();
    if (!reader) {
      const bytes = toBytes(await response.arrayBuffer());
      if (!bytes) return failure("invalid-clip-manifest");
      if (bytes.byteLength > maxBytes) return failure("oversized");
      return { ok: true, reason: "", manifest: null, bytes };
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = toBytes(value);
      if (!chunk) {
        await reader.cancel?.();
        return failure("invalid-clip-manifest");
      }
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel?.();
        return failure("oversized");
      }
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, reason: "", manifest: null, bytes };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return failure("invalid-clip-manifest");
  }
}

const createInspectionCanvas = (width, height) => {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  if (globalThis.document?.createElement) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
};

const isCoverage = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

export function analyzeOfficeAnimationPixels(pixels, strip) {
  const width = Number(strip?.width);
  const height = Number(strip?.height);
  const cellSize = Number(strip?.cellSize);
  const columns = Number(strip?.columns);
  const frameCount = Number(strip?.frameCount);
  if (!(pixels instanceof Uint8ClampedArray) || pixels.length !== width * height * 4
    || !Number.isInteger(cellSize) || cellSize < 1 || !Number.isInteger(columns) || columns < 1
    || !Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error("Invalid animation pixel geometry");
  }

  const frames = [];
  let clipTransparentPixels = 0;
  let clipPixels = 0;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameX = (frameIndex % columns) * cellSize;
    const frameY = Math.floor(frameIndex / columns) * cellSize;
    const blockCount = FINGERPRINT_GRID_SIZE * FINGERPRINT_GRID_SIZE;
    const alphaSums = new Float64Array(blockCount);
    const lumaSums = new Float64Array(blockCount);
    const sampleCounts = new Uint32Array(blockCount);
    const localBlockCount = LOCAL_MOTION_GRID_SIZE * LOCAL_MOTION_GRID_SIZE;
    const localAlphaSums = new Float64Array(localBlockCount);
    const localSampleCounts = new Uint32Array(localBlockCount);
    let opaquePixels = 0;
    let transparentPixels = 0;
    const framePixels = cellSize * cellSize;

    for (let localY = 0; localY < cellSize; localY += 1) {
      const y = frameY + localY;
      for (let localX = 0; localX < cellSize; localX += 1) {
        const x = frameX + localX;
        const pixel = ((y * width) + x) * 4;
        const red = pixels[pixel];
        const green = pixels[pixel + 1];
        const blue = pixels[pixel + 2];
        const alpha = pixels[pixel + 3];
        if (alpha >= 224) opaquePixels += 1;
        if (alpha <= 16) transparentPixels += 1;
        const blockX = Math.min(FINGERPRINT_GRID_SIZE - 1, Math.floor((localX * FINGERPRINT_GRID_SIZE) / cellSize));
        const blockY = Math.min(FINGERPRINT_GRID_SIZE - 1, Math.floor((localY * FINGERPRINT_GRID_SIZE) / cellSize));
        const block = (blockY * FINGERPRINT_GRID_SIZE) + blockX;
        const luma = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
        alphaSums[block] += alpha;
        lumaSums[block] += (luma * alpha) / 255;
        sampleCounts[block] += 1;
        const localBlockX = Math.min(
          LOCAL_MOTION_GRID_SIZE - 1,
          Math.floor((localX * LOCAL_MOTION_GRID_SIZE) / cellSize),
        );
        const localBlockY = Math.min(
          LOCAL_MOTION_GRID_SIZE - 1,
          Math.floor((localY * LOCAL_MOTION_GRID_SIZE) / cellSize),
        );
        const localBlock = (localBlockY * LOCAL_MOTION_GRID_SIZE) + localBlockX;
        localAlphaSums[localBlock] += alpha;
        localSampleCounts[localBlock] += 1;
      }
    }

    const fingerprint = [];
    for (let block = 0; block < blockCount; block += 1) {
      const samples = sampleCounts[block] || 1;
      fingerprint.push(Math.round(alphaSums[block] / samples));
      fingerprint.push(Math.round(lumaSums[block] / samples));
    }
    const localMotionFingerprint = new Uint8Array(localBlockCount);
    for (let block = 0; block < localBlockCount; block += 1) {
      const samples = localSampleCounts[block] || 1;
      localMotionFingerprint[block] = Math.round(localAlphaSums[block] / samples);
    }
    frames.push({
      opaqueCoverage: opaquePixels / framePixels,
      transparentCoverage: transparentPixels / framePixels,
      fingerprint,
      localMotionFingerprint,
    });
    clipTransparentPixels += transparentPixels;
    clipPixels += framePixels;
  }

  return {
    width,
    height,
    transparentCoverage: clipPixels ? clipTransparentPixels / clipPixels : 0,
    frames,
  };
}

export async function inspectOfficeAnimationImage(source, {
  fetchImpl = globalThis.fetch,
  signal,
  strip,
} = {}) {
  if (typeof fetchImpl !== "function" || typeof globalThis.createImageBitmap !== "function" || !strip) {
    throw new Error("Animation image inspection is unavailable");
  }
  const response = await fetchImpl(source, { method: "GET", signal });
  if (!response?.ok) throw new Error("Animation image request failed");
  const contentType = cleanText(response.headers?.get?.("content-type")).toLowerCase();
  if (contentType && !contentType.startsWith("image/")) throw new Error("Animation clip is not an image");
  const loaded = await readBoundedResponseBytes(response, MAX_CUSTOM_ANIMATION_ENTRY_BYTES);
  if (!loaded.ok) throw Object.assign(new Error(loaded.reason), { reason: loaded.reason });
  const bitmap = await createImageBitmap(new Blob([loaded.bytes], { type: contentType || "image/webp" }));
  try {
    if (bitmap.width * bitmap.height > MAX_DECODED_PIXELS) {
      throw Object.assign(new Error("Decoded animation is too large"), { reason: "oversized" });
    }
    if (bitmap.width !== strip.width || bitmap.height !== strip.height) {
      return {
        width: bitmap.width,
        height: bitmap.height,
        transparentCoverage: 0,
        frames: [],
      };
    }
    const canvas = createInspectionCanvas(bitmap.width, bitmap.height);
    const context = canvas?.getContext?.("2d", { willReadFrequently: true });
    if (!context) throw new Error("Animation pixel inspection is unavailable");
    context.clearRect(0, 0, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    return analyzeOfficeAnimationPixels(pixels, strip);
  } finally {
    bitmap.close?.();
  }
}

const requiredStrips = (manifest) => [
  ...DIRECTIONS.map((direction) => manifest.clips.locomotion[direction]),
  manifest.clips.idle,
  manifest.clips.action,
  ...Object.values(manifest.clips.actions || {}),
];

const isFingerprint = (value, length) => (
  (Array.isArray(value) || ArrayBuffer.isView(value))
  && value.length === length
  && Array.from(value).every((sample) => Number.isFinite(sample) && sample >= 0 && sample <= 255)
);

const fingerprintDistance = (left, right) => {
  if (!left || !right || left.length !== right.length || !left.length) return 0;
  return left.reduce((total, value, index) => total + Math.abs(value - right[index]), 0)
    / (left.length * 255);
};

const hasMeaningfulFrameDifference = (left, right) => (
  fingerprintDistance(left.fingerprint, right.fingerprint) >= MIN_SIGNIFICANT_FRAME_DISTANCE
  || fingerprintDistance(left.localMotionFingerprint, right.localMotionFingerprint)
    >= MIN_LOCAL_MOTION_COVERAGE
);

const countDistinctFrames = (frames) => {
  const representatives = [];
  for (const frame of frames) {
    if (representatives.every((candidate) => (
      hasMeaningfulFrameDifference(frame, candidate)
    ))) representatives.push(frame);
  }
  return representatives.length;
};

const validateInspection = (inspection, strip) => {
  if (!isRecord(inspection)) return "invalid-clip-manifest";
  const width = Number(inspection.width);
  const height = Number(inspection.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "invalid-clip-manifest";
  if ((width / strip.columns) < MIN_CUSTOM_ANIMATION_FRAME_SIZE
    || (height / strip.rows) < MIN_CUSTOM_ANIMATION_FRAME_SIZE) return "low-resolution";
  if (width !== strip.width || height !== strip.height
    || !isCoverage(inspection.transparentCoverage)
    || inspection.transparentCoverage < MIN_TRANSPARENT_CLIP_COVERAGE) {
    return "invalid-clip-manifest";
  }
  if (!Array.isArray(inspection.frames) || inspection.frames.length !== strip.frameCount) {
    return "invalid-clip-manifest";
  }
  const frames = inspection.frames;
  for (const frame of frames) {
    if (!isRecord(frame) || !isCoverage(frame.opaqueCoverage) || !isCoverage(frame.transparentCoverage)
      || frame.opaqueCoverage < MIN_OPAQUE_FRAME_COVERAGE
      || !isFingerprint(frame.fingerprint, 128)
      || !isFingerprint(frame.localMotionFingerprint, LOCAL_MOTION_GRID_SIZE ** 2)) {
      return "invalid-clip-manifest";
    }
  }
  const minimumDistinctFrames = strip.family === "locomotion" ? 4 : 2;
  if (countDistinctFrames(frames) < minimumDistinctFrames) return "invalid-clip-manifest";
  return "";
};

export const getOfficeAnimationInspectionKey = (strip) => JSON.stringify([
  strip.src,
  strip.cellSize,
  strip.width,
  strip.height,
  strip.columns,
  strip.rows,
  strip.frameCount,
]);

export async function inspectOfficeAnimationManifest(value, {
  allowDataUrls = false,
  baseUrl = "",
  embedded = false,
  fetchImpl = globalThis.fetch,
  inspectImage = inspectOfficeAnimationImage,
  signal,
} = {}) {
  const normalized = validateOfficeAnimationBundle(value, { allowDataUrls, baseUrl, embedded });
  if (!normalized.ok) return normalized;
  if (typeof inspectImage !== "function") return failure("invalid-clip-manifest");
  const inspections = new Map();
  try {
    for (const strip of requiredStrips(normalized.manifest)) {
      signal?.throwIfAborted?.();
      const inspectionKey = getOfficeAnimationInspectionKey(strip);
      let inspection = inspections.get(inspectionKey);
      if (!inspection) {
        inspection = await inspectImage(strip.src, { fetchImpl, signal, strip });
        inspections.set(inspectionKey, inspection);
      }
      const reason = validateInspection(inspection, strip);
      if (reason) return failure(reason);
    }
    return normalized;
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (error?.reason === "oversized") return failure("oversized");
    return failure("invalid-clip-manifest");
  }
}

const normalizeArchivePath = (value) => {
  const path = cleanText(value);
  if (!path || path.includes("\\") || path.includes("\0") || path.startsWith("/") || /^[a-z]:/iu.test(path)) return "";
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return "";
  return parts.join("/");
};

const archiveMimeType = (path) => {
  if (/\.png$/iu.test(path)) return "image/png";
  if (/\.webp$/iu.test(path)) return "image/webp";
  return "";
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  if (typeof btoa !== "function") throw new Error("Base64 encoding is unavailable");
  return btoa(binary);
};

const getRawStrips = (manifest) => {
  if (!isRecord(manifest?.clips?.locomotion)) return [];
  return [
    ...DIRECTIONS.map((direction) => manifest.clips.locomotion[direction]),
    manifest.clips.idle,
    manifest.clips.action,
    ...Object.values(isRecord(manifest.clips.actions) ? manifest.clips.actions : {}),
  ];
};

const embedArchiveSources = (manifest, manifestPath, entries) => {
  const rawStrips = getRawStrips(manifest);
  if (rawStrips.length < 6 || rawStrips.some((strip) => !isRecord(strip))) return failure("invalid-clip-manifest");
  const manifestDirectory = manifestPath.includes("/") ? manifestPath.slice(0, manifestPath.lastIndexOf("/")) : "";
  const resolvedSources = new Map();
  for (const strip of rawStrips) {
    const source = cleanText(strip.src);
    if (!source || /^[a-z][a-z0-9+.-]*:/iu.test(source) || source.includes("?") || source.includes("#")) {
      return failure("invalid-clip-manifest");
    }
    const normalizedSource = normalizeArchivePath(source);
    if (!normalizedSource) return failure("invalid-clip-manifest");
    const path = normalizeArchivePath(manifestDirectory ? `${manifestDirectory}/${normalizedSource}` : normalizedSource);
    const bytes = entries[path];
    const mimeType = archiveMimeType(path);
    if (!path || !bytes || !mimeType) return failure("invalid-clip-manifest");
    if (!resolvedSources.has(source)) {
      resolvedSources.set(source, `data:${mimeType};base64,${bytesToBase64(bytes)}`);
    }
    strip.src = resolvedSources.get(source);
  }
  manifest.embedded = true;
  return success(manifest);
};

const extractAnimationArchive = (bytes, {
  maxUncompressedBytes = MAX_CUSTOM_ANIMATION_UNCOMPRESSED_BYTES,
} = {}) => {
  let rejectionReason = "";
  let totalUncompressed = 0;
  const names = new Set();
  let entries;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        const directory = file.name.endsWith("/");
        const path = normalizeArchivePath(directory ? file.name.slice(0, -1) : file.name);
        const canonicalPath = `${path.toLowerCase()}${directory ? "/" : ""}`;
        if (!path || names.has(canonicalPath) || ![0, 8].includes(file.compression)) {
          rejectionReason ||= "invalid-clip-manifest";
          return false;
        }
        names.add(canonicalPath);
        if (!Number.isFinite(file.size) || !Number.isFinite(file.originalSize)
          || file.size < 0 || file.originalSize < 0) {
          rejectionReason ||= "invalid-clip-manifest";
          return false;
        }
        totalUncompressed += file.originalSize;
        if (file.size > MAX_CUSTOM_ANIMATION_ENTRY_BYTES
          || file.originalSize > MAX_CUSTOM_ANIMATION_ENTRY_BYTES
          || totalUncompressed > maxUncompressedBytes) {
          rejectionReason = "oversized";
          return false;
        }
        return !rejectionReason && !directory;
      },
    });
  } catch {
    return failure(rejectionReason || "invalid-clip-manifest");
  }
  if (rejectionReason) return failure(rejectionReason);
  const normalizedEntries = Object.fromEntries(Object.entries(entries).map(([path, value]) => [normalizeArchivePath(path), value]));
  const manifests = Object.keys(normalizedEntries).filter((path) => /(?:^|\/)manifest\.json$/iu.test(path));
  if (manifests.length !== 1) return failure("invalid-clip-manifest");
  const manifestBytes = normalizedEntries[manifests[0]];
  if (!manifestBytes || manifestBytes.byteLength > MAX_CUSTOM_ANIMATION_BYTES) return failure("oversized");
  let manifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    return failure("invalid-clip-manifest");
  }
  return embedArchiveSources(manifest, manifests[0], normalizedEntries);
};

export async function parseOfficeAnimationUpload(file, {
  inspectImage = inspectOfficeAnimationImage,
  maxUncompressedBytes = MAX_CUSTOM_ANIMATION_UNCOMPRESSED_BYTES,
  signal,
} = {}) {
  signal?.throwIfAborted?.();
  const fileValidation = validateOfficeAnimationFile(file);
  if (!fileValidation.ok) return fileValidation;
  const bytes = toBytes(file.bytes);
  if (!bytes || bytes.byteLength !== file.size) return failure("invalid-clip-manifest");
  if (isZipFile(file)) {
    if (bytes.byteLength > MAX_CUSTOM_ANIMATION_ARCHIVE_BYTES) return failure("oversized");
    const extracted = extractAnimationArchive(bytes, { maxUncompressedBytes });
    if (!extracted.ok) return extracted;
    signal?.throwIfAborted?.();
    return inspectOfficeAnimationManifest(extracted.manifest, {
      allowDataUrls: true,
      embedded: true,
      inspectImage,
      signal,
    });
  }
  if (bytes.byteLength > MAX_CUSTOM_ANIMATION_BYTES) return failure("oversized");
  let manifest;
  try {
    manifest = JSON.parse(strFromU8(bytes));
  } catch {
    return failure("invalid-clip-manifest");
  }
  return inspectOfficeAnimationManifest(manifest, { inspectImage, signal });
}

export async function fetchOfficeAnimationManifest(source, {
  fetchImpl = globalThis.fetch,
  inspectImage = inspectOfficeAnimationImage,
  signal,
  maxBytes = MAX_CUSTOM_ANIMATION_BYTES,
} = {}) {
  const url = cleanText(source);
  if (STILL_IMAGE_SOURCE.test(url)) return failure("still-image");
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return failure("invalid-clip-manifest");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || typeof fetchImpl !== "function") {
    return failure("invalid-clip-manifest");
  }
  try {
    const response = await fetchImpl(parsedUrl.href, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response?.ok) return failure("invalid-clip-manifest");
    const contentType = cleanText(response.headers?.get?.("content-type")).toLowerCase();
    if (contentType.startsWith("image/")) return failure("still-image");
    const loaded = await readBoundedResponseBytes(response, maxBytes);
    if (!loaded.ok) return loaded;
    let manifest;
    try {
      manifest = JSON.parse(strFromU8(loaded.bytes));
    } catch {
      return failure("invalid-clip-manifest");
    }
    const responseUrl = cleanText(response.url) || parsedUrl.href;
    return inspectOfficeAnimationManifest(manifest, {
      baseUrl: responseUrl,
      fetchImpl,
      inspectImage,
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return failure("invalid-clip-manifest");
  }
}

export function getCustomOfficeClipSource(manifest, clipId, facing = "front") {
  try {
    if (!isRecord(manifest?.clips)) return null;
    if (clipId === "locomotion") {
      return manifest.clips.locomotion?.[facing]
        || manifest.clips.locomotion?.front
        || null;
    }
    if (clipId === "idle-standing" || clipId === "idle-seated") return manifest.clips.idle || null;
    return manifest.clips.actions?.[clipId] || manifest.clips.action || null;
  } catch {
    return null;
  }
}

export const OFFICE_ANIMATION_REASON_MESSAGES = Object.freeze({
  "still-image": "不支持静态图片，请提供 JSON 动画清单或 ZIP 动画包",
  "low-resolution": "动画每帧至少需要 384×384 像素",
  "invalid-clip-manifest": "动画清单或资源不完整，请检查四向走路、透明像素与待机/动作片段",
  oversized: "动画文件过大，请缩小清单或动画包后重试",
});
