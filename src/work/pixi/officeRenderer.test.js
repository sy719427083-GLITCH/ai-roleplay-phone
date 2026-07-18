import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

const loadRenderer = () => import("./createOfficeRenderer.js");

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

function createHost({ width = 390, height = 744 } = {}) {
  return {
    clientWidth: width,
    clientHeight: height,
    children: [],
    replaceChildren(...children) {
      this.children.forEach((child) => { child.parentNode = null; });
      this.children = children;
      children.forEach((child) => { child.parentNode = this; });
    },
    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
      child.parentNode = null;
    },
  };
}

function createFakePixi({ init, resourceTiming = "constructor" } = {}) {
  const applications = [];
  const unloaded = [];

  class Container {
    constructor() {
      this.children = [];
      this.visible = true;
      this.eventMode = "auto";
      this.x = 0;
      this.y = 0;
      this.scale = { x: 1, y: 1, set: (value) => { this.scale.x = value; this.scale.y = value; } };
    }

    addChild(...children) {
      this.children.push(...children);
    }

    destroy() {
      this.destroyCalls = (this.destroyCalls || 0) + 1;
    }
  }

  class Application {
    constructor() {
      this.stage = new Container();
      this.destroyCalls = 0;
      if (resourceTiming === "constructor") this.createRendererResources();
      if (resourceTiming === "renderer-only") this.renderer = {};
      applications.push(this);
    }

    createRendererResources() {
      this.renderer = {};
      this.canvas = { dataset: {}, parentNode: null, width: 0, height: 0 };
      this.ticker = {
        lastTime: 123,
        callbacks: new Set(),
        add: (callback) => this.ticker.callbacks.add(callback),
        remove: (callback) => this.ticker.callbacks.delete(callback),
        emit: () => [...this.ticker.callbacks].forEach((callback) => callback()),
      };
    }

    async init(options) {
      this.initOptions = options;
      if (init) await init(this, options);
      if (resourceTiming === "after-init") this.createRendererResources();
      this.canvas.width = (options.resizeTo.clientWidth || 1) * options.resolution;
      this.canvas.height = (options.resizeTo.clientHeight || 1) * options.resolution;
    }

    destroy() {
      this.destroyCalls += 1;
    }
  }

  class SceneView extends Container {
    constructor(sceneId, { registerLoadedActionStrip } = {}) {
      super();
      this.sceneId = sceneId;
      this.registerLoadedActionStrip = registerLoadedActionStrip;
      this.snapshots = [];
    }

    sync(snapshot) {
      this.snapshot = snapshot;
      this.snapshots.push(snapshot);
    }
  }

  return {
    applications,
    unloaded,
    runtime: {
      Application,
      Assets: { unload: async (aliases) => unloaded.push([...aliases]) },
      Container,
      SceneView,
    },
  };
}

const createWorld = () => ({
  scenes: { office: { id: "office", revision: 1 }, lounge: { id: "lounge", revision: 2 } },
  actors: [
    { id: "office-actor", sceneId: "office", x: 540, y: 960, status: "工作中" },
    { id: "lounge-actor", sceneId: "lounge", x: 270, y: 480, status: "休息中" },
  ],
  moduleState: { office: { desk: "active" }, lounge: { sofa: "occupied" } },
});

test("initializes the exact Pixi options and keeps persistent roots synchronized with dynamic scene data", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const fake = createFakePixi();
  const host = createHost();
  const renderer = await createOfficeRenderer({ host, runtime: fake.runtime, devicePixelRatio: 2 });

  assert.deepEqual(fake.applications[0].initOptions, {
    resizeTo: host,
    autoDensity: true,
    resolution: 2,
    antialias: true,
    backgroundAlpha: 0,
    preference: "webgl",
  });
  assert.equal(host.children[0], fake.applications[0].canvas);
  renderer.sync(createWorld());

  const [officeRoot, loungeRoot] = fake.applications[0].stage.children;
  assert.deepEqual(officeRoot.children[0].snapshot.actors.map(({ id }) => id), ["office-actor"]);
  assert.deepEqual(loungeRoot.children[0].snapshot.actors.map(({ id }) => id), ["lounge-actor"]);
  assert.deepEqual(officeRoot.children[0].snapshot.moduleState, { office: { desk: "active" }, lounge: { sofa: "occupied" } });
  renderer.setVisibleScene("lounge");
  assert.equal(officeRoot.visible, false);
  assert.equal(officeRoot.eventMode, "none");
  assert.equal(loungeRoot.visible, true);
  assert.equal(loungeRoot.eventMode, "static");
});

