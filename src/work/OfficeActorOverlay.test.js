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
      "slotId", "visible", "screenX", "screenY", "headScreenY", "worldX", "worldY", "name", "status", "bubble", "facing", "sceneId",
      "clip", "frameIndex", "moving",
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
    headScreenY: 112.5,
    worldX: 260,
    worldY: 780,
    name: "employee1名字",
    status: "employee1状态",
    bubble: "这句只跟第一组有关",
    facing: "right",
    sceneId: "office",
    clip: "idle-standing",
    frameIndex: 0,
    moving: false,
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
  const rectangles = first.flatMap(({ labelRect, statusRect, bubbleRect }) => [labelRect, statusRect, bubbleRect].filter(Boolean));
  for (const layout of first) {
    for (const rectangle of [layout.labelRect, layout.statusRect, layout.bubbleRect].filter(Boolean)) {
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

test("keeps the overlay layout signature stable across animation-only frame changes", () => {
  assert.equal(typeof overlayModule.buildOfficeOverlayLayoutSignature, "function");
  const base = [{
    slotId: "employee1",
    visible: true,
    screenX: 120,
    screenY: 300,
    headScreenY: 190,
    name: "程雾",
    status: "工作中",
    bubble: "",
    frameIndex: 0,
    facing: "left",
    moving: false,
  }];
  const obstacles = [{ id: "employee1-desk", x: 60, y: 220, width: 120, height: 80 }];
  const first = overlayModule.buildOfficeOverlayLayoutSignature(base, obstacles, 390, 712);
  const animationOnly = overlayModule.buildOfficeOverlayLayoutSignature([
    { ...base[0], frameIndex: 3, facing: "right", moving: true },
  ], obstacles.map((entry) => ({ ...entry })), 390, 712);
  const moved = overlayModule.buildOfficeOverlayLayoutSignature([
    { ...base[0], screenX: 122 },
  ], obstacles, 390, 712);

  assert.equal(first, animationOnly);
  assert.notEqual(first, moved);
});

test("keeps the stationary solver key stable while a walking actor advances", () => {
  assert.equal(typeof overlayModule.partitionOfficeOverlayInputs, "function");
  assert.equal(typeof overlayModule.layoutMovingOfficeActorOverlays, "function");
  assert.equal(typeof overlayModule.adjustStationaryOfficeOverlaysForMovingBodies, "function");
  const stationary = {
    slotId: "boss", visible: true, screenX: 195, screenY: 250, headScreenY: 140,
    name: "沈知白", status: "工作中", bubble: "", moving: false,
  };
  const walking = {
    slotId: "employee1", visible: true, screenX: 120, screenY: 520, headScreenY: 410,
    name: "周予安", status: "前往茶水间", bubble: "", moving: true,
  };
  const first = overlayModule.partitionOfficeOverlayInputs(
    [stationary, walking],
    [
      { id: "pantry", x: 25, y: 100, width: 330, height: 50 },
      { id: "boss:body", x: 170, y: 140, width: 50, height: 110 },
      { id: "employee1:body", x: 95, y: 410, width: 50, height: 110 },
    ],
    390,
    712,
  );
  const second = overlayModule.partitionOfficeOverlayInputs(
    [stationary, { ...walking, screenX: 146, screenY: 538, headScreenY: 428, frameIndex: 5 }],
    [
      { id: "pantry", x: 25, y: 100, width: 330, height: 50 },
      { id: "boss:body", x: 170, y: 140, width: 50, height: 110 },
      { id: "employee1:body", x: 121, y: 428, width: 50, height: 110 },
    ],
    390,
    712,
  );

  assert.equal(first.stationarySignature, second.stationarySignature);
  assert.deepEqual(first.stationarySnapshots.map(({ slotId }) => slotId), ["boss"]);
  assert.deepEqual(first.movingSnapshots.map(({ slotId }) => slotId), ["employee1"]);
  assert.equal(first.stationaryAvoidRects.some(({ id }) => id === "employee1:body"), false);
  assert.deepEqual(first.movingBodyRects.map(({ id }) => id), ["employee1:body"]);
  const movingLayouts = overlayModule.layoutMovingOfficeActorOverlays(second.movingSnapshots, {
    width: 390,
    height: 712,
    avoidRects: [...second.stationaryAvoidRects, ...second.movingBodyRects],
  });
  assert.equal(movingLayouts.length, 1);
  assert.ok(Math.abs((movingLayouts[0].labelRect.x + 32) - 146) <= 16);
});

test("lightly shifts a stationary label when a walking body crosses underneath", () => {
  const snapshot = {
    slotId: "boss", visible: true, screenX: 195, screenY: 270, headScreenY: 160,
    name: "沈知白", status: "工作中", bubble: "", moving: false,
  };
  const [layout] = overlayModule.layoutOfficeActorOverlays([snapshot], { width: 390, height: 712 });
  const movingBody = {
    id: "employee1:body",
    x: layout.labelRect.x + 10,
    y: layout.labelRect.y - 4,
    width: 34,
    height: layout.labelRect.height + 8,
  };
  const [adjusted] = overlayModule.adjustStationaryOfficeOverlaysForMovingBodies(
    [layout],
    [snapshot],
    {
      width: 390,
      height: 712,
      avoidRects: [movingBody],
      movingBodyRects: [movingBody],
    },
  );

  assert.equal([adjusted.labelRect, adjusted.statusRect].some((rectangle) => (
    rectanglesIntersect(rectangle, movingBody)
  )), false);
  assert.ok(Math.abs((adjusted.labelRect.x + 32) - snapshot.screenX) <= 16);
  assert.ok(snapshot.headScreenY - (adjusted.labelRect.y + adjusted.labelRect.height) <= 30.5);
});

test("keeps every label and bubble stack above the actor head anchor", () => {
  const snapshots = [
    { slotId: "boss", visible: true, screenX: 195, screenY: 240, headScreenY: 116, bubble: "" },
    { slotId: "employee1", visible: true, screenX: 102, screenY: 390, headScreenY: 266, bubble: "项目进度已经整理好了" },
    { slotId: "employee2", visible: true, screenX: 288, screenY: 390, headScreenY: 266, bubble: "" },
  ];
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 712 });

  assert.equal(layouts.length, 3);
  layouts.forEach((layout, index) => {
    const bottom = Math.max(layout.labelRect.bottom ?? (layout.labelRect.y + layout.labelRect.height),
      layout.statusRect.bottom ?? (layout.statusRect.y + layout.statusRect.height),
      layout.bubbleRect?.bottom ?? ((layout.bubbleRect?.y || 0) + (layout.bubbleRect?.height || 0)));
    assert.ok(bottom <= snapshots[index].headScreenY - 6, `${snapshots[index].slotId} overlay covers the actor head`);
  });
});

