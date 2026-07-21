import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { OFFICE_SCENES } from "../officeSceneManifest.js";
import { OFFICE_ASSET_MANIFEST } from "./officeAssetManifest.js";
import { OfficeActorView } from "./OfficeActorView.js";

const PIXI_RUNTIME = Object.freeze({ AnimatedSprite, Assets, Graphics, Rectangle, Sprite, Texture });
const LEGACY_ACTIVITY_STATES = Object.freeze({
  working: Object.freeze({ activityId: "working", category: "computer", variant: "laptop" }),
  "desk-rest": Object.freeze({ activityId: "deskRest", category: "rest", variant: "eye-mask" }),
  eating: Object.freeze({ activityId: "eating", category: "meal", variant: "bento" }),
  "watching-tv": Object.freeze({ activityId: "watchingTv", category: "television", variant: "show" }),
  "dining-chat": Object.freeze({ activityId: "diningChat", category: "conversation", variant: "meal" }),
  "dining-listen": Object.freeze({ activityId: "diningChat", category: "conversation", variant: "meal" }),
  "sofa-chat": Object.freeze({ activityId: "sofaChat", category: "conversation", variant: "coffee" }),
  "sofa-listen": Object.freeze({ activityId: "sofaChat", category: "conversation", variant: "coffee" }),
});

const PROP_IDS_BY_VARIANT = Object.freeze({
  computer: Object.freeze({
    laptop: ["laptop", "keyboard", "files-documents"],
    monitor: ["laptop", "keyboard", "files-documents"],
    keyboard: ["laptop", "keyboard"],
    mouse: ["laptop", "keyboard"],
  }),
  leisure: Object.freeze({ phone: ["phone"], comic: ["book"], handheld: ["game-device"] }),
  game: Object.freeze({ handheld: ["game-device"], keyboard: ["game-device", "keyboard"] }),
  book: Object.freeze({ paperback: ["book"], hardcover: ["book"], magazine: ["book"] }),
  screen: Object.freeze({ tablet: ["tablet"], "phone-landscape": ["phone"], "shared-screen": ["laptop", "keyboard"] }),
  phone: Object.freeze({ phone: ["phone"], "phone-portrait-light": ["phone"], "phone-portrait-dark": ["phone"] }),
  meeting: Object.freeze({ camera: ["laptop", "headphones"], monitor: ["laptop", "headphones"] }),
  training: Object.freeze({ "slide-deck": ["tablet", "headphones"] }),
  stationery: Object.freeze({
    "sticky-notes": ["sticky-notes", "pen"],
    marker: ["sticky-notes", "pen"],
    folders: ["files-documents", "desk-organizer"],
    wipes: ["cleaning-cloth", "desk-organizer"],
  }),
  rest: Object.freeze({ "eye-mask": ["headphones"], cushion: [], none: [] }),
  documents: Object.freeze({
    printout: ["printer-paper"],
    folder: ["files-documents"],
    contract: ["files-documents", "pen"],
    pen: ["files-documents", "pen"],
  }),
  whiteboard: Object.freeze({ marker: ["sticky-notes", "pen"], "sticky-notes": ["sticky-notes", "pen"] }),
  report: Object.freeze({ report: ["files-documents"] }),
  parcel: Object.freeze({ parcel: ["delivery-parcel"] }),
  exercise: Object.freeze({ none: [] }),
  meal: Object.freeze({
    bento: ["meal-tray", "food-plate", "utensils"],
    rice: ["meal-tray", "food-plate", "utensils"],
    noodles: ["meal-tray", "food-plate", "utensils"],
    sandwich: ["meal-tray", "food-plate", "utensils"],
  }),
  drink: Object.freeze({ coffee: ["coffee-cup"], water: ["water-cup"] }),
  television: Object.freeze({ news: ["television-content"], show: ["television-content"] }),
  conversation: Object.freeze({
    meal: ["meal-tray", "food-plate", "utensils"],
    coffee: ["coffee-cup"],
    project: ["files-documents", "sticky-notes"],
    lunch: ["coffee-cup"],
    weekend: ["coffee-cup"],
  }),
  none: Object.freeze({ "": [], none: [] }),
});

