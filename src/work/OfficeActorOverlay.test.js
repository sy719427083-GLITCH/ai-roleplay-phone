import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { strToU8, zipSync } from "fflate";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  configFile: false,
  logLevel: "silent",
  root: fileURLToPath(new URL("../..", import.meta.url)),
  server: { middlewareMode: true },
});
const overlayModule = await vite.ssrLoadModule("/src/work/OfficeActorOverlay.jsx").catch(() => ({}));
const animationModule = await vite.ssrLoadModule("/src/work/officeAnimatedAssets.js").catch(() => ({}));
const previousReact = globalThis.React;
globalThis.React = React;

after(async () => {
  globalThis.React = previousReact;
  await vite.close();
});

const actor = (id, sceneId, x, y, facing = "front") => ({
  id,
  sceneId,
  x,
  y,
  facing,
  status: `${id}状态`,
  profile: { name: `${id}名字` },
});

const actors = [
  actor("boss", "office", 500, 240, "front"),
  actor("employee1", "office", 260, 780, "right"),
  actor("employee2", "office", 800, 780, "left"),
  actor("employee3", "lounge", 300, 1180, "back"),
  actor("employee4", "lounge", 720, 1180, "front"),
];

const characters = Object.fromEntries(actors.map((entry) => [entry.id, {
  slotId: entry.id,
  status: entry.status,
  conversationId: entry.id === "employee1" ? "conversation-a" : "",
}]));

test("builds five strict scene-aware snapshots at the renderer screen coordinates", () => {
  assert.equal(typeof overlayModule.buildOfficeActorSnapshots, "function");
  const snapshots = overlayModule.buildOfficeActorSnapshots({
    state: {
      visibleSceneId: "office",
      characters,
      conversations: {
        "conversation-a": {
          bubbleQueue: [{ speakerId: "employee1", text: "这句只跟第一组有关" }],
        },
      },
    },
    world: { actors, visibleSceneId: "office" },
    renderer: { worldToScreen: ({ x, y }) => ({ x: x / 2, y: y / 4 }) },
  });

  assert.equal(snapshots.length, 5);
  for (const snapshot of snapshots) {
    assert.deepEqual(Object.keys(snapshot), [
      "slotId", "visible", "screenX", "screenY", "name", "status", "bubble", "facing", "sceneId",
    ]);
  }
  assert.deepEqual(snapshots.map(({ slotId, visible }) => [slotId, visible]), [
    ["boss", true], ["employee1", true], ["employee2", true], ["employee3", false], ["employee4", false],
  ]);
  assert.deepEqual(snapshots[1], {
    slotId: "employee1",
    visible: true,
    screenX: 130,
    screenY: 195,
    name: "employee1名字",
    status: "employee1状态",
    bubble: "这句只跟第一组有关",
    facing: "right",
    sceneId: "office",
  });
  assert.equal(snapshots.filter(({ bubble }) => bubble).length, 1);
});

test("moves colliding label and bubble stacks deterministically within the scene", () => {
  assert.equal(typeof overlayModule.layoutOfficeActorOverlays, "function");
  const snapshots = [
    { slotId: "boss", visible: true, screenX: 180, screenY: 300, bubble: "第一句" },
    { slotId: "employee1", visible: true, screenX: 186, screenY: 302, bubble: "第二句" },
    { slotId: "employee2", visible: true, screenX: 190, screenY: 305, bubble: "" },
  ];
  const first = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 500 });
  const second = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 500 });

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.ok(first.some(({ offsetY }) => offsetY !== 0));
  const rectangles = first.flatMap(({ labelRect, bubbleRect }) => [labelRect, bubbleRect].filter(Boolean));
  for (const layout of first) {
    for (const rectangle of [layout.labelRect, layout.bubbleRect].filter(Boolean)) {
      assert.ok(rectangle.x >= 0 && rectangle.y >= 0);
      assert.ok(rectangle.x + rectangle.width <= 390);
      assert.ok(rectangle.y + rectangle.height <= 500);
    }
  }
  rectangles.forEach((rectangle, index) => {
    for (const other of rectangles.slice(index + 1)) {
      assert.equal(rectanglesIntersect(rectangle, other), false);
    }
  });
});

const rectanglesIntersect = (left, right) => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