test("keeps overlay blocks clear of actor bodies and projected fixed furniture", () => {
  const snapshots = [
    { slotId: "boss", visible: true, screenX: 195, screenY: 243, headScreenY: 120, bubble: "" },
    { slotId: "employee1", visible: true, screenX: 101, screenY: 392, headScreenY: 270, bubble: "" },
    { slotId: "employee2", visible: true, screenX: 289, screenY: 392, headScreenY: 270, bubble: "" },
  ];
  const avoidRects = [
    { id: "boss-desk", x: 119, y: 130, width: 152, height: 93 },
    ...snapshots.map((snapshot) => ({
      id: `${snapshot.slotId}:body`,
      x: snapshot.screenX - 38,
      y: snapshot.headScreenY,
      width: 76,
      height: snapshot.screenY - snapshot.headScreenY,
    })),
  ];
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, {
    width: 390,
    height: 712,
    avoidRects,
  });

  for (const layout of layouts) {
    for (const rectangle of [layout.labelRect, layout.statusRect, layout.bubbleRect].filter(Boolean)) {
      for (const avoidRect of avoidRects) {
        assert.equal(rectanglesIntersect(rectangle, avoidRect), false, `${layout.slotId} covers ${avoidRect.id}`);
      }
    }
  }
});

test("solves a five-actor activity layout without falling back across the boss desk", () => {
  const scale = 375 / 1080;
  const evidencePositions = {
    boss: [300, 1450],
    employee1: [550, 700],
    employee2: [750, 700],
    employee3: [500, 1860],
    employee4: [840, 1860],
  };
  const snapshots = Object.entries(evidencePositions).map(([slotId, [x, y]]) => ({
    slotId,
    visible: true,
    screenX: x * scale,
    screenY: y * scale,
    headScreenY: (y - 330) * scale,
    bubble: slotId === "employee4" ? "发布清单已核对，结论一致" : "",
  }));
  const furniture = overlayModule.buildOfficeSceneOverlayGeometry({
    sceneId: "office",
    renderer: { worldToScreen: ({ x, y }) => ({ x: x * scale, y: y * scale }) },
  }).furnitureRects;
  const bodies = overlayModule.buildOfficeActorBodyRects(snapshots);
  const avoidRects = [...furniture, ...bodies];
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, {
    width: 375,
    height: 712,
    avoidRects,
  });

  assert.equal(layouts.length, 5);
  for (const layout of layouts) {
    for (const rectangle of [layout.labelRect, layout.statusRect, layout.bubbleRect].filter(Boolean)) {
      assert.equal(avoidRects.some((avoidRect) => rectanglesIntersect(rectangle, avoidRect)), false,
        `${layout.slotId} overlaps a fixed scene rectangle`);
    }
    const snapshot = snapshots.find(({ slotId }) => slotId === layout.slotId);
    const stackBottom = Math.max(
      layout.labelRect.y + layout.labelRect.height,
      layout.statusRect.y + layout.statusRect.height,
    );
    assert.ok(stackBottom >= snapshot.headScreenY - 24,
      `${layout.slotId} label is detached from its actor head`);
  }
});

