export const MAX_CUSTOM_ANIMATION_BYTES = 2 * 1024 * 1024;
export const MIN_CUSTOM_ANIMATION_FRAME_SIZE = 384;

const DIRECTIONS = Object.freeze(["front", "back", "left", "right"]);
const STILL_IMAGE_SOURCE = /(?:^data:image\/|\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$)/iu;
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const failure = (reason) => ({ ok: false, reason, manifest: null });

const byteLength = (value) => {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(value).byteLength;
  return value.length;
};

const resolveClipUrl = (source, baseUrl) => {
  const value = cleanText(source);
  if (!value || STILL_IMAGE_SOURCE.test(value) && value.startsWith("data:")) return "";
  try {
    const resolved = baseUrl ? new URL(value, baseUrl) : new URL(value);
    return ["http:", "https:"].includes(resolved.protocol) ? resolved.href : "";
  } catch {
    return "";
  }
};

const normalizeStrip = (value, { baseUrl, minimumFrames = 1, legalFacings = DIRECTIONS } = {}) => {
  if (!isRecord(value) || value.alpha !== true) return { reason: "invalid-clip-manifest" };
  const frameWidth = Number(value.frameWidth ?? value.cellSize);
  const frameHeight = Number(value.frameHeight ?? value.cellSize);
  const frameCount = Number(value.frameCount);
  const columns = Number(value.columns);
  const rows = Number(value.rows ?? 1);
  const fps = Number(value.fps);
  const src = resolveClipUrl(value.src, baseUrl);
  if (!Number.isFinite(frameWidth) || !Number.isFinite(frameHeight)
    || frameWidth < MIN_CUSTOM_ANIMATION_FRAME_SIZE || frameHeight < MIN_CUSTOM_ANIMATION_FRAME_SIZE) {
    return { reason: "low-resolution" };
  }
  if (!src || frameWidth !== frameHeight || !Number.isInteger(frameCount) || frameCount < minimumFrames
    || !Number.isInteger(columns) || columns < frameCount || !Number.isInteger(rows) || rows < 1
    || !Number.isFinite(fps) || fps <= 0 || fps > 30) {
    return { reason: "invalid-clip-manifest" };
  }
  const declaredWidth = Number(value.width ?? frameWidth * columns);
  const declaredHeight = Number(value.height ?? frameHeight * rows);
  if (!Number.isFinite(declaredWidth) || !Number.isFinite(declaredHeight)
    || declaredWidth < frameWidth * columns || declaredHeight < frameHeight * rows) {
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
  baseUrl = "",
  byteLength: declaredByteLength = 0,
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

  const locomotion = {};
  for (const direction of DIRECTIONS) {
    const normalized = normalizeStrip(value.clips.locomotion[direction], {
      baseUrl,
      minimumFrames: 8,
      legalFacings: [direction],
    });
    if (normalized.reason) return failure(normalized.reason);
    locomotion[direction] = normalized.strip;
  }
  const idle = normalizeStrip(value.clips.idle, { baseUrl });
  if (idle.reason) return failure(idle.reason);
  const action = normalizeStrip(value.clips.action, { baseUrl });
  if (action.reason) return failure(action.reason);

  const actions = {};
  if (value.clips.actions !== undefined) {
    if (!isRecord(value.clips.actions)) return failure("invalid-clip-manifest");
    for (const [clipId, strip] of Object.entries(value.clips.actions)) {
      if (!cleanText(clipId)) return failure("invalid-clip-manifest");
      const normalized = normalizeStrip(strip, { baseUrl });
      if (normalized.reason) return failure(normalized.reason);
      actions[clipId] = normalized.strip;
    }
  }

  return {
    ok: true,
    reason: "",
    manifest: Object.freeze({
      version: 1,
      alpha: true,
      clips: Object.freeze({
        locomotion: Object.freeze(locomotion),
        idle: idle.strip,
        action: action.strip,
        actions: Object.freeze(actions),
      }),
    }),
  };
}

export function validateOfficeAnimationBundle(value, options = {}) {
  try {
    return validateOfficeAnimationBundleUnsafe(value, options);
  } catch {
    return failure("invalid-clip-manifest");
  }
}

export function validateOfficeAnimationFile(file) {
  try {
    if (!file || typeof file !== "object") return failure("invalid-clip-manifest");
    if (cleanText(file.type).startsWith("image/")) return failure("still-image");
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_CUSTOM_ANIMATION_BYTES) {
      return failure("oversized");
    }
    const name = cleanText(file.name).toLowerCase();
    const type = cleanText(file.type).toLowerCase();
    if (type !== "application/json" && !name.endsWith(".json")) return failure("invalid-clip-manifest");
    return { ok: true, reason: "", manifest: null };
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

export async function fetchOfficeAnimationManifest(source, {
  fetchImpl = globalThis.fetch,
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
    const contentLength = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) return failure("oversized");
    const text = await response.text();
    return parseOfficeAnimationManifestText(text, { baseUrl: parsedUrl.href, maxBytes });
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
  "still-image": "不支持静态图片，请提供动画清单",
  "low-resolution": "动画每帧至少需要 384×384 像素",
  "invalid-clip-manifest": "动画清单不完整，请检查四向走路、透明通道与待机/动作片段",
  oversized: "动画清单不能超过 2 MB",
});