test("keeps five top-edge bubble and label rectangles bounded and mutually disjoint", () => {
  const snapshots = ["boss", "employee1", "employee2", "employee3", "employee4"].map((slotId, index) => ({
    slotId,
    visible: true,
    screenX: 180 + index,
    screenY: 20,
    bubble: `${slotId}正在发言`,
  }));
  const first = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 500 });
  const second = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 500 });
  const rectangles = first.flatMap(({ labelRect, bubbleRect }) => [labelRect, bubbleRect]);

  assert.deepEqual(first, second);
  assert.equal(rectangles.length, 10);
  for (const layout of first) {
    assert.equal(rectanglesIntersect(layout.labelRect, layout.bubbleRect), false);
  }
  rectangles.forEach((rectangle, index) => {
    assert.ok(rectangle.x >= 0 && rectangle.y >= 0);
    assert.ok(rectangle.x + rectangle.width <= 390);
    assert.ok(rectangle.y + rectangle.height <= 500);
    for (const other of rectangles.slice(index + 1)) {
      assert.equal(rectanglesIntersect(rectangle, other), false);
    }
  });
});

test("uses one conservative DOM height model for five long top-edge bubbles and labels", () => {
  assert.equal(typeof overlayModule.measureOfficeOverlayText, "function");
  const longCjk = "项目复盘需要逐项确认风险进度结论后续安排并同步所有相关同事".repeat(3).slice(0, 80);
  const longDigits = "1234567890".repeat(8);
  const snapshots = ["boss", "employee1", "employee2", "employee3", "employee4"].map((slotId, index) => ({
    slotId,
    visible: true,
    screenX: 180 + index,
    screenY: 20,
    name: `${slotId}超长姓名`,
    status: "正在处理重要工作事项",
    bubble: index % 2 ? longDigits : longCjk,
    facing: "front",
    sceneId: "office",
  }));
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 712 });
  const rectangles = layouts.flatMap(({ labelRect, bubbleRect }) => [labelRect, bubbleRect]);

  assert.ok(overlayModule.measureOfficeOverlayText(snapshots[0]).bubbleHeight > 48);
  layouts.forEach((layout, index) => {
    const metrics = overlayModule.measureOfficeOverlayText(snapshots[index]);
    assert.equal(layout.bubbleRect.height, metrics.bubbleHeight);
    assert.equal(layout.labelRect.height, metrics.labelHeight);
  });
  rectangles.forEach((rectangle, index) => {
    assert.ok(rectangle.x >= 0 && rectangle.y >= 0);
    assert.ok(rectangle.x + rectangle.width <= 390);
    assert.ok(rectangle.y + rectangle.height <= 712);
    for (const other of rectangles.slice(index + 1)) {
      assert.equal(rectanglesIntersect(rectangle, other), false);
    }
  });

  const markup = renderToStaticMarkup(React.createElement(overlayModule.OfficeActorOverlay, {
    snapshots,
    sceneId: "office",
    sceneWidth: 390,
    sceneHeight: 712,
  }));
  assert.equal((markup.match(/--office-bubble-height:/g) || []).length, 5);
  assert.equal((markup.match(/--office-name-height:/g) || []).length, 5);
  assert.match(markup, new RegExp(longCjk, "u"));
  assert.match(markup, new RegExp(longDigits, "u"));
});

test("caps API bubbles at the existing eighty-character boundary", () => {
  const longBubble = "长".repeat(120);
  const snapshots = overlayModule.buildOfficeActorSnapshots({
    state: {
      visibleSceneId: "office",
      characters: { boss: { conversationId: "conversation-a" } },
      conversations: {
        "conversation-a": { bubbleQueue: [{ speakerId: "boss", text: longBubble }] },
      },
    },
    world: { actors: [actor("boss", "office", 100, 100)], visibleSceneId: "office" },
  });

  assert.equal(snapshots[0].bubble.length, 80);
  assert.equal(snapshots[0].bubble, longBubble.slice(0, 80));
});