test("caps DPR, applies one letterbox transform to both roots, and keeps worldToScreen current after resize", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const fake = createFakePixi();
  const host = createHost({ width: 540, height: 960 });
  const renderer = await createOfficeRenderer({ host, runtime: fake.runtime, devicePixelRatio: 5 });
  const [officeRoot, loungeRoot] = fake.applications[0].stage.children;

  assert.equal(fake.applications[0].initOptions.resolution, 2);
  assert.deepEqual(renderer.worldToScreen({ x: 540, y: 960 }), { x: 270, y: 480 });
  assert.equal(officeRoot.scale.x, 0.5);
  assert.equal(loungeRoot.scale.x, 0.5);
  assert.equal(officeRoot.x, 0);
  assert.equal(loungeRoot.y, 0);

  host.clientWidth = 390;
  host.clientHeight = 844;
  fake.applications[0].ticker.emit();
  assert.deepEqual(renderer.worldToScreen({ x: 540, y: 960 }), { x: 195, y: 422 });
  assert.equal(officeRoot.scale.x, loungeRoot.scale.x);
  assert.equal(officeRoot.x, loungeRoot.x);
  assert.equal(officeRoot.y, loungeRoot.y);
});

test("uses the latest callbacks and removes its ticker on idempotent destroy", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const fake = createFakePixi();
  const host = createHost();
  const calls = [];
  let callbacks = { onFrame: (time) => calls.push(`first:${time}`) };
  const renderer = await createOfficeRenderer({
    host,
    runtime: fake.runtime,
    getCallbacks: () => callbacks,
  });

  fake.applications[0].ticker.emit();
  callbacks = { onFrame: (time) => calls.push(`second:${time}`) };
  fake.applications[0].ticker.emit();
  renderer.destroy();
  renderer.destroy();
  fake.applications[0].ticker.emit();

  assert.deepEqual(calls, ["first:123", "second:123"]);
  assert.equal(fake.applications[0].ticker.callbacks.size, 0);
  assert.equal(fake.applications[0].destroyCalls, 1);
  assert.equal(host.children.length, 0);
});

test("tracks only renderer-owned successful action-strip loads and unloads exactly those aliases", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const fake = createFakePixi();
  const renderer = await createOfficeRenderer({ host: createHost(), runtime: fake.runtime });
  const [officeRoot] = fake.applications[0].stage.children;

  renderer.sync(createWorld());
  officeRoot.children[0].registerLoadedActionStrip("walk");
  officeRoot.children[0].registerLoadedActionStrip("not-owned");
  renderer.destroy();
  await Promise.resolve();

  assert.deepEqual(fake.unloaded, [["walk"]]);
});

test("cleans up a rejected initialization exactly once", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const boom = new Error("init failed");
  const fake = createFakePixi({ init: async () => { throw boom; } });

  await assert.rejects(
    createOfficeRenderer({ host: createHost(), runtime: fake.runtime }),
    boom,
  );
  assert.equal(fake.applications[0].destroyCalls, 1);
});

test("preserves the original early init error while cleaning a stage-only application without touching the host", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const boom = new Error("early init failed");
  const fake = createFakePixi({
    resourceTiming: "never",
    init: async () => { throw boom; },
  });
  const host = createHost();
  const newerCanvas = { parentNode: null };
  host.replaceChildren(newerCanvas);

  await assert.rejects(
    createOfficeRenderer({ host, runtime: fake.runtime }),
    (error) => error === boom,
  );

  assert.equal(fake.applications[0].destroyCalls, 0);
  assert.equal(fake.applications[0].stage.destroyCalls, 1);
  assert.equal(host.children[0], newerCanvas);
});