const PROP_LAYOUTS = Object.freeze({
  book: Object.freeze({ offsetX: 0, offsetY: 2, width: 112, height: 82 }),
  "cleaning-cloth": Object.freeze({ offsetX: 34, offsetY: 16, width: 70, height: 58 }),
  "coffee-cup": Object.freeze({ offsetX: 0, offsetY: 0, width: 58, height: 68 }),
  "delivery-parcel": Object.freeze({ offsetX: 0, offsetY: 0, width: 118, height: 108 }),
  "desk-organizer": Object.freeze({ offsetX: -42, offsetY: 5, width: 76, height: 76 }),
  "files-documents": Object.freeze({ offsetX: -58, offsetY: 22, width: 96, height: 72 }),
  "food-plate": Object.freeze({ offsetX: 0, offsetY: -5, width: 92, height: 74 }),
  "game-device": Object.freeze({ offsetX: 0, offsetY: 8, width: 94, height: 68 }),
  headphones: Object.freeze({ offsetX: 48, offsetY: 4, width: 74, height: 68 }),
  keyboard: Object.freeze({ offsetX: 32, offsetY: 34, width: 104, height: 48 }),
  laptop: Object.freeze({ offsetX: 8, offsetY: -18, width: 132, height: 96 }),
  "meal-tray": Object.freeze({ offsetX: 0, offsetY: 8, width: 150, height: 104 }),
  pen: Object.freeze({ offsetX: 50, offsetY: 28, width: 62, height: 28 }),
  phone: Object.freeze({ offsetX: 0, offsetY: 8, width: 62, height: 76 }),
  "printer-paper": Object.freeze({ offsetX: 0, offsetY: 5, width: 94, height: 70 }),
  "sticky-notes": Object.freeze({ offsetX: -34, offsetY: -5, width: 82, height: 76 }),
  tablet: Object.freeze({ offsetX: 0, offsetY: 0, width: 112, height: 82 }),
  "television-content": Object.freeze({ offsetX: 0, offsetY: -8, width: 154, height: 102 }),
  utensils: Object.freeze({ offsetX: 54, offsetY: 24, width: 70, height: 30 }),
  "water-cup": Object.freeze({ offsetX: 0, offsetY: 0, width: 54, height: 72 }),
});

const FRONT_MOUNT_OBJECTS = new Set(["file-cabinet", "office-door", "pantry", "printer", "television", "whiteboard"]);

const getDeskObjectId = (slotId) => (slotId === "boss" ? "boss-desk" : `${slotId}-desk`);

const reportAssetError = (onAssetError, context, error) => {
  if (!onAssetError) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  failure.context = { ...context, source: context.source };
  onAssetError(failure);
};

const normalizeDiningSurface = (anchorId) => {
  const match = String(anchorId || "").toLowerCase().match(/seat[^0-9]*([1-4])/);
  return `seat-${match?.[1] || "1"}:surface`;
};

const getFurnitureAnchor = (object, anchorId) => {
  const x = object.x + (object.width / 2);
  const y = object.y + (object.height / 2);
  if (anchorId === "screen") return { x, y: object.y + (object.height * 0.35) };
  if (anchorId === "counter") return { x, y: object.y + (object.height * 0.56) };
  if (anchorId === "counter-coffee") return { x: object.x + (object.width * 0.5), y: object.y + (object.height * 0.56) };
  if (anchorId === "counter-water") return { x: object.x + (object.width * 0.745), y: object.y + (object.height * 0.56) };
  if (anchorId === "surface-left") return { x: object.x + (object.width * 0.2), y: object.y + (object.height * 0.35) };
  if (anchorId === "surface-center") return { x, y: object.y + (object.height * 0.35) };
  if (anchorId === "surface-right") return { x: object.x + (object.width * 0.8), y: object.y + (object.height * 0.35) };
  const seat = String(anchorId).match(/seat-([1-4])/)?.[1];
  if (seat) {
    const column = ["1", "3"].includes(seat) ? 0.2 : 0.8;
    const row = ["1", "2"].includes(seat) ? 0.3 : 0.7;
    return { x: object.x + (object.width * column), y: object.y + (object.height * row) };
  }
  return { x, y: object.y + (object.height * 0.35) };
};

const getDeskObjectFromAnchor = (anchorId, slotId) => {
  const ownerId = String(anchorId || "").match(/^(boss|employee[1-4]):/u)?.[1] || slotId;
  return getDeskObjectId(ownerId);
};

