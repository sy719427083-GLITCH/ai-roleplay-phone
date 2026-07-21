import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_ASSET_MANIFEST,
  OFFICE_CHIBIS,
  getActorClipSource,
} from "./officeAssetManifest.js";
import { OFFICE_ACTIVITY_MANIFEST } from "../officeActivityManifest.js";
import { OFFICE_SCENES } from "../officeSceneManifest.js";

if (!globalThis.navigator) Object.defineProperty(globalThis, "navigator", { value: {} });

const {
  createObjectOcclusion,
  createSprite,
  getActivityPropKey,
  getActivityPropStates,
  OfficeSceneView,
} = await import("./OfficeSceneView.js");
const {
  getActorTexturePlan,
  loadActorFrames,
  OfficeActorView,
} = await import("./OfficeActorView.js");
const { AnimatedSprite, Container, Rectangle, Texture } = await import("pixi.js");

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

class FakeSprite {
  constructor(texture) {
    this.texture = texture;
  }

  set texture(value) {
    this._texture = value;
    this.width = value?.width || 1;
    this.height = value?.height || 1;
  }

  get texture() {
    return this._texture;
  }
}

class FakeGraphics {
  rect(x, y, width, height) {
    this.rectangles ||= [];
    this.rectangles.push({ x, y, width, height });
    return this;
  }

  fill() {
    return this;
  }
}

class FakeRectangle {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
}

class FakeTexture {
  constructor(options) {
    Object.assign(this, options);
  }
}

FakeTexture.EMPTY = { width: 1, height: 1 };

const createRuntime = (load) => ({
  Assets: { load },
  Graphics: FakeGraphics,
  Rectangle: FakeRectangle,
  Sprite: FakeSprite,
  Texture: FakeTexture,
});

const createActorRuntime = (load) => ({
  AnimatedSprite,
  Assets: { load },
  Rectangle,
  Texture,
});

test("resolves actor clips exclusively from the body-only character tree", () => {
  const clip = getActorClipSource({ characterId: "employee-f-01" }, "working");

  assert.equal(clip.src, "/work-office-v2/characters/employee-f-01/working.webp");
  assert.equal(clip.bodyOnly, true);
  assert.equal(clip.frameCount, 4);
});

test("resolves validated custom locomotion and action fallbacks into Pixi strips", () => {
  const customStrip = (src, frameCount = 8) => ({
    src,
    width: 384 * frameCount,
    height: 384,
    cellSize: 384,
    columns: frameCount,
    rows: 1,
    frameCount,
    fps: 9,
    loop: true,
    legalFacings: ["front"],
  });
  const actor = {
    characterId: "employee-f-01",
    animationManifest: {
      clips: {
        locomotion: {
          front: customStrip("https://cdn.example/walk-front.webp"),
          back: customStrip("https://cdn.example/walk-back.webp"),
          left: customStrip("https://cdn.example/walk-left.webp"),
          right: customStrip("https://cdn.example/walk-right.webp"),
        },
        idle: customStrip("https://cdn.example/idle.webp", 4),
        action: customStrip("https://cdn.example/action.webp", 4),
      },
    },
  };

  assert.equal(getActorClipSource(actor, "locomotion", "left").src, "https://cdn.example/walk-left.webp");
  assert.equal(getActorClipSource(actor, "idle-standing", "front").src, "https://cdn.example/idle.webp");
  assert.equal(getActorClipSource(actor, "working", "right").src, "https://cdn.example/action.webp");
});

test("keeps the four employee desk instances on one furniture alias", () => {
  const desks = OFFICE_SCENES.office.objects.filter(({ templateId }) => templateId === "employee-desk");

  assert.equal(desks.length, 4);
  assert.equal(new Set(desks.map(({ assetId }) => assetId)).size, 1);
  assert.equal(new Set(OFFICE_CHIBIS.map(({ src }) => src)).size, 16);
  assert.equal(OFFICE_CHIBIS.every(({ src }) => /\/work-office-v2\/characters\/[\w-]+\/idle-standing\.webp$/.test(src)), true);
});

