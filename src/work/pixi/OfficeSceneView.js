import { Container } from "pixi.js";

export class OfficeSceneView extends Container {
  constructor(sceneId) {
    super();
    this.sceneId = sceneId;
    this.eventMode = "none";
    this.world = null;
  }

  sync(world) {
    this.world = world;
  }
}
