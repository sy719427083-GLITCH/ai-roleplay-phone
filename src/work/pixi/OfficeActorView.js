import { AnimatedSprite, Assets, Container, Rectangle, Texture } from "pixi.js";
import { getActorClipSource } from "./officeAssetManifest.js";

const PIXI_RUNTIME = Object.freeze({ AnimatedSprite, Assets, Rectangle, Texture });
const LEGACY_FACING_ALIASES = Object.freeze({ up: "back", down: "front" });

export const normalizeActorFacing = (facing) => LEGACY_FACING_ALIASES[facing] || facing;

const reportAssetError = (onAssetError, context, error) => {
  if (!onAssetError) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  failure.context = { ...context, source: context.source };
  onAssetError(failure);
};

export function getActorTexturePlan(clip, facing = "front") {
  const normalizedFacing = normalizeActorFacing(facing);
  if (clip.rowByFacing) {
    return {
      row: clip.rowByFacing[normalizedFacing] ?? clip.rowByFacing.front ?? 0,
      scaleX: 1,
    };
  }

  const mirrorSideAction = clip.rows === 1
    && clip.legalFacings?.includes("left")
    && clip.legalFacings?.includes("right")
    && normalizedFacing === "left";
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
  isCurrent = () => true,
  getFrameIndex = () => frameIndex,
  context = {},
}) {
  const plan = getActorTexturePlan(source, normalizeActorFacing(facing));
  void runtime.Assets.load(source.src).then((texture) => {
    if (!isCurrent()) return;
    actorSprite.textures = textureFrames(runtime, texture, source, plan.row);
    actorSprite.gotoAndStop(Math.abs(Number(getFrameIndex()) || 0) % source.frameCount);
    if (!isCurrent()) return;
    onLoaded?.();
  }).catch((error) => {
    if (isCurrent()) reportAssetError(onAssetError, { ...context, source: source.src }, error);
  });
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
    const facing = normalizeActorFacing(motion?.facing || actor.facing || "front");
    const source = getActorClipSource(actor, clip, facing);
    const point = getPoint(actor, furnitureAnchor);
    const plan = getActorTexturePlan(source, facing);
    this.x = point.x;
    this.y = point.y;
    this.zIndex = Math.round(point.y);
    this.actorSprite.scale.x = plan.scaleX;
    this.actorSprite.animationSpeed = source.fps / 60;
    this.actorSprite.loop = source.loop;
    const normalizedFrameIndex = Math.abs(Number(frameIndex) || 0) % source.frameCount;

    if (
      this.source?.src === source.src
      && this.source.facing === facing
      && ["pending", "loaded"].includes(this.source.state)
    ) {
      this.source.frameIndex = normalizedFrameIndex;
      if (this.source.state === "loaded") this.actorSprite.gotoAndStop(normalizedFrameIndex);
      return;
    }
    const version = this.loadVersion + 1;
    this.loadVersion = version;
    this.source = { src: source.src, facing, state: "pending", frameIndex: normalizedFrameIndex };
    const isCurrent = () => (
      this.loadVersion === version
      && this.source?.src === source.src
      && this.source.facing === facing
    );
    loadActorFrames({
      runtime: this.runtime,
      source,
      facing,
      frameIndex: normalizedFrameIndex,
      getFrameIndex: () => this.source?.frameIndex ?? normalizedFrameIndex,
      actorSprite: this.actorSprite,
      onAssetError: (error) => {
        if (!isCurrent()) return;
        this.source = null;
        this.onAssetError?.(error);
      },
      onLoaded: () => {
        if (!isCurrent()) return;
        this.source.state = "loaded";
        this.registerLoadedActionStrip?.(source.src);
      },
      isCurrent,
      context: { kind: "actor", actorId: actor.id || "unknown" },
    });
  }
}