test("renders independent accessible actor overlays and an icon door control", () => {
  assert.equal(typeof overlayModule.OfficeActorOverlay, "function");
  const snapshots = actors.map((entry) => ({
    slotId: entry.id,
    visible: entry.sceneId === "office",
    screenX: entry.x / 3,
    screenY: entry.y / 4,
    name: entry.profile.name,
    status: entry.status,
    bubble: entry.id === "boss" ? "请进" : "",
    facing: entry.facing,
    sceneId: entry.sceneId,
  }));
  snapshots[0] = { ...snapshots[0], screenX: 2 };
  const markup = renderToStaticMarkup(React.createElement(overlayModule.OfficeActorOverlay, {
    snapshots,
    sceneId: "office",
  }));

  assert.equal((markup.match(/data-office-actor-overlay=/g) || []).length, 5);
  assert.match(markup, /aria-label="进入休息区"/u);
  assert.match(markup, /title="进入休息区"/u);
  assert.match(markup, /data-lucide="door-open"/u);
  assert.match(markup, /left:96px/u);
  assert.match(markup, /--office-bubble-shift:/u);
  assert.equal((markup.match(/ hidden=""/g) || []).length, 2);
});

test("restores focus to the same door control after switching scenes", () => {
  assert.equal(typeof overlayModule.restoreOfficeDoorFocus, "function");
  let focused = 0;
  let scheduled = null;
  const button = { focus: () => { focused += 1; } };
  overlayModule.restoreOfficeDoorFocus(button, (callback) => { scheduled = callback; });
  assert.equal(focused, 0);
  scheduled();
  assert.equal(focused, 1);
});

const strip = (name, frameCount = 8, frameSize = 384) => ({
  src: `clips/${name}.webp`,
  frameWidth: frameSize,
  frameHeight: frameSize,
  frameCount,
  columns: frameCount,
  rows: 1,
  fps: 9,
  loop: true,
  alpha: true,
});

const validManifest = () => ({
  version: 1,
  alpha: true,
  clips: {
    locomotion: {
      front: strip("walk-front"),
      back: strip("walk-back"),
      left: strip("walk-left"),
      right: strip("walk-right"),
    },
    idle: strip("idle", 4),
    action: strip("action", 4),
  },
});

const createManifestZip = (manifest = validManifest(), overrides = {}) => {
  const entries = {
    "bundle/manifest.json": strToU8(JSON.stringify(manifest)),
    ...Object.fromEntries([
      "walk-front", "walk-back", "walk-left", "walk-right", "idle", "action",
    ].map((name, index) => [`bundle/clips/${name}.webp`, new Uint8Array([1, 2, 3, index])])),
  };
  for (const [path, bytes] of Object.entries(overrides)) {
    if (bytes === undefined) delete entries[path];
    else entries[path] = bytes;
  }
  return zipSync(entries, { level: 6 });
};

test("returns stable animated manifest validation results and exact rejection reasons", () => {
  assert.equal(typeof animationModule.validateOfficeAnimationBundle, "function");
  const validate = animationModule.validateOfficeAnimationBundle;

  assert.deepEqual(validate("https://cdn.example/portrait.png"), {
    ok: false, reason: "still-image", manifest: null,
  });
  assert.deepEqual(validate("data:image/png;base64,AAAA"), {
    ok: false, reason: "still-image", manifest: null,
  });
  assert.deepEqual(validate(validManifest(), { byteLength: animationModule.MAX_CUSTOM_ANIMATION_BYTES + 1 }), {
    ok: false, reason: "oversized", manifest: null,
  });

  const lowResolution = validManifest();
  lowResolution.clips.locomotion.front.frameWidth = 256;
  assert.deepEqual(validate(lowResolution), {
    ok: false, reason: "low-resolution", manifest: null,
  });

  const invalid = validManifest();
  delete invalid.clips.locomotion.back;
  assert.deepEqual(validate(invalid), {
    ok: false, reason: "invalid-clip-manifest", manifest: null,
  });
});

