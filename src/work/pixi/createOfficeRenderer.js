import { OFFICE_WORLD_SIZE } from "../officeSceneManifest.js";

const hostOwners = new WeakMap();

export const __hasOfficeRendererHostOwner = (host) => hostOwners.has(host);

const getHostSize = (host) => ({
  width: host.clientWidth || host.offsetWidth || 1,
  height: host.clientHeight || host.offsetHeight || 1,
});

const getTransform = (host) => {
  const { width, height } = getHostSize(host);
  const scale = Math.min(width / OFFICE_WORLD_SIZE.width, height / OFFICE_WORLD_SIZE.height);
  return {
    scale,
    x: (width - (OFFICE_WORLD_SIZE.width * scale)) / 2,
    y: (height - (OFFICE_WORLD_SIZE.height * scale)) / 2,
  };
};

const applyRootTransform = (root, transform) => {
  root.x = transform.x;
  root.y = transform.y;
  if (typeof root.scale?.set === "function") root.scale.set(transform.scale);
  else if (root.scale) {
    root.scale.x = transform.scale;
    root.scale.y = transform.scale;
  }
};

const isOwnedActionStrip = (src) => (
  ["idle", "walk", "work"].includes(src)
  || /^https?:\/\//u.test(src)
  || /(?:^|\/)work-office-v2\/characters\/[^/]+\/[^/]+\.webp(?:\?.*)?$/u.test(src)
);

export const isExpectedCancellation = (error) => error?.name === "AbortError";

export function applyOfficeRendererUpdate(renderer, {
  world,
  visibleSceneId,
  onError,
  isCancelled = false,
} = {}) {
  if (!renderer || isCancelled) return false;
  try {
    renderer.sync(world);
    renderer.setVisibleScene(visibleSceneId);
    return true;
  } catch (error) {
    if (!isExpectedCancellation(error)) onError?.(error);
    return false;
  }
}

export async function createOfficeRenderer({
  host,
  onFrame,
  onDoorSelect,
  onActorSelect,
  getCallbacks,
  signal,
  shouldAttach,
  runtime,
  devicePixelRatio = globalThis.devicePixelRatio || 1,
}) {
  const pixi = runtime || await import("pixi.js");
  const { Application, Assets, Container, Rectangle } = pixi;
  const SceneView = pixi.SceneView || (await import("./OfficeSceneView.js")).OfficeSceneView;
  const owner = {};
  hostOwners.set(host, owner);
  const app = new Application();
  let destroyed = false;
  let tickerCallback = null;
  const ownedActionStrips = new Set();
  const isCurrentOwner = () => (
    !destroyed
    && !signal?.aborted
    && hostOwners.get(host) === owner
    && shouldAttach?.() !== false
  );
  const destroyApp = () => {
    if (destroyed) return;
    destroyed = true;
    const renderer = app.renderer;
    let cleanupError = null;
    const runCleanup = (callback) => {
      try {
        callback();
      } catch (error) {
        cleanupError ||= error;
      }
    };

    try {
      if (renderer) {
        if (tickerCallback) runCleanup(() => app.ticker?.remove?.(tickerCallback));
        tickerCallback = null;
        const aliases = [...ownedActionStrips];
        ownedActionStrips.clear();
        if (aliases.length > 0) runCleanup(() => void Promise.resolve(Assets.unload(aliases)).catch(() => {}));
        runCleanup(() => {
          const canvas = app.canvas;
          if (canvas?.parentNode === host) host.removeChild?.(canvas);
        });
        runCleanup(() => app.destroy?.(true, { children: true, texture: true }));
      } else {
        tickerCallback = null;
        ownedActionStrips.clear();
        runCleanup(() => app.stage?.destroy?.({ children: true }));
      }
    } finally {
      if (hostOwners.get(host) === owner) hostOwners.delete(host);
    }

    if (cleanupError) throw cleanupError;
  };

  try {
    await app.init({
      resizeTo: host,
      autoDensity: true,
      resolution: Math.min(2, Math.max(1, devicePixelRatio)),
      antialias: true,
      backgroundAlpha: 0,
      preference: "webgl",
    });
  } catch (error) {
    try {
      destroyApp();
    } catch {
      // Init errors take precedence over best-effort partial cleanup failures.
    }
    throw error;
  }

  if (!isCurrentOwner()) {
    destroyApp();
    return null;
  }

  app.canvas.dataset.officeRenderer = "pixi";
  host.replaceChildren(app.canvas);

  const registerLoadedActionStrip = (src) => {
    if (isOwnedActionStrip(src)) ownedActionStrips.add(src);
  };
  const getLatestCallbacks = () => getCallbacks?.() || { onFrame, onDoorSelect, onActorSelect };
  const reportAssetError = (error) => getLatestCallbacks().onError?.(error);
  const office = new Container();
  const lounge = new Container();
  const sceneViews = new Map([
    ["office", new SceneView("office", { registerLoadedActionStrip, onAssetError: reportAssetError, runtime: pixi })],
    ["lounge", new SceneView("lounge", { registerLoadedActionStrip, onAssetError: reportAssetError, runtime: pixi })],
  ]);
  office.addChild(sceneViews.get("office"));
  lounge.addChild(sceneViews.get("lounge"));
  app.stage.addChild(office, lounge);
  const rootByScene = new Map([["office", office], ["lounge", lounge]]);
  let activeSceneId = "office";
  let transform = getTransform(host);

  const refreshTransform = () => {
    transform = getTransform(host);
    for (const root of rootByScene.values()) applyRootTransform(root, transform);
    return transform;
  };
  const setVisibleScene = (sceneId) => {
    activeSceneId = rootByScene.has(sceneId) ? sceneId : "office";
    for (const [id, root] of rootByScene) {
      const active = id === activeSceneId;
      root.visible = active;
      root.eventMode = active ? "static" : "none";
    }
  };
  tickerCallback = () => {
    refreshTransform();
    getLatestCallbacks().onFrame?.(app.ticker.lastTime);
  };
  app.ticker.add(tickerCallback);
  refreshTransform();
  setVisibleScene("office");

  return {
    sync(world = {}) {
      refreshTransform();
      for (const [sceneId, sceneView] of sceneViews) {
        sceneView.sync({
          sceneId,
          scene: world.scenes?.[sceneId] ?? null,
          actors: (world.actors || []).filter((actor) => actor.sceneId === sceneId),
          activityStates: world.activityStates || [],
        });
      }
    },
    setVisibleScene,
    worldToScreen(point = {}) {
      refreshTransform();
      return {
        x: transform.x + ((Number(point.x) || 0) * transform.scale),
        y: transform.y + ((Number(point.y) || 0) * transform.scale),
      };
    },
    extractSceneFrame(sceneId) {
      if (!sceneViews.has(sceneId)) throw new Error(`Unknown office scene: ${sceneId}`);
      if (sceneId !== activeSceneId) throw new Error(`Office scene is not visible: ${sceneId}`);
      refreshTransform();
      const { width, height } = getHostSize(host);
      return app.renderer.extract.base64({
        target: app.stage,
        frame: new Rectangle(0, 0, width, height),
        resolution: 1,
        format: "png",
        antialias: true,
      });
    },
    destroy: destroyApp,
  };
}

export default createOfficeRenderer;
