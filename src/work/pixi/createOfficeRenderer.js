import { Application, Assets, Container } from "pixi.js";
import { OFFICE_WORLD_SIZE } from "../officeSceneManifest.js";
import { OfficeSceneView } from "./OfficeSceneView.js";
import { getCharacterActionStripAliases } from "./officeAssetManifest.js";

const getHostSize = (host) => ({
  width: host.clientWidth || host.offsetWidth || 1,
  height: host.clientHeight || host.offsetHeight || 1,
});

const getScreenTransform = (host) => {
  const { width, height } = getHostSize(host);
  const scale = Math.min(width / OFFICE_WORLD_SIZE.width, height / OFFICE_WORLD_SIZE.height);

  return {
    scale,
    offsetX: (width - (OFFICE_WORLD_SIZE.width * scale)) / 2,
    offsetY: (height - (OFFICE_WORLD_SIZE.height * scale)) / 2,
  };
};

const hasKnownActionStrip = (alias) => getCharacterActionStripAliases().includes(alias);

export async function createOfficeRenderer({ host, onFrame, onDoorSelect, onActorSelect }) {
  const app = new Application();
  let destroyed = false;
  const loadedCharacterActionStrips = new Set();

  await app.init({
    resizeTo: host,
    autoDensity: true,
    resolution: Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)),
    antialias: true,
    backgroundAlpha: 0,
    preference: "webgl",
  });

  if (destroyed) {
    app.destroy(true, { children: true, texture: true });
    return null;
  }

  app.canvas.dataset.officeRenderer = "pixi";
  host.replaceChildren(app.canvas);

  const office = new Container();
  const lounge = new Container();
  const sceneViews = new Map([
    ["office", new OfficeSceneView("office")],
    ["lounge", new OfficeSceneView("lounge")],
  ]);
  office.addChild(sceneViews.get("office"));
  lounge.addChild(sceneViews.get("lounge"));
  app.stage.addChild(office, lounge);

  const rootByScene = new Map([
    ["office", office],
    ["lounge", lounge],
  ]);

  const setVisibleScene = (sceneId) => {
    const activeSceneId = rootByScene.has(sceneId) ? sceneId : "office";
    for (const [id, root] of rootByScene) {
      const isVisible = id === activeSceneId;
      root.visible = isVisible;
      root.eventMode = isVisible ? "static" : "none";
    }
  };

  const tickerCallback = () => {
    onFrame?.(app.ticker.lastTime);
  };
  app.ticker.add(tickerCallback);
  setVisibleScene("office");

  return {
    sync(world = {}) {
      for (const [sceneId, sceneView] of sceneViews) {
        sceneView.sync(world.scenes?.[sceneId] ?? { id: sceneId });
      }
      for (const alias of world.loadedCharacterActionStrips ?? []) {
        if (hasKnownActionStrip(alias)) loadedCharacterActionStrips.add(alias);
      }
    },
    setVisibleScene,
    worldToScreen(point = {}) {
      const { scale, offsetX, offsetY } = getScreenTransform(host);
      return {
        x: offsetX + ((Number(point.x) || 0) * scale),
        y: offsetY + ((Number(point.y) || 0) * scale),
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      app.ticker.remove(tickerCallback);
      const strips = [...loadedCharacterActionStrips];
      loadedCharacterActionStrips.clear();
      if (strips.length > 0) {
        void Assets.unload(strips).catch(() => {});
      }
      app.destroy(true, { children: true, texture: true });
    },
  };
}

export default createOfficeRenderer;