test("keeps the real 375px home labels compact beside the cabinet and boss body", () => {
  const scale = 375 / 1080;
  const homes = {
    boss: [540, 655],
    employee1: [280, 1120],
    employee2: [800, 1120],
    employee3: [300, 1520],
    employee4: [800, 1520],
  };
  const snapshots = Object.entries(homes).map(([slotId, [x, y]]) => ({
    slotId,
    visible: true,
    screenX: x * scale,
    screenY: y * scale,
    headScreenY: (y - 330) * scale,
    name: `${slotId}名字`,
    status: "空闲中",
    bubble: "",
  }));
  const geometry = overlayModule.buildOfficeSceneOverlayGeometry({
    sceneId: "office",
    renderer: { worldToScreen: ({ x, y }) => ({ x: x * scale, y: y * scale }) },
  });
  const avoidRects = [
    ...geometry.furnitureRects,
    ...overlayModule.buildOfficeActorBodyRects(snapshots),
  ];
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, {
    width: 375,
    height: 375 * (16 / 9),
    avoidRects,
  });

  for (const layout of layouts) {
    for (const rectangle of [layout.labelRect, layout.statusRect]) {
      assert.equal(avoidRects.some((avoidRect) => rectanglesIntersect(rectangle, avoidRect)), false,
        `${layout.slotId} label overlaps fixed geometry`);
    }
    const snapshot = snapshots.find(({ slotId }) => slotId === layout.slotId);
    const nameCenter = layout.labelRect.x + (layout.labelRect.width / 2);
    assert.ok(Math.abs(nameCenter - snapshot.screenX) <= 2,
      `${layout.slotId} label drifts too far from its head`);
  }
});