test("anchors simultaneous diners to their individual dining surfaces with unique prop keys", () => {
  const states = getActivityPropStates([
    { slotId: "employee1", sceneId: "office", activity: "working" },
    { slotId: "employee2", sceneId: "lounge", activity: "eating", anchorId: "dining:seat-1" },
    { slotId: "employee3", sceneId: "lounge", activity: "eating", anchorId: "dining-seat-2" },
    { slotId: "employee3", sceneId: "lounge", activity: "watching-tv" },
    { slotId: "employee4", sceneId: "office", activity: "desk-rest" },
  ]);

  assert.deepEqual(states.map(({ sceneId, objectId, anchorId }) => ({ sceneId, objectId, anchorId })), [
    { sceneId: "office", objectId: "employee1-desk", anchorId: "surface" },
    { sceneId: "lounge", objectId: "dining-table", anchorId: "seat-1:surface" },
    { sceneId: "lounge", objectId: "dining-table", anchorId: "seat-2:surface" },
    { sceneId: "lounge", objectId: "television", anchorId: "screen" },
    { sceneId: "office", objectId: "employee4-desk", anchorId: "surface" },
  ]);
  assert.deepEqual(states[1].propIds, ["meal-tray", "food-plate", "utensils"]);
  assert.deepEqual(states[3].propIds, ["television-content"]);
  assert.notEqual(getActivityPropKey(states[1], "meal-tray"), getActivityPropKey(states[2], "meal-tray"));
});

test("keeps dining and sofa conversation props on existing lounge furniture", () => {
  const states = getActivityPropStates([
    { slotId: "employee1", sceneId: "lounge", activity: "dining-chat", anchorId: "dining:seat-1" },
    { slotId: "employee2", sceneId: "lounge", activity: "dining-listen", anchorId: "dining:seat-2" },
    { slotId: "employee3", sceneId: "lounge", activity: "sofa-chat", anchorId: "sofa:seat-1" },
    { slotId: "employee4", sceneId: "lounge", activity: "sofa-listen", anchorId: "sofa:seat-3" },
  ]);

  assert.deepEqual(states.map(({ sceneId, objectId, anchorId }) => ({ sceneId, objectId, anchorId })), [
    { sceneId: "lounge", objectId: "dining-table", anchorId: "seat-1:surface" },
    { sceneId: "lounge", objectId: "dining-table", anchorId: "seat-2:surface" },
    { sceneId: "lounge", objectId: "coffee-table", anchorId: "surface-left" },
    { sceneId: "lounge", objectId: "coffee-table", anchorId: "surface-right" },
  ]);
  assert.deepEqual(states[0].propIds, ["meal-tray", "food-plate", "utensils"]);
  assert.deepEqual(states[2].propIds, ["coffee-cup"]);
  assert.equal(states.every(({ sceneId, objectId }) => OFFICE_SCENES[sceneId].objects.some((object) => object.id === objectId)), true);
});

test("resolves every manifest prop variant onto existing furniture without generating furniture", () => {
  const manifestEntries = Object.values(OFFICE_ACTIVITY_MANIFEST);
  assert.equal(manifestEntries.length, 32);

  for (const definition of manifestEntries) {
    const slotId = definition.requiredActorIds?.[0] || "employee1";
    const templateAnchor = definition.targetAnchors[0];
    const anchorId = templateAnchor.startsWith("$actor:")
      ? `${slotId}:${templateAnchor.slice(7)}`
      : templateAnchor;
    const variants = definition.propState.variants.length ? definition.propState.variants : [""];

    for (const variant of variants) {
      const [state] = getActivityPropStates([{
        slotId,
        sceneId: definition.sceneId,
        activityId: definition.id,
        activity: "deliberately-not-a-clip-lookup",
        anchorId,
        propState: { category: definition.propState.category, variant },
      }]);

      assert.ok(state, `${definition.id}:${variant || "empty"} did not resolve a visual attachment`);
      assert.equal(state.activityId, definition.id);
      assert.equal(state.sceneId, definition.sceneId);
      assert.ok(OFFICE_SCENES[state.sceneId].objects.some(({ id }) => id === state.objectId), `${definition.id}:${variant} is not attached to scene furniture`);
      assert.deepEqual(state.generatedFurnitureIds, [], `${definition.id}:${variant} generated duplicate furniture`);
      assert.equal(state.props.length, state.propIds.length, `${definition.id}:${variant} prop layout count mismatch`);
      assert.equal(state.props.every(({ propId, width, height }) => (
        Boolean(OFFICE_ASSET_MANIFEST.props[propId]) && width >= 40 && height >= 24
      )), true, `${definition.id}:${variant} did not resolve existing high-resolution props`);
      if (variant !== "none") {
        assert.ok(state.propIds.length > 0, `${definition.id}:${variant} dropped a required visible prop`);
      }
    }
  }
});