test("normalizes a complete hosted manifest for locomotion, idle, and action fallback", () => {
  const result = animationModule.validateOfficeAnimationBundle(validManifest(), {
    baseUrl: "https://cdn.example/characters/manifest.json",
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, "");
  assert.equal(result.manifest.clips.locomotion.left.src, "https://cdn.example/characters/clips/walk-left.webp");
  assert.equal(result.manifest.clips.locomotion.left.frameCount, 8);
  assert.equal(result.manifest.clips.idle.cellSize, 384);
  assert.equal(result.manifest.clips.action.cellSize, 384);
});

test("contains hostile manifest accessors and invalid declared strip dimensions", () => {
  const throwing = {};
  Object.defineProperty(throwing, "version", { get() { throw new Error("hostile getter"); } });
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  for (const value of [throwing, proxy]) {
    assert.doesNotThrow(() => animationModule.validateOfficeAnimationBundle(value));
    assert.deepEqual(animationModule.validateOfficeAnimationBundle(value), {
      ok: false, reason: "invalid-clip-manifest", manifest: null,
    });
  }

  const invalidDimensions = validManifest();
  invalidDimensions.clips.action.width = "not-a-number";
  assert.deepEqual(animationModule.validateOfficeAnimationBundle(invalidDimensions), {
    ok: false, reason: "invalid-clip-manifest", manifest: null,
  });
});

test("requires at least four frames for idle and action fallbacks", () => {
  for (const clipId of ["idle", "action"]) {
    const manifest = validManifest();
    manifest.clips[clipId] = strip(clipId, 3);
    assert.deepEqual(animationModule.validateOfficeAnimationBundle(manifest, {
      baseUrl: "https://cdn.example/characters/manifest.json",
    }), {
      ok: false, reason: "invalid-clip-manifest", manifest: null,
    });
  }
});

const meaningfulInspection = (normalizedStrip, { distinctFrames = normalizedStrip.frameCount } = {}) => ({
  width: normalizedStrip.width,
  height: normalizedStrip.height,
  transparentCoverage: 0.55,
  frames: Array.from({ length: normalizedStrip.frameCount }, (_, index) => ({
    opaqueCoverage: 0.24,
    transparentCoverage: 0.55,
    fingerprint: Array.from({ length: 128 }, (_value, sample) => (
      ((index % distinctFrames) * 41 + sample * 13) % 256
    )),
  })),
});

test("inspects real dimensions, transparency, and every required frame before acceptance", async () => {
  assert.equal(typeof animationModule.inspectOfficeAnimationManifest, "function");
  const manifest = validManifest();
  const inspectedSources = [];
  const accepted = await animationModule.inspectOfficeAnimationManifest(manifest, {
    baseUrl: "https://cdn.example/characters/manifest.json",
    inspectImage: async (source, { strip: normalizedStrip }) => {
      inspectedSources.push(source);
      return meaningfulInspection(normalizedStrip);
    },
  });
  assert.equal(accepted.ok, true);
  assert.equal(new Set(inspectedSources).size, 6);

  for (const mutation of [
    (inspection) => ({ ...inspection, width: 384 }),
    (inspection) => ({ ...inspection, transparentCoverage: 0 }),
    (inspection) => ({
      ...inspection,
      frames: inspection.frames.map((frame, index) => (
        index === 2 ? { ...frame, opaqueCoverage: 0 } : frame
      )),
    }),
  ]) {
    const rejected = await animationModule.inspectOfficeAnimationManifest(manifest, {
      baseUrl: "https://cdn.example/characters/manifest.json",
      inspectImage: async (_source, { strip: normalizedStrip }) => mutation(meaningfulInspection(normalizedStrip)),
    });
    assert.equal(rejected.ok, false);
    assert.equal(["low-resolution", "invalid-clip-manifest"].includes(rejected.reason), true);
    assert.equal(rejected.manifest, null);
  }
});

test("rejects copied frames, one-pixel alpha tricks, and insufficient motion diversity", async () => {
  const manifest = validManifest();
  const staticResult = await animationModule.inspectOfficeAnimationManifest(manifest, {
    baseUrl: "https://cdn.example/characters/manifest.json",
    inspectImage: async (_source, { strip: normalizedStrip }) => ({
      ...meaningfulInspection(normalizedStrip, { distinctFrames: 1 }),
      hasTransparency: true,
      nonEmptyFrames: Array.from({ length: normalizedStrip.frameCount }, () => true),
      transparentCoverage: 1 / (normalizedStrip.width * normalizedStrip.height),
      frames: meaningfulInspection(normalizedStrip, { distinctFrames: 1 }).frames.map((frame, index) => ({
        ...frame,
        opaqueCoverage: index === 0 ? 1 / (normalizedStrip.cellSize ** 2) : 0.99,
        transparentCoverage: index === 0 ? 1 / (normalizedStrip.cellSize ** 2) : 0,
      })),
    }),
  });
  assert.deepEqual(staticResult, { ok: false, reason: "invalid-clip-manifest", manifest: null });

  for (const [target, distinctFrames] of [["locomotion", 3], ["action", 1]]) {
    const result = await animationModule.inspectOfficeAnimationManifest(manifest, {
      baseUrl: "https://cdn.example/characters/manifest.json",
      inspectImage: async (_source, { strip: normalizedStrip }) => meaningfulInspection(normalizedStrip, {
        distinctFrames: target === "locomotion" && normalizedStrip.frameCount === 8
          ? distinctFrames
          : target === "action" && normalizedStrip.frameCount === 4
            ? distinctFrames
            : normalizedStrip.frameCount,
      }),
    });
    assert.deepEqual(result, { ok: false, reason: "invalid-clip-manifest", manifest: null });
  }
});

test("computes robust per-frame coverage and fingerprints from decoded pixels", () => {
  assert.equal(typeof animationModule.analyzeOfficeAnimationPixels, "function");
  const stripGeometry = { width: 64, height: 8, cellSize: 8, columns: 8, rows: 1, frameCount: 8 };
  const pixels = new Uint8ClampedArray(stripGeometry.width * stripGeometry.height * 4);
  for (let frame = 0; frame < 8; frame += 1) {
    for (let y = 1; y < 7; y += 1) {
      for (let x = 1; x < 7; x += 1) {
        const pixel = ((y * stripGeometry.width) + (frame * 8) + x) * 4;
        pixels[pixel] = 80;
        pixels[pixel + 1] = 120;
        pixels[pixel + 2] = 160;
        pixels[pixel + 3] = 255;
      }
    }
  }
  const analysis = animationModule.analyzeOfficeAnimationPixels(pixels, stripGeometry);

  assert.equal(analysis.frames.length, 8);
  assert.ok(analysis.transparentCoverage > 0.3);
  assert.equal(new Set(analysis.frames.map(({ fingerprint }) => fingerprint.join(","))).size, 1);
  assert.ok(analysis.frames.every(({ opaqueCoverage }) => opaqueCoverage > 0.3));
});

test("keys image inspection by source and complete strip geometry", async () => {
  const manifest = validManifest();
  for (const clip of [
    ...Object.values(manifest.clips.locomotion), manifest.clips.idle, manifest.clips.action,
  ]) clip.src = "clips/shared.webp";
  const inspectedGeometries = [];
  const result = await animationModule.inspectOfficeAnimationManifest(manifest, {
    baseUrl: "https://cdn.example/characters/manifest.json",
    inspectImage: async (_source, { strip: normalizedStrip }) => {
      inspectedGeometries.push([
        normalizedStrip.cellSize,
        normalizedStrip.width,
        normalizedStrip.height,
        normalizedStrip.columns,
        normalizedStrip.rows,
        normalizedStrip.frameCount,
      ].join("x"));
      return meaningfulInspection(normalizedStrip);
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(inspectedGeometries.sort(), [
    "384x1536x384x4x1x4",
    "384x3072x384x8x1x8",
  ]);
});

test("uses the redirected response URL as hosted clip base and inspects the resolved clips", async () => {
  assert.equal(typeof animationModule.fetchOfficeAnimationManifest, "function");
  const bytes = new TextEncoder().encode(JSON.stringify(validManifest()));
  let delivered = false;
  const inspectedSources = [];
  const response = {
    ok: true,
    url: "https://assets.example/redirected/manifest.json",
    headers: { get: () => null },
    body: {
      getReader: () => ({
        read: async () => {
          if (delivered) return { done: true, value: undefined };
          delivered = true;
          return { done: false, value: bytes };
        },
      }),
    },
  };
  const result = await animationModule.fetchOfficeAnimationManifest("https://origin.example/manifest.json", {
    fetchImpl: async () => response,
    inspectImage: async (source, { strip: normalizedStrip }) => {
      inspectedSources.push(source);
      return meaningfulInspection(normalizedStrip);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.manifest.clips.locomotion.front.src, "https://assets.example/redirected/clips/walk-front.webp");
  assert.equal(inspectedSources.every((source) => source.startsWith("https://assets.example/redirected/clips/")), true);
});

test("cancels a lengthless hosted manifest stream as soon as it exceeds the byte cap", async () => {
  assert.equal(typeof animationModule.readBoundedResponseBytes, "function");
  let readCount = 0;
  let cancelled = false;
  const chunks = [new Uint8Array(8), new Uint8Array(8), new Uint8Array(8)];
  const response = {
    headers: { get: () => null },
    text: async () => { throw new Error("must not buffer through response.text"); },
    body: {
      getReader: () => ({
        read: async () => ({ done: readCount >= chunks.length, value: chunks[readCount++] }),
        cancel: async () => { cancelled = true; },
      }),
    },
  };

  const result = await animationModule.readBoundedResponseBytes(response, 10);
  assert.deepEqual(result, { ok: false, reason: "oversized", manifest: null });
  assert.equal(readCount, 2);
  assert.equal(cancelled, true);
});

test("accepts JSON and ZIP files but never image files", () => {
  assert.deepEqual(animationModule.validateOfficeAnimationFile({
    name: "portrait.png", type: "image/png", size: 100,
  }), { ok: false, reason: "still-image", manifest: null });
  assert.equal(animationModule.validateOfficeAnimationFile({
    name: "manifest.json", type: "application/json", size: 100,
  }).ok, true);
  assert.equal(animationModule.validateOfficeAnimationFile({
    name: "animation.zip", type: "application/zip", size: 100,
  }).ok, true);
  assert.deepEqual(animationModule.validateOfficeAnimationFile({
    name: "animation.zip",
    type: "application/zip",
    size: animationModule.MAX_CUSTOM_ANIMATION_ARCHIVE_BYTES + 1,
  }), { ok: false, reason: "oversized", manifest: null });
});

test("parses a real ZIP bundle into persistent data URLs and inspects every unique clip", async () => {
  assert.equal(typeof animationModule.parseOfficeAnimationUpload, "function");
  const bytes = createManifestZip();
  const inspected = [];
  const result = await animationModule.parseOfficeAnimationUpload({
    name: "animation.zip",
    type: "application/zip",
    size: bytes.byteLength,
    bytes,
  }, {
    inspectImage: async (source, { strip: normalizedStrip }) => {
      inspected.push(source);
      return meaningfulInspection(normalizedStrip);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(inspected.length, 6);
  assert.equal(inspected.every((source) => source.startsWith("data:image/webp;base64,")), true);
  assert.equal(result.manifest.clips.locomotion.front.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(result.manifest.clips.locomotion.front.src.startsWith("blob:"), false);
  assert.equal(animationModule.validateOfficeAnimationBundle(result.manifest).ok, true);
});

test("rejects unsafe, incomplete, duplicate-manifest, and inflated ZIP bundles", async () => {
  const inspectImage = async (_source, { strip: normalizedStrip }) => meaningfulInspection(normalizedStrip);
  const parseZip = (bytes, options = {}) => animationModule.parseOfficeAnimationUpload({
    name: "animation.zip", type: "application/zip", size: bytes.byteLength, bytes,
  }, { inspectImage, ...options });

  const missing = createManifestZip(validManifest(), { "bundle/clips/walk-left.webp": undefined });
  const missingResult = await parseZip(missing);
  assert.deepEqual(missingResult, { ok: false, reason: "invalid-clip-manifest", manifest: null });

  const traversalManifest = validManifest();
  traversalManifest.clips.action.src = "../../outside.webp";
  const traversal = createManifestZip(traversalManifest, { "outside.webp": new Uint8Array([1]) });
  assert.deepEqual(await parseZip(traversal), {
    ok: false, reason: "invalid-clip-manifest", manifest: null,
  });

  const duplicateManifests = createManifestZip(validManifest(), {
    "manifest.json": strToU8(JSON.stringify(validManifest())),
  });
  assert.deepEqual(await parseZip(duplicateManifests), {
    ok: false, reason: "invalid-clip-manifest", manifest: null,
  });

  const inflated = createManifestZip(validManifest(), {
    "bundle/clips/action.webp": new Uint8Array(32 * 1024),
  });
  assert.deepEqual(await parseZip(inflated, { maxUncompressedBytes: 8 * 1024 }), {
    ok: false, reason: "oversized", manifest: null,
  });
});

test("rejects uploaded JSON with relative clips because it has no resource base", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(validManifest()));
  const result = await animationModule.parseOfficeAnimationUpload({
    name: "manifest.json", type: "application/json", size: bytes.byteLength, bytes,
  }, {
    inspectImage: async () => { throw new Error("must not inspect unresolved clips"); },
  });
  assert.deepEqual(result, { ok: false, reason: "invalid-clip-manifest", manifest: null });
});