test("keeps adjacent whiteboard names centered and disjoint at mobile width", () => {
  const snapshots = [
    { slotId: "employee1", visible: true, screenX: 157, screenY: 355, headScreenY: 263, name: "小夏", status: "白板协作中", bubble: "" },
    { slotId: "employee2", visible: true, screenX: 226, screenY: 355, headScreenY: 263, name: "周屿", status: "白板协作中", bubble: "" },
  ];
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 375, height: 667 });

  assert.equal(layouts.length, 2);
  const rectangles = layouts.flatMap(({ labelRect, statusRect }) => [labelRect, statusRect]);
  rectangles.forEach((rectangle, index) => {
    assert.ok(rectangle);
    for (const other of rectangles.slice(index + 1)) {
      assert.equal(rectanglesIntersect(rectangle, other), false);
    }
  });
  layouts.forEach((layout, index) => {
    const nameCenter = layout.labelRect.x + (layout.labelRect.width / 2);
    assert.ok(Math.abs(nameCenter - snapshots[index].screenX) <= 2,
      `${snapshots[index].slotId} name is not centered above the actor`);
  });
});

test("moves a sofa conversation bubble above dining furniture without detaching the actor name", () => {
  const snapshot = {
    slotId: "employee2",
    visible: true,
    screenX: 210,
    screenY: 490,
    headScreenY: 364,
    name: "程雾",
    status: "沙发聊天中",
    bubble: "沙发组正在聊这部剧的剧情，不会串到午餐组。",
  };
  const diningTable = { id: "dining-table", x: 175, y: 250, width: 180, height: 62.5 };
  const pantryCounter = { id: "pantry-counter", x: 175, y: 334, width: 70, height: 26 };
  const [layout] = overlayModule.layoutOfficeActorOverlays([snapshot], {
    width: 720,
    height: 540,
    avoidRects: [diningTable, pantryCounter],
  });

  assert.equal(rectanglesIntersect(layout.bubbleRect, diningTable), false, JSON.stringify(layout));
  assert.equal(rectanglesIntersect(layout.labelRect, pantryCounter), false, JSON.stringify(layout));
  assert.ok(snapshot.headScreenY - (layout.labelRect.y + layout.labelRect.height) <= 30);
  assert.equal(rectanglesIntersect(layout.statusRect, pantryCounter), false, JSON.stringify(layout));
  assert.ok(snapshot.headScreenY - (layout.statusRect.y + layout.statusRect.height) <= 30.5,
    JSON.stringify(layout));
  assert.ok(snapshot.headScreenY - (layout.bubbleRect.y + layout.bubbleRect.height) <= 90);
});

test("stagger three adjacent sofa labels without overlapping either lounge conversation", () => {
  const snapshots = [
    {
      slotId: "boss",
      visible: true,
      screenX: 114,
      screenY: 270,
      headScreenY: 157,
      name: "沈知白",
      status: "餐桌聊天中",
      bubble: "午餐组只讨论今天的菜和下午安排。",
    },
    {
      slotId: "employee1",
      visible: true,
      screenX: 257,
      screenY: 270,
      headScreenY: 157,
      name: "周予安",
      status: "餐桌聊天中",
      bubble: "",
    },
    {
      slotId: "employee2",
      visible: true,
      screenX: 132,
      screenY: 523,
      headScreenY: 410,
      name: "顾南星",
      status: "沙发聊天中",
      bubble: "沙发组正在聊这部剧的剧情，不会串到午餐组。",
    },
    {
      slotId: "employee3",
      visible: true,
      screenX: 184,
      screenY: 523,
      headScreenY: 410,
      name: "许青禾",
      status: "喝饮料中",
      bubble: "",
    },
    {
      slotId: "employee4",
      visible: true,
      screenX: 236,
      screenY: 523,
      headScreenY: 410,
      name: "程雾",
      status: "沙发聊天中",
      bubble: "",
    },
  ];
  const avoidRects = [
    { id: "pantry", x: 31, y: 133, width: 308, height: 48 },
    { id: "dining-table", x: 89, y: 290, width: 191, height: 65 },
    { id: "sofa", x: 82, y: 536, width: 195, height: 45 },
    { id: "coffee-table", x: 144, y: 584, width: 112, height: 44 },
    { id: "television", x: 291, y: 519, width: 71, height: 48 },
  ];
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, {
    width: 375,
    height: 656,
    avoidRects,
  });
  const rectangles = layouts.flatMap(({ labelRect, statusRect, bubbleRect }) => (
    [labelRect, statusRect, bubbleRect].filter(Boolean)
  ));

  rectangles.forEach((rectangle, index) => {
    for (const other of rectangles.slice(index + 1)) {
      assert.equal(rectanglesIntersect(rectangle, other), false,
        `${JSON.stringify(rectangle)} overlaps ${JSON.stringify(other)}`);
    }
  });
  layouts.forEach((layout, index) => {
    const nameCenter = layout.labelRect.x + (layout.labelRect.width / 2);
    assert.ok(Math.abs(nameCenter - snapshots[index].screenX) <= 16);
    assert.ok(snapshots[index].headScreenY - (layout.labelRect.y + layout.labelRect.height) <= 30.5);
    assert.ok(snapshots[index].headScreenY - (layout.statusRect.y + layout.statusRect.height) <= 30.5);
  });
});