const getPropMount = (state, activityId) => {
  const anchorId = String(state.anchorId || "");
  if (activityId === "drinking") return { objectId: "coffee-table", anchorId: "surface-center" };
  if (activityId === "sofaChat") {
    const side = /seat-3$/u.test(anchorId) ? "right" : "left";
    return { objectId: "coffee-table", anchorId: `surface-${side}` };
  }
  if (["diningChat", "eating"].includes(activityId) || /^dining(?::|-)/u.test(anchorId)) {
    return { objectId: "dining-table", anchorId: normalizeDiningSurface(anchorId) };
  }
  if (activityId === "watchingTv") return { objectId: "television", anchorId: "screen" };
  if (anchorId === "pantry:coffee") return { objectId: "pantry", anchorId: "counter-coffee" };
  if (anchorId === "pantry:water") return { objectId: "pantry", anchorId: "counter-water" };
  if (/^pantry:/u.test(anchorId)) return { objectId: "pantry", anchorId: "counter" };
  if (/^printer:/u.test(anchorId)) return { objectId: "printer", anchorId: "output" };
  if (/^file-cabinet:/u.test(anchorId)) return { objectId: "file-cabinet", anchorId: "front" };
  if (/^whiteboard:/u.test(anchorId)) return { objectId: "whiteboard", anchorId: "board" };
  if (anchorId === "delivery") return { objectId: "office-door", anchorId: "parcel" };
  if (anchorId === "tv:view") return { objectId: "television", anchorId: "screen" };
  if (/^sofa:/u.test(anchorId)) return { objectId: "sofa", anchorId: "seat" };
  return { objectId: getDeskObjectFromAnchor(anchorId, state.slotId), anchorId: "surface" };
};

const getResolvedPropState = (state) => {
  const legacy = LEGACY_ACTIVITY_STATES[state?.activity] || {};
  return {
    activityId: String(state?.activityId || legacy.activityId || state?.activity || ""),
    category: String(state?.propState?.category || legacy.category || "none"),
    variant: String(state?.propState?.variant ?? legacy.variant ?? ""),
  };
};

export function getActivityPropStates(activityStates = []) {
  return activityStates.flatMap((state) => {
    if (!state?.slotId) return [];
    const resolved = getResolvedPropState(state);
    const propIds = PROP_IDS_BY_VARIANT[resolved.category]?.[resolved.variant];
    if (!propIds) return [];
    const mount = getPropMount(state, resolved.activityId);
    const objectExists = OFFICE_SCENES[state.sceneId]?.objects.some(({ id }) => id === mount.objectId);
    if (!objectExists) return [];
    return [{
      slotId: state.slotId,
      sceneId: state.sceneId,
      activityId: resolved.activityId,
      category: resolved.category,
      variant: resolved.variant,
      objectId: mount.objectId,
      anchorId: mount.anchorId,
      propIds: [...propIds],
      props: propIds.map((propId) => ({ propId, ...PROP_LAYOUTS[propId] })),
      layer: FRONT_MOUNT_OBJECTS.has(mount.objectId) ? "front" : "surface",
      generatedFurnitureIds: [],
    }];
  });
}

export const getActivityPropKey = (state, propId) => `${state.objectId}:${state.anchorId}:${state.slotId}:${propId}`;

export const applySpriteLayout = (sprite, { x, y, width, height }) => {
  sprite.x = x;
  sprite.y = y;
  sprite.width = width;
  sprite.height = height;
};

export function createSprite(src, layout, {
  runtime = PIXI_RUNTIME,
  onAssetError,
  context = {},
} = {}) {
  const sprite = new runtime.Sprite(runtime.Texture.EMPTY);
  applySpriteLayout(sprite, layout);
  void runtime.Assets.load(src).then((texture) => {
    sprite.texture = texture;
    applySpriteLayout(sprite, layout);
  }).catch((error) => reportAssetError(onAssetError, { ...context, source: src }, error));
  return sprite;
}

const getObjectOcclusionRectangles = (object) => object.occlusionRects?.length
  ? object.occlusionRects.map(({ x, y, width, height }) => ({ x, y, width, height }))
  : object.colliders?.length
    ? object.colliders.map(({ x, y, width, height }) => ({ x, y, width, height }))
  : [{ x: object.x, y: object.y + (object.height * 0.4), width: object.width, height: object.height * 0.6 }];

