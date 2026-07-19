import { AnimatedSprite, Assets, Container, Rectangle, Texture } from "pixi.js";
import { getActorClipSource } from "./officeAssetManifest.js";

const textureFrames = (texture, clip, facing) => {
  const row = clip.rowByFacing?.[facing] ?? 0;
  return Array.from({ length: clip.frameCount }, (_, index) => new Texture({
    source: texture.source,
    frame: new Rectangle((index % clip.columns) * clip.cellSize, row * clip.cellSize, clip.cellSize, clip.cellSize),
  }));
};

const getPoint = (actor, furnitureAnchor) => ({
  x: Number.isFinite(actor?.x) ? actor.x : furnitureAnchor?.x || 0,
  y: Number.isFinite(actor?.y) ? actor.y : furnitureAnchor?.y || 0,
});

export class OfficeActorView extends Container {
  constructor({ registerLoadedActionStrip } = {}) {
    super();
    this.actorSprite = new AnimatedSprite([Texture.EMPTY]);
    this.actorSprite.anchor.set(0.5, 0.92);
    this.addChild(this.actorSprite);
    this.registerLoadedActionStrip = registerLoadedActionStrip;
    this.source = null;
    this.loadVersion = 0;
  }

  sync({ actor = {}, motion = null, clip = "idle-standing", frameIndex = 0, furnitureAnchor = null } = {}) {
    const facing = motion?.facing || actor.facing || "front";
    const source = getActorClipSource(actor, clip);
    const point = getPoint(actor, furnitureAnchor);
    this.x = point.x;
    this.y = point.y;
    this.zIndex = Math.round(point.y);
    this.actorSprite.scale.x = facing === "left" ? -1 : 1;
    this.actorSprite.animationSpeed = source.fps / 60;
    this.actorSprite.loop = source.loop;
    this.actorSprite.gotoAndStop(Math.abs(Number(frameIndex) || 0) % source.frameCount);

    if (this.source?.src === source.src && this.source.facing === facing) return;
    this.source = { src: source.src, facing };
    const version = this.loadVersion + 1;
    this.loadVersion = version;
    void Assets.load(source.src).then((texture) => {
      if (this.loadVersion !== version) return;
      this.actorSprite.textures = textureFrames(texture, source, facing);
      this.actorSprite.gotoAndStop(Math.abs(Number(frameIndex) || 0) % source.frameCount);
      this.registerLoadedActionStrip?.(source.src);
    }).catch(() => {});
  }
}
