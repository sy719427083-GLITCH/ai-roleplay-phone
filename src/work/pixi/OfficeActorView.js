import { AnimatedSprite, Assets, Container, Rectangle, Texture } from "pixi.js";
import { getActorClipSource } from "./officeAssetManifest.js";

const PIXI_RUNTIME = Object.freeze({ AnimatedSprite, Assets, Rectangle, Texture });

const reportAssetError = (onAssetError, context, error) => {
  if (!onAssetError) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  failure.context = { ...context, source: context.source };
  onAssetError(failure);
};

export function getActorTexturePlan(clip, facing = "front") {
  if (clip.rowByFacing) {
    return {
      row: clip.rowByFacing[facing] ?? clip.rowByFacing.front ?? 0,
      scaleX: 1,
    };
  }

  const mirrorSideAction = clip.rows === 1
    && clip.legalFacings?.includes("left")
    && clip.legalFacings?.includes("right")
    && facing === "left";
  return { row: 0, scaleX: mirrorSideAction ? -1 : 1 };
}

const textureFrames = (runtime, texture, clip, row) => Array.from({ length: clip.frameCount }, (_, index) => new runtime.Texture({
  source: texture.source,
  frame: new runtime.Rectangle((index % clip.columns) * clip.cellSize, row * clip.cellSize, clip.cellSize, clip.cellSize),
}));

export function loadActorFrames({
  runtime = PIXI_RUNTIME,
  source,
  facing,
  frameIndex,
  actorSprite,
  onAssetError,
  onLoaded,
  context = {},
}) {
  const plan = getActorTexturePlan(source, facing);
  void runtime.Assets.load(source.src).then((texture) => {
    actorSprite.textures = textureFrames(runtime, texture, source, plan.row);
    actorSprite.gotoAndStop(Math.abs(Number(frameIndex) || 0) % source.frameCount);
    onLoaded?.();
  }).catch((error) => reportAssetError(onAssetError, { ...context, source: source.src }, error));
}

const getPoint = (actor, furnitureAnchor) => ({
  x: Number.isFinite(actor?.x) ? actor.x : furnitureAnchor?.x || 0,
  y: Number.isFinite(actor?.y) ? actor.y : furnitureAnchor?.y || 0,
});

export class OfficeActorView extends Container {
  constructor({ registerLoadedActionStrip, onAssetError, runtime = PIXI_RUNTIME } = {}) {
    super();
    this.runtime = runtime;
    this.actorSprite = new runtime.AnimatedSprite([runtime.Texture.EMPTY]);
    this.actorSprite.anchor.set(0.5, 0.92);
    this.addChild(this.actorSprite);
    this.registerLoadedActionStrip = registerLoadedActionStrip;
    this.onAssetError = onAssetError;
    this.source = null;
    this.loadVersion = 0;
  }

  sync({ actor = {}, motion = null, clip = "idle-standing", frameIndex = 0, furnitureAnchor = null } = {}) {
    const facing = motion?.facing || actor.facing || "front";
    const source = getActorClipSource(actor, clip);
    const point = getPoint(actor, furnitureAnchor);
    const plan = getActorTexturePlan(source, facing);
    this.x = point.x;
    this.y = point.y;
    this.zIndex = Math.round(point.y);
    this.actorSprite.scale.x = plan.scaleX;
    this.actorSprite.animationSpeed = source.fps / 60;
    this.actorSprite.loop = source.loop;
    this.actorSprite.gotoAndStop(Math.abs(Number(frameIndex) || 0) % source.frameCount);

    if (this.source?.src === source.src && this.source.facing === facing) return;
    this.source = { src: source.src, facing };
    const version = this.loadVersion + 1;
    this.loadVersion = version;
    loadActorFrames({
      runtime: this.runtime,
      source,
      facing,
      frameIndex,
      actorSprite: this.actorSprite,
      onAssetError: (error) => {
        if (this.loadVersion === version) this.onAssetError?.(error);
      },
      onLoaded: () => {
        if (this.loadVersion === version) this.registerLoadedActionStrip?.(source.src);
      },
      context: { kind: "actor", actorId: actor.id || "unknown" },
    });
  }
}
