import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
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

test("moves colliding label and bubble stacks upward deterministically within the scene", () => {
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
  assert.ok(first[1].offsetY < first[0].offsetY);
  assert.ok(first[2].offsetY < first[1].offsetY);
  for (const layout of first) {
    for (const rectangle of [layout.labelRect, layout.bubbleRect].filter(Boolean)) {
      assert.ok(rectangle.x >= 0 && rectangle.y >= 0);
      assert.ok(rectangle.x + rectangle.width <= 390);
      assert.ok(rectangle.y + rectangle.height <= 500);
    }
  }
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
  assert.match(markup, /left:62px/u);
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
