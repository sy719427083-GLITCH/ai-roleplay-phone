import { Assets, Container, Sprite, Texture } from "pixi.js";
import { OFFICE_SCENES } from "../officeSceneManifest.js";
import { OFFICE_ASSET_MANIFEST } from "./officeAssetManifest.js";
import { OfficeActorView } from "./OfficeActorView.js";

const DESK_PROP_IDS = Object.freeze({
  working: ["laptop", "keyboard", "files-documents"],
  "desk-rest": ["phone", "book"],
});

const getDeskObjectId = (slotId) => (slotId === "boss" ? "boss-desk" : `${slotId}-desk`);

const getFurnitureAnchor = (object, anchorId) => {
  const x = object.x + (object.width / 2);
  const y = object.y + (object.height / 2);
  if (anchorId === "screen") return { x, y: object.y + (object.height * 0.35) };
  if (anchorId.startsWith("seat-1")) return { x: object.x + (object.width * 0.2), y: object.y + (object.height * 0.3) };
  if (anchorId.startsWith("seat-2")) return { x: object.x + (object.width * 0.8), y: object.y + (object.height * 0.3) };
  return { x, y: object.y + (object.height * 0.35) };
};

export function getActivityPropStates(activityStates = []) {
  return activityStates.flatMap((state) => {
    if (state?.activity === "eating") return [{
      sceneId: "lounge",
      objectId: "dining-table",
      anchorId: "seat-1:surface",
      propIds: ["meal-tray", "food-plate", "utensils"],
    }];
    if (state?.activity === "watching-tv") return [{
      sceneId: "lounge",
      objectId: "television",
      anchorId: "screen",
      propIds: ["television-content"],
    }];
    const propIds = DESK_PROP_IDS[state?.activity];
    if (!propIds || !state?.slotId) return [];
    return [{
      sceneId: "office",
      objectId: getDeskObjectId(state.slotId),
      anchorId: "surface",
      propIds,
    }];
  });
}

const createSprite = (src, object) => {
  const sprite = new Sprite(Texture.EMPTY);
  sprite.x = object.x;
  sprite.y = object.y;
  sprite.width = object.width;
  sprite.height = object.height;
  void Assets.load(src).then((texture) => { sprite.texture = texture; }).catch(() => {});
  return sprite;
};

export class OfficeSceneView extends Container {
  constructor(sceneId, { registerLoadedActionStrip } = {}) {
    super();
    this.sceneId = sceneId;
    this.eventMode = "none";
    this.snapshot = null;
    this.registerLoadedActionStrip = registerLoadedActionStrip;
    this.sortableChildren = true;
    this.background = new Container();
    this.rearFurniture = new Container();
    this.actorLayer = new Container();
    this.actorLayer.sortableChildren = true;
    this.propLayer = new Container();
    this.frontFurniture = new Container();
    this.addChild(this.background, this.rearFurniture, this.actorLayer, this.propLayer, this.frontFurniture);
    this.actorViews = new Map();
    this.propViews = new Map();
    this.objectAnchors = new Map();
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
    const background = createSprite(OFFICE_ASSET_MANIFEST.scenes[this.sceneId], {
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
    });
    this.background.addChild(background);
    for (const object of scene.objects) {
      const furniture = OFFICE_ASSET_MANIFEST.furniture[object.id]
        || OFFICE_ASSET_MANIFEST.furniture[object.templateId];
      if (!furniture) continue;
      if (furniture.rear) this.rearFurniture.addChild(createSprite(furniture.rear, object));
      if (furniture.front) this.frontFurniture.addChild(createSprite(furniture.front, object));
      this.objectAnchors.set(object.id, object);
    }
  }

  syncActors(actors) {
    const activeActorIds = new Set();
    for (const actor of actors) {
      activeActorIds.add(actor.id);
      let view = this.actorViews.get(actor.id);
      if (!view) {
        view = new OfficeActorView({ registerLoadedActionStrip: this.registerLoadedActionStrip });
        this.actorViews.set(actor.id, view);
        this.actorLayer.addChild(view);
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
        const key = `${state.objectId}:${state.anchorId}:${propId}`;
        activePropKeys.add(key);
        if (this.propViews.has(key)) continue;
        const sprite = createSprite(OFFICE_ASSET_MANIFEST.props[propId], {
          x: anchor.x - 24,
          y: anchor.y - 24,
          width: 48,
          height: 48,
        });
        this.propViews.set(key, sprite);
        this.propLayer.addChild(sprite);
      }
    }
    for (const [key, sprite] of this.propViews) {
      if (activePropKeys.has(key)) continue;
      sprite.removeFromParent();
      this.propViews.delete(key);
    }
  }
}