test("maps concrete work and lounge semantics to distinct existing high-resolution props", () => {
  const cases = [
    ["reading", "book", "hardcover", "employee1:seat-approach", "book"],
    ["working", "computer", "laptop", "employee1:seat-approach", "laptop"],
    ["watchingSeries", "screen", "tablet", "employee1:seat-approach", "tablet"],
    ["watchingShortVideo", "phone", "phone-portrait-light", "employee1:seat-approach", "phone"],
    ["gaming", "game", "handheld", "employee1:seat-approach", "game-device"],
    ["printing", "documents", "printout", "printer:front", "printer-paper"],
    ["whiteboardWork", "whiteboard", "marker", "whiteboard:1", "sticky-notes"],
    ["parcelReceive", "parcel", "parcel", "delivery", "delivery-parcel"],
    ["eating", "meal", "bento", "dining:seat-1", "meal-tray"],
    ["drinking", "drink", "water", "sofa:seat-2", "water-cup"],
    ["watchingTv", "television", "show", "tv:view", "television-content"],
    ["sofaChat", "conversation", "coffee", "sofa:visitor-2", "coffee-cup"],
  ];

  for (const [activityId, category, variant, anchorId, expectedPropId] of cases) {
    const [state] = getActivityPropStates([{
      slotId: "employee1",
      sceneId: OFFICE_ACTIVITY_MANIFEST[activityId].sceneId,
      activityId,
      activity: "irrelevant-clip",
      anchorId,
      propState: { category, variant },
    }]);
    assert.ok(state.propIds.includes(expectedPropId), `${activityId}:${variant} is missing ${expectedPropId}`);
  }
});

test("keeps sofa drinks on separate table positions and uses the integrated sofa cushion", () => {
  const states = getActivityPropStates([
    { slotId: "employee1", sceneId: "lounge", activityId: "sofaChat", anchorId: "sofa:seat-1", propState: { category: "conversation", variant: "coffee" } },
    { slotId: "employee2", sceneId: "lounge", activityId: "drinking", anchorId: "sofa:seat-2", propState: { category: "drink", variant: "water" } },
    { slotId: "employee3", sceneId: "lounge", activityId: "sofaChat", anchorId: "sofa:seat-3", propState: { category: "conversation", variant: "coffee" } },
    { slotId: "employee4", sceneId: "lounge", activityId: "sofaRest", anchorId: "sofa:seat-2", propState: { category: "rest", variant: "none" } },
  ]);

  assert.deepEqual(states.map(({ anchorId }) => anchorId), ["surface-left", "surface-center", "surface-right", "seat"]);
  assert.deepEqual(states.map(({ propIds }) => propIds), [["coffee-cup"], ["water-cup"], ["coffee-cup"], []]);
});