export const getObjectOcclusionBounds = (object) => {
  const rectangles = getObjectOcclusionRectangles(object);
  const left = Math.min(...rectangles.map(({ x }) => x));
  const top = Math.min(...rectangles.map(({ y }) => y));
  const right = Math.max(...rectangles.map(({ x, width }) => x + width));
  const bottom = Math.max(...rectangles.map(({ y, height }) => y + height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export function createObjectOcclusion(object, frontSprite, { runtime = PIXI_RUNTIME } = {}) {
  const rectangles = getObjectOcclusionRectangles(object);
  const bounds = getObjectOcclusionBounds(object);
  const mask = new runtime.Graphics();
  for (const rectangle of rectangles) mask.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  mask.fill({ color: 0xffffff });
  const frontEdgeY = Math.max(...rectangles.map(({ y, height }) => y + height));
  frontSprite.mask = mask;
  frontSprite.zIndex = frontEdgeY;
  return { mask, bounds, rectangles, frontEdgeY, frontSprite };
}

export class OfficeSceneView extends Container {
  constructor(sceneId, {
    registerLoadedActionStrip,
    onAssetError,
    runtime = PIXI_RUNTIME,
    ActorView = OfficeActorView,
  } = {}) {
    super();
    this.sceneId = sceneId;
    this.eventMode = "none";
    this.snapshot = null;
    this.registerLoadedActionStrip = registerLoadedActionStrip;
    this.onAssetError = onAssetError;
    this.runtime = runtime;
    this.ActorView = ActorView;
    this.background = new Container();
    this.rearFurniture = new Container();
    this.depthLayer = new Container();
    this.depthLayer.sortableChildren = true;
    this.addChild(this.background, this.rearFurniture, this.depthLayer);
    this.actorViews = new Map();
    this.propViews = new Map();
    this.objectAnchors = new Map();
    this.objectOcclusions = new Map();
    this.createFurniture();
  }

  sync(snapshot) {
    this.snapshot = snapshot;
    this.syncActors(snapshot?.actors || []);
    this.syncProps(snapshot?.activityStates || []);
  }

  createFurniture() {
    const scene = OFFICE_SCENES[this.sceneId];
    if (!scene) return;
    this.background.addChild(createSprite(OFFICE_ASSET_MANIFEST.scenes[this.sceneId], {
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
    }, {
      runtime: this.runtime,
      onAssetError: this.onAssetError,
      context: { kind: "environment", sceneId: this.sceneId },
    }));
    for (const object of scene.objects) {
      const furniture = OFFICE_ASSET_MANIFEST.furniture[object.id]
        || OFFICE_ASSET_MANIFEST.furniture[object.templateId];
      if (!furniture) continue;
      if (furniture.rear) this.rearFurniture.addChild(createSprite(furniture.rear, object, {
        runtime: this.runtime,
        onAssetError: this.onAssetError,
        context: { kind: "furniture", sceneId: this.sceneId, objectId: object.id },
      }));
      if (furniture.front) {
        const frontSprite = createSprite(furniture.front, object, {
          runtime: this.runtime,
          onAssetError: this.onAssetError,
          context: { kind: "furniture", sceneId: this.sceneId, objectId: object.id },
        });
        const occlusion = createObjectOcclusion(object, frontSprite, { runtime: this.runtime });
        this.objectOcclusions.set(object.id, occlusion);
        this.depthLayer.addChild(occlusion.mask, frontSprite);
      }
      this.objectAnchors.set(object.id, object);
    }
  }

  syncActors(actors) {
    const activeActorIds = new Set();
    for (const actor of actors) {
      activeActorIds.add(actor.id);
      let view = this.actorViews.get(actor.id);
      if (!view) {
        view = new this.ActorView({
          registerLoadedActionStrip: this.registerLoadedActionStrip,
          onAssetError: this.onAssetError,
          runtime: this.runtime,
        });
        this.actorViews.set(actor.id, view);
        this.depthLayer.addChild(view);
      }
      view.sync({
        actor,
        motion: actor.motion,
        clip: actor.clip,
        frameIndex: actor.frameIndex,
        furnitureAnchor: actor.furnitureAnchor,
      });
    }
    for (const [actorId, view] of this.actorViews) {
      if (activeActorIds.has(actorId)) continue;
      view.removeFromParent();
      this.actorViews.delete(actorId);
    }
  }

  syncProps(activityStates) {
    const activePropKeys = new Set();
    for (const state of getActivityPropStates(activityStates)) {
      if (state.sceneId !== this.sceneId) continue;
      const object = this.objectAnchors.get(state.objectId);
      if (!object) continue;
      const anchor = getFurnitureAnchor(object, state.anchorId);
      for (const prop of state.props) {
        const { propId } = prop;
        const key = getActivityPropKey(state, propId);
        activePropKeys.add(key);
        if (this.propViews.has(key)) continue;
        const sprite = createSprite(OFFICE_ASSET_MANIFEST.props[propId], {
          x: anchor.x + prop.offsetX - (prop.width / 2),
          y: anchor.y + prop.offsetY - (prop.height / 2),
          width: prop.width,
          height: prop.height,
        }, {
          runtime: this.runtime,
          onAssetError: this.onAssetError,
          context: { kind: "prop", sceneId: this.sceneId, objectId: state.objectId, propId },
        });
        const occlusion = this.objectOcclusions.get(state.objectId);
        sprite.zIndex = state.layer === "front" && occlusion
          ? occlusion.frontEdgeY + 1
          : Math.round(anchor.y);
        sprite.label = `activity-prop:${state.activityId}:${state.slotId}:${propId}`;
        this.propViews.set(key, sprite);
        this.depthLayer.addChild(sprite);
      }
    }
    for (const [key, sprite] of this.propViews) {
      if (activePropKeys.has(key)) continue;
      sprite.removeFromParent();
      this.propViews.delete(key);
    }
  }
}
