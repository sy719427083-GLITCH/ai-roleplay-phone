import { Container } from "pixi.js";

export class OfficeSceneView extends Container {
  constructor(sceneId, { registerLoadedActionStrip } = {}) {
    super();
    this.sceneId = sceneId;
    this.eventMode = "none";
    this.snapshot = null;
    this.registerLoadedActionStrip = registerLoadedActionStrip;
  }

  sync(snapshot) {
    this.snapshot = snapshot;
  }
}