test("keeps real coffee and water break activities on their own pantry positions", () => {
  const states = getActivityPropStates([
    { slotId: "employee1", sceneId: "lounge", activityId: "coffeeBreak", anchorId: "pantry:coffee", propState: { category: "drink", variant: "coffee" } },
    { slotId: "employee2", sceneId: "lounge", activityId: "waterBreak", anchorId: "pantry:water", propState: { category: "drink", variant: "water" } },
  ]);

  assert.deepEqual(states.map(({ anchorId }) => anchorId), ["counter-coffee", "counter-water"]);
  assert.notEqual(getActivityPropKey(states[0], "coffee-cup"), getActivityPropKey(states[1], "water-cup"));
});

test("preserves requested sprite layout after asynchronous texture replacement", async () => {
  const loaded = deferred();
  const sprite = createSprite("/scene.webp", { x: 12, y: 34, width: 1080, height: 1920 }, {
    runtime: createRuntime(() => loaded.promise),
  });

  loaded.resolve({ width: 4096, height: 1024 });
  await settle();

  assert.deepEqual(
    { x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height },
    { x: 12, y: 34, width: 1080, height: 1920 },
  );
});

test("uses each furniture front-edge mask to order behind and in-front actors", () => {
  const desk = OFFICE_SCENES.office.objects.find(({ id }) => id === "employee1-desk");
  const frontSprite = new FakeSprite({ width: 1, height: 1 });
  const occlusion = createObjectOcclusion(desk, frontSprite, { runtime: createRuntime(async () => ({ width: 1, height: 1 })) });
  const behindActor = { zIndex: occlusion.frontEdgeY - 1 };
  const inFrontActor = { zIndex: occlusion.frontEdgeY + 1 };

  assert.equal(frontSprite.mask, occlusion.mask);
  assert.deepEqual(occlusion.mask.rectangles, desk.colliders);
  assert.equal(behindActor.zIndex < frontSprite.zIndex, true);
  assert.equal(inFrontActor.zIndex > frontSprite.zIndex, true);
});

test("uses visual occlusion rectangles for seated dining and sofa actors without changing colliders", () => {
  for (const objectId of ["dining-table", "sofa"]) {
    const object = OFFICE_SCENES.lounge.objects.find(({ id }) => id === objectId);
    const frontSprite = new FakeSprite({ width: 1, height: 1 });
    const occlusion = createObjectOcclusion(object, frontSprite, {
      runtime: createRuntime(async () => ({ width: 1, height: 1 })),
    });

    assert.ok(Array.isArray(object.occlusionRects) && object.occlusionRects.length > 0, `${objectId} visual mask`);
    assert.deepEqual(occlusion.mask.rectangles, object.occlusionRects);
    assert.notDeepEqual(object.occlusionRects, object.colliders);
    assert.ok(object.occlusionRects[0].y < object.colliders[0].y, `${objectId} must cover the seated lower body`);
  }
});

test("builds one object mask from every collider while preserving single-collider desks", () => {
  const door = OFFICE_SCENES.office.objects.find(({ id }) => id === "office-door");
  const desk = OFFICE_SCENES.office.objects.find(({ id }) => id === "employee1-desk");
  const doorSprite = new FakeSprite({ width: 1, height: 1 });
  const deskSprite = new FakeSprite({ width: 1, height: 1 });
  const runtime = { runtime: createRuntime(async () => ({ width: 1, height: 1 })) };
  const doorOcclusion = createObjectOcclusion(door, doorSprite, runtime);
  const deskOcclusion = createObjectOcclusion(desk, deskSprite, runtime);

  assert.deepEqual(doorOcclusion.mask.rectangles, door.colliders);
  assert.deepEqual(doorOcclusion.bounds, { x: 875, y: 1640, width: 170, height: 280 });
  assert.equal(doorSprite.mask, doorOcclusion.mask);
  assert.deepEqual(deskOcclusion.mask.rectangles, desk.colliders);
  assert.deepEqual(deskOcclusion.bounds, desk.colliders[0]);
});

