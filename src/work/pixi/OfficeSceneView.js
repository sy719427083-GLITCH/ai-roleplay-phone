import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { OFFICE_SCENES } from "../officeSceneManifest.js";
import { OFFICE_ASSET_MANIFEST } from "./officeAssetManifest.js";
import { OfficeActorView } from "./OfficeActorView.js";

const PIXI_RUNTIME = Object.freeze({ Assets, Graphics, Sprite, Texture });
const DESK_PROP_IDS = Object.freeze({
  working: ["laptop", "keyboard", "files-documents"],
  "desk-rest": ["phone", "book"],
});

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
  const seat = String(anchorId).match(/seat-([1-4])/)?.[1];
  if (seat) {
    const column = ["1", "3"].includes(seat) ? 0.2 : 0.8;
    const row = ["1", "2"].includes(seat) ? 0.3 : 0.7;
    return { x: object.x + (object.width * column), y: object.y + (object.height * row) };
  }
  return { x, y: object.y + (object.height * 0.35) };
};

export function getActivityPropStates(activityStates = []) {
  return activityStates.flatMap((state) => {
    if (state?.activity === "eating") return [{
      slotId: state.slotId || "",
      sceneId: "lounge",
      objectId: "dining-table",
      anchorId: normalizeDiningSurface(state.anchorId),
      propIds: ["meal-tray", "food-plate", "utensils"],
    }];
    if (state?.activity === "watching-tv") return [{
      slotId: state.slotId || "",
      sceneId: "lounge",
      objectId: "television",
      anchorId: "screen",
      propIds: ["television-content"],
    }];
    const propIds = DESK_PROP_IDS[state?.activity];
    if (!propIds || !state?.slotId) return [];
    return [{
      slotId: state.slotId,
      sceneId: "office",
      objectId: getDeskObjectId(state.slotId),
      anchorId: "surface",
      propIds,
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

export const getObjectOcclusionBounds = (object) => {
  const [collider] = object.colliders || [];
  return collider
    ? { x: collider.x, y: collider.y, width: collider.width, height: collider.height }
    : { x: object.x, y: object.y + (object.height * 0.4), width: object.width, height: object.height * 0.6 };
};

export function createObjectOcclusion(object, frontSprite, { runtime = PIXI_RUNTIME } = {}) {
  const bounds = getObjectOcclusionBounds(object);
  const mask = new runtime.Graphics().rect(bounds.x, bounds.y, bounds.width, bounds.height).fill({ color: 0xffffff });
  const frontEdgeY = bounds.y + bounds.height;
  frontSprite.mask = mask;
  frontSprite.zIndex = frontEdgeY;
  return { mask, bounds, frontEdgeY, frontSprite };
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
      for (const propId of state.propIds) {
        const key = getActivityPropKey(state, propId);
        activePropKeys.add(key);
        if (this.propViews.has(key)) continue;
        const sprite = createSprite(OFFICE_ASSET_MANIFEST.props[propId], {
          x: anchor.x - 24,
          y: anchor.y - 24,
          width: 48,
          height: 48,
        }, {
          runtime: this.runtime,
          onAssetError: this.onAssetError,
          context: { kind: "prop", sceneId: this.sceneId, objectId: state.objectId, propId },
        });
        sprite.zIndex = Math.round(anchor.y);
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