test("projects the door control onto the actual scene door at every aspect ratio", () => {
  assert.equal(typeof overlayModule.buildOfficeSceneOverlayGeometry, "function");
  const geometry = overlayModule.buildOfficeSceneOverlayGeometry({
    sceneId: "office",
    renderer: { worldToScreen: ({ x, y }) => ({ x: x / 2, y: y / 4 }) },
  });

  assert.deepEqual(geometry.doorPoint, { x: 480, y: 445 });
  assert.equal(geometry.furnitureRects.some(({ id }) => id === "office-door"), true);
  const doorRect = geometry.furnitureRects.find(({ id }) => id === "office-door");
  assert.deepEqual(doorRect, { id: "office-door", x: 437.5, y: 410, width: 85, height: 70 });
});

const rectanglesIntersect = (left, right) => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

test("keeps five top-edge bubble and label rectangles bounded and mutually disjoint", () => {
  const screenXs = [75, 195, 315, 105, 285];
  const snapshots = ["boss", "employee1", "employee2", "employee3", "employee4"].map((slotId, index) => ({
    slotId,
    visible: true,
    screenX: screenXs[index],
    screenY: 20,
    bubble: `${slotId}正在发言`,
  }));
  const first = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 500 });
  const second = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 500 });
  const rectangles = first.flatMap(({ labelRect, statusRect, bubbleRect }) => [labelRect, statusRect, bubbleRect]);

  assert.deepEqual(first, second);
  assert.equal(rectangles.length, 15);
  for (const layout of first) {
    assert.equal(rectanglesIntersect(layout.labelRect, layout.statusRect), false);
    assert.equal(rectanglesIntersect(layout.labelRect, layout.bubbleRect), false);
    assert.equal(rectanglesIntersect(layout.statusRect, layout.bubbleRect), false);
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
    bubble: index === 0 ? longCjk : index === 1 ? longDigits : "",
    facing: "front",
    sceneId: "office",
  }));
  const layouts = overlayModule.layoutOfficeActorOverlays(snapshots, { width: 390, height: 712 });
  const rectangles = layouts.flatMap(({ labelRect, statusRect, bubbleRect }) => [labelRect, statusRect, bubbleRect].filter(Boolean));

  assert.ok(overlayModule.measureOfficeOverlayText(snapshots[0]).bubbleHeight > 48);
  layouts.forEach((layout, index) => {
    const metrics = overlayModule.measureOfficeOverlayText(snapshots[index]);
    assert.equal(layout.bubbleRect?.height || 0, metrics.bubbleHeight);
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
  assert.equal((markup.match(/class="office-actor-label"/g) || []).length, 5);
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
    headScreenY: (entry.y / 4) - 82.5,
    worldX: entry.x,
    worldY: entry.y,
    clip: entry.id === "employee1" ? "locomotion" : "idle-standing",
    frameIndex: entry.id === "employee1" ? 3 : 0,
    moving: entry.id === "employee1",
  }));
  snapshots[0] = { ...snapshots[0], screenX: 2 };
  const markup = renderToStaticMarkup(React.createElement(overlayModule.OfficeActorOverlay, {
    snapshots,
    sceneId: "office",
  }));

  assert.equal((markup.match(/data-office-actor-overlay=/g) || []).length, 5);
  assert.match(markup, /data-world-x="260"/u);
  assert.match(markup, /data-world-y="780"/u);
  assert.match(markup, /data-screen-x=/u);
  assert.match(markup, /data-screen-y="195"/u);
  assert.match(markup, /data-head-screen-y="112.5"/u);
  assert.match(markup, /data-scene-id="office"/u);
  assert.match(markup, /data-motion-clip="locomotion"/u);
  assert.match(markup, /data-motion-frame="3"/u);
  assert.match(markup, /data-moving="true"/u);
  assert.match(markup, /aria-label="进入休息区"/u);
  assert.match(markup, /title="进入休息区"/u);
  assert.match(markup, /data-lucide="door-open"/u);
  assert.match(markup, /left:100px/u);
  assert.match(markup, /--office-bubble-shift-x:/u);
  assert.match(markup, /--office-status-shift-x:/u);
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
    localMotionFingerprint: Array.from({ length: 48 * 48 }, (_value, sample) => (
      ((index % distinctFrames) * 53 + sample * 7) % 256
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
  assert.equal(new Set(analysis.frames.map(({ localMotionFingerprint }) => (
    Array.from(localMotionFingerprint).join(",")
  ))).size, 1);
  assert.ok(analysis.frames.every(({ opaqueCoverage }) => opaqueCoverage > 0.3));
});