test("normalizes legacy navigation facings while preserving canonical rows and side-action mirroring", async () => {
  const locomotion = getActorClipSource({ characterId: "employee-f-01" }, "locomotion");
  const sideAction = getActorClipSource({ characterId: "employee-f-01" }, "phone-call");
  const loaded = deferred();
  let loadCount = 0;
  const view = new OfficeActorView({
    runtime: createActorRuntime(() => {
      loadCount += 1;
      return loaded.promise;
    }),
  });
  const actor = { id: "employee1", characterId: "employee-f-01" };

  assert.deepEqual(getActorTexturePlan(locomotion, "up"), { row: 3, scaleX: 1 });
  assert.deepEqual(getActorTexturePlan(locomotion, "back"), { row: 3, scaleX: 1 });
  assert.deepEqual(getActorTexturePlan(locomotion, "down"), { row: 0, scaleX: 1 });
  assert.deepEqual(getActorTexturePlan(locomotion, "front"), { row: 0, scaleX: 1 });
  assert.deepEqual(getActorTexturePlan(locomotion, "left"), { row: 1, scaleX: 1 });
  assert.deepEqual(getActorTexturePlan(locomotion, "right"), { row: 2, scaleX: 1 });
  assert.deepEqual(getActorTexturePlan(sideAction, "left"), { row: 0, scaleX: -1 });
  assert.deepEqual(getActorTexturePlan(sideAction, "right"), { row: 0, scaleX: 1 });

  view.sync({ actor, clip: "locomotion", motion: { facing: "up" } });
  view.sync({ actor, clip: "locomotion", motion: { facing: "back" } });
  loaded.resolve({ source: Texture.EMPTY.source });
  await settle();

  assert.equal(view.source.facing, "back");
  assert.equal(loadCount, 1);
});

test("registers actor strips only after their texture load succeeds", async () => {
  const loaded = deferred();
  const registrations = [];
  const actorSprite = { textures: [], gotoAndStop() {} };
  const source = getActorClipSource({ characterId: "employee-f-01" }, "working");

  loadActorFrames({
    runtime: createRuntime(() => loaded.promise),
    source,
    facing: "front",
    frameIndex: 0,
    actorSprite,
    onLoaded: () => registrations.push(source.src),
  });
  assert.deepEqual(registrations, []);
  loaded.resolve({ source: {} });
  await settle();

  assert.deepEqual(registrations, [source.src]);
});

test("ignores a stale actor texture completion after a newer clip has loaded", async () => {
  const first = deferred();
  const second = deferred();
  const requests = [first, second];
  const registrations = [];
  const runtime = createActorRuntime(() => requests.shift().promise);
  const view = new OfficeActorView({
    runtime,
    registerLoadedActionStrip: (src) => registrations.push(src),
  });
  const actor = { id: "employee1", characterId: "employee-f-01" };
  const firstSource = getActorClipSource(actor, "working");
  const secondSource = getActorClipSource(actor, "slacking");

  view.sync({ actor, clip: "working" });
  view.sync({ actor, clip: "slacking" });
  second.resolve({ source: Texture.EMPTY.source });
  await settle();
  const winningTextures = view.actorSprite.textures;
  first.resolve({ source: Texture.EMPTY.source });
  await settle();

  assert.equal(view.actorSprite.textures, winningTextures);
  assert.deepEqual(registrations, [secondSource.src]);
  assert.equal(registrations.includes(firstSource.src), false);
});

test("reloads the same source and facing when its complete texture geometry changes", async () => {
  const first = deferred();
  const second = deferred();
  const requests = [first, second];
  let loadCount = 0;
  const runtime = createActorRuntime(() => {
    loadCount += 1;
    return requests.shift().promise;
  });
  const view = new OfficeActorView({ runtime });
  const customStrip = (frameCount, columns) => ({
    src: "https://cdn.example/shared-action.webp",
    width: 384 * columns,
    height: 384,
    cellSize: 384,
    columns,
    rows: 1,
    frameCount,
    fps: 9,
    loop: true,
    legalFacings: ["front"],
  });
  const actor = {
    id: "employee1",
    characterId: "employee-f-01",
    animationManifest: { clips: { actions: { working: customStrip(4, 4) } } },
  };

  view.sync({ actor, clip: "working", frameIndex: 3 });
  actor.animationManifest = { clips: { actions: { working: customStrip(6, 6) } } };
  view.sync({ actor, clip: "working", frameIndex: 5 });
  first.resolve({ source: Texture.EMPTY.source });
  await settle();
  second.resolve({ source: Texture.EMPTY.source });
  await settle();

  assert.equal(loadCount, 2);
  assert.equal(view.actorSprite.textures.length, 6);
  assert.equal(view.actorSprite.currentFrame, 5);
});