test("cleans a partial renderer initialization without requiring a canvas or ticker", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const boom = new Error("partial init failed");
  const fake = createFakePixi({
    resourceTiming: "renderer-only",
    init: async () => { throw boom; },
  });
  const host = createHost();
  const newerCanvas = { parentNode: null };
  host.replaceChildren(newerCanvas);

  await assert.rejects(createOfficeRenderer({ host, runtime: fake.runtime }), (error) => error === boom);

  assert.equal(fake.applications[0].destroyCalls, 1);
  assert.equal(host.children[0], newerCanvas);
});

test("prevents stale and cancelled initializers from replacing or removing a newer canvas", async () => {
  const { createOfficeRenderer } = await loadRenderer();
  const firstGate = deferred();
  const secondGate = deferred();
  let initCount = 0;
  const fake = createFakePixi({ init: async () => {
    initCount += 1;
    await (initCount === 1 ? firstGate.promise : secondGate.promise);
  } });
  const host = createHost();
  const first = createOfficeRenderer({ host, runtime: fake.runtime });
  const second = createOfficeRenderer({ host, runtime: fake.runtime });

  secondGate.resolve();
  const secondRenderer = await second;
  firstGate.resolve();
  const firstRenderer = await first;

  assert.equal(firstRenderer, null);
  assert.equal(host.children[0], fake.applications[1].canvas);
  assert.equal(fake.applications[0].destroyCalls, 1);
  secondRenderer.destroy();

  const cancelledGate = deferred();
  const cancelledFake = createFakePixi({ init: async () => cancelledGate.promise });
  const cancelled = createOfficeRenderer({
    host: createHost(),
    runtime: cancelledFake.runtime,
    shouldAttach: () => false,
  });
  cancelledGate.resolve();
  assert.equal(await cancelled, null);
  assert.equal(cancelledFake.applications[0].destroyCalls, 1);
});

test("routes update failures to the latest error callback while ignoring expected cancellation", async () => {
  const { applyOfficeRendererUpdate } = await loadRenderer();
  const errors = [];
  const renderer = {
    sync() { throw new Error("sync failed"); },
    setVisibleScene() { throw new Error("visibility failed"); },
  };

  assert.equal(applyOfficeRendererUpdate(renderer, { world: {}, visibleSceneId: "office", onError: (error) => errors.push(error.message) }), false);
  assert.deepEqual(errors, ["sync failed"]);
  assert.equal(applyOfficeRendererUpdate(renderer, {
    world: {},
    visibleSceneId: "office",
    onError: (error) => errors.push(error.message),
    isCancelled: true,
  }), false);
  assert.deepEqual(errors, ["sync failed"]);
});

test("routes a visibility update error after a successful sync to the latest error callback", async () => {
  const { applyOfficeRendererUpdate } = await loadRenderer();
  const visibilityError = new Error("visibility failed");
  const errors = [];
  const renderer = {
    sync() {},
    setVisibleScene() { throw visibilityError; },
  };

  assert.equal(applyOfficeRendererUpdate(renderer, {
    world: {},
    visibleSceneId: "lounge",
    onError: (error) => errors.push(error),
  }), false);
  assert.deepEqual(errors, [visibilityError]);
});

test("mounts one Pixi canvas with a backing-to-CSS ratio capped at two", async () => {
  const vite = await createServer({
    appType: "spa",
    logLevel: "silent",
    root: fileURLToPath(new URL("../../..", import.meta.url)),
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  const address = vite.httpServer.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await page.goto(`http://127.0.0.1:${port}/ai-roleplay-phone/`, { waitUntil: "networkidle" });
    await page.getByText("tap or swipe to unlock").click();
    await page.getByRole("button", { name: "工作" }).click();
    const canvas = page.locator('canvas[data-office-renderer="pixi"]');
    await canvas.waitFor({ state: "attached" });
    assert.equal(await canvas.count(), 1);
    const dimensions = await canvas.evaluate((element) => ({
      width: element.width,
      height: element.height,
      cssWidth: element.getBoundingClientRect().width,
      cssHeight: element.getBoundingClientRect().height,
    }));
    assert.ok(dimensions.width > 0 && dimensions.height > 0);
    assert.ok((dimensions.width / dimensions.cssWidth) <= 2.05);
    assert.ok((dimensions.height / dimensions.cssHeight) <= 2.05);
  } finally {
    await browser.close();
    await vite.close();
  }
});