const create384LocomotionInspection = (variation) => {
  const geometry = {
    width: 384 * 8,
    height: 384,
    cellSize: 384,
    columns: 8,
    rows: 1,
    frameCount: 8,
  };
  const pixels = new Uint8ClampedArray(geometry.width * geometry.height * 4);
  const fill = (frame, x, y, width, height) => {
    for (let localY = y; localY < y + height; localY += 1) {
      for (let localX = x; localX < x + width; localX += 1) {
        const pixel = ((localY * geometry.width) + (frame * geometry.cellSize) + localX) * 4;
        pixels[pixel] = 92;
        pixels[pixel + 1] = 118;
        pixels[pixel + 2] = 146;
        pixels[pixel + 3] = 255;
      }
    }
  };
  const armOffsets = [0, 2, 5, 7, 9, 11, 14, 16];

  for (let frame = 0; frame < geometry.frameCount; frame += 1) {
    fill(frame, 144, 104, 96, 208);
    fill(frame, 136, 152 + (variation === "subtle-arm" ? armOffsets[frame] : 0), 8, 64);
    if (variation === "single-pixel") fill(frame, 20 + frame, 20, 1, 1);
  }
  return animationModule.analyzeOfficeAnimationPixels(pixels, geometry);
};

const inspectManifestWithLocomotion = (locomotionInspection) => (
  animationModule.inspectOfficeAnimationManifest(validManifest(), {
    baseUrl: "https://cdn.example/characters/manifest.json",
    inspectImage: async (_source, { strip: normalizedStrip }) => (
      normalizedStrip.family === "locomotion"
        ? locomotionInspection
        : meaningfulInspection(normalizedStrip)
    ),
  })
);

test("accepts an eight-pixel arm moving smoothly sixteen pixels across 384px frames", async () => {
  const result = await inspectManifestWithLocomotion(create384LocomotionInspection("subtle-arm"));
  assert.equal(result.ok, true);
});

test("still rejects copied 384px frames and per-frame single-pixel changes", async () => {
  for (const variation of ["copied", "single-pixel"]) {
    const result = await inspectManifestWithLocomotion(create384LocomotionInspection(variation));
    assert.deepEqual(result, { ok: false, reason: "invalid-clip-manifest", manifest: null });
  }
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