test("retries the same actor clip after its previous texture load fails", async () => {
  const first = deferred();
  const second = deferred();
  const requests = [first, second];
  const registrations = [];
  const runtime = createActorRuntime(() => requests.shift().promise);
  const view = new OfficeActorView({
    runtime,
    registerLoadedActionStrip: (src) => registrations.push(src),
  });
  const actor = { id: "employee1", characterId: "employee-f-01" };
  const source = getActorClipSource(actor, "working");

  view.sync({ actor, clip: "working" });
  first.reject(new Error("first request failed"));
  await settle();
  view.sync({ actor, clip: "working" });
  second.resolve({ source: Texture.EMPTY.source });
  await settle();

  assert.equal(view.source?.state, "loaded");
  assert.equal(view.actorSprite.textures.length, source.frameCount);
  assert.deepEqual(registrations, [source.src]);
});

test("applies the latest frame index when a pending actor clip resolves", async () => {
  const loaded = deferred();
  let loadCount = 0;
  const runtime = createActorRuntime(() => {
    loadCount += 1;
    return loaded.promise;
  });
  const view = new OfficeActorView({ runtime });
  const actor = { id: "employee1", characterId: "employee-f-01" };

  view.sync({ actor, clip: "working", frameIndex: 0 });
  view.sync({ actor, clip: "working", frameIndex: 3 });
  loaded.resolve({ source: Texture.EMPTY.source });
  await settle();

  assert.equal(loadCount, 1);
  assert.equal(view.actorSprite.currentFrame, 3);
});

test("forwards its injected Pixi runtime to child actor views", () => {
  const injectedRuntime = { id: "scene-runtime" };
  const received = [];
  class TestSceneView extends OfficeSceneView {
    createFurniture() {}
  }
  class RecordingActorView extends Container {
    constructor(options) {
      super();
      received.push(options);
    }

    sync() {}
  }
  const view = new TestSceneView("office", { runtime: injectedRuntime, ActorView: RecordingActorView });

  view.syncActors([{ id: "employee1" }]);

  assert.equal(received[0].runtime, injectedRuntime);
});

test("reports actor and scene asset failures with their source context", async () => {
  const errors = [];
  const onAssetError = (error) => errors.push(error);
  const rejectedRuntime = createRuntime(() => Promise.reject(new Error("offline")));
  const actorSprite = { textures: [], gotoAndStop() {} };

  createSprite("/broken-scene.webp", { x: 0, y: 0, width: 10, height: 10 }, {
    runtime: rejectedRuntime,
    onAssetError,
    context: { kind: "environment", sceneId: "office" },
  });
  createSprite("/broken-prop.webp", { x: 0, y: 0, width: 10, height: 10 }, {
    runtime: rejectedRuntime,
    onAssetError,
    context: { kind: "prop", sceneId: "lounge", propId: "meal-tray" },
  });
  loadActorFrames({
    runtime: rejectedRuntime,
    source: getActorClipSource({ characterId: "employee-f-01" }, "working"),
    facing: "front",
    frameIndex: 0,
    actorSprite,
    onAssetError,
    context: { kind: "actor", actorId: "employee1" },
  });
  await settle();

  assert.deepEqual(errors.map(({ context }) => context), [
    { kind: "environment", sceneId: "office", source: "/broken-scene.webp" },
    { kind: "prop", sceneId: "lounge", propId: "meal-tray", source: "/broken-prop.webp" },
    { kind: "actor", actorId: "employee1", source: "/work-office-v2/characters/employee-f-01/working.webp" },
  ]);
});
