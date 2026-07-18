import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_PATH = "/ai-roleplay-phone/";
const APP_URL = `http://${HOST}:${PORT}${BASE_PATH}`;
const READY_TIMEOUT_MS = 30_000;
const MEAL_TIMEOUT_MS = 20_000;
const BUBBLE_TIMEOUT_MS = 15_000;
const GEOMETRY_TOLERANCE_PX = 1;
const OFFICE_WALK_SPEED = 10;
const POSITION_SAMPLE_INTERVAL_MS = 50;
const SCENE_SCREENSHOT_MIN_BYTES = 20_000;
const ASSIGNMENT_STORAGE_KEY = "ccatOfficeAssignmentsV1";
const OFFICE_STATE_STORAGE_KEY = "ccatOfficeStateV1";
const API_CONFIG_STORAGE_KEY = "ccat-ai-api-configs";
const ME_PROFILE_STORAGE_KEY = "apiMeProfiles";
const CHARACTER_PROFILE_STORAGE_KEY = "apiCharacters";
const RELATION_STORAGE_KEY = "apiRelations";
const QA_WORK_SESSION_ID = "work-session-office-qa";
const QA_API_URL = "https://office-qa.invalid/v1/chat/completions";
const LONG_BUBBLE_TEXT = "1234567890".repeat(4);
const SIGNAL_PROBE_FLAG = "--probe-signal-cleanup";
const SIGNAL_PROBE_TARGET_ENV = "OFFICE_SIGNAL_PROBE_TARGET";
const SIGNAL_PROBE_MODE_ENV = "OFFICE_SIGNAL_PROBE_MODE";
const SIGNAL_PROBE_VITE_STARTED = "[office signal probe] Vite started";
const SIGNAL_PROBE_READY = "[office signal probe] browser and Vite ready";
const SIGNAL_PROBE_PRE_BROWSER_STALL = "[office signal probe] stalled before browser ready";
const SIGNAL_PROBE_BROWSER_CLOSED = "[office signal probe] browser closed";
const SIGNAL_PROBE_VITE_STOPPED = "[office signal probe] Vite stopped";
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const TINY_GIF_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const BROKEN_IMAGE_DATA_URL = "data:image/png;base64,SGVsbG8=";
const DIALOG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "select:not([disabled])",
  "input:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
const VIEWPORTS = [
  { width: 375, height: 812, verifyShellRestoration: true },
  { width: 390, height: 844, verifyShellRestoration: false },
];
const OFFICE_ASSET_IDS = [
  ...Array.from({ length: 4 }, (_, index) => `boss-f-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 4 }, (_, index) => `boss-m-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 4 }, (_, index) => `employee-f-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 4 }, (_, index) => `employee-m-${String(index + 1).padStart(2, "0")}`),
];
const ACTIVITY_FRAME_CONTRACT = Object.freeze({
  working: { row: 3, minColumn: 0, maxColumn: 3 },
  slacking: { row: 3, minColumn: 4, maxColumn: 7 },
  eating: { row: 4, minColumn: 0, maxColumn: 3 },
  gaming: { row: 4, minColumn: 4, maxColumn: 7 },
  reading: { row: 5, minColumn: 0, maxColumn: 3 },
  watchingSeries: { row: 5, minColumn: 4, maxColumn: 7 },
  watchingShortVideo: { row: 6, minColumn: 0, maxColumn: 3 },
});
const QA_ME_PROFILES = {
  "me-owner": { name: "沈知白", identity: "公司负责人", personality: "自然" },
  "me-founder": { name: "林见月", identity: "联合创始人", personality: "外向、果断" },
};
const QA_CHARACTER_PROFILES = {
  "character-main": { name: "周予安", identity: "主角色", type: "main", personality: "沉静" },
  "character-npc-1": { name: "程雾", identity: "NPC 角色", type: "npc", personality: "游戏、外向" },
  "character-npc-2": { name: "许青禾", identity: "NPC 角色", type: "npc", personality: "贪吃" },
  "character-npc-3": { name: "顾南星", identity: "NPC 角色", type: "npc", personality: "追剧、短视频" },
};
const QA_ASSIGNMENTS = {
  boss: { profileId: "me-owner", chibiId: "boss-f-01", customAssetSrc: "" },
  employee1: { profileId: "character-main", chibiId: "employee-f-01", customAssetSrc: "" },
  employee2: { profileId: "character-npc-1", chibiId: "employee-m-01", customAssetSrc: "" },
  employee3: { profileId: "character-npc-2", chibiId: "employee-f-02", customAssetSrc: "" },
  employee4: { profileId: "character-npc-3", chibiId: "employee-m-02", customAssetSrc: "" },
};
const QA_RELATIONS = {
  "relation-main-npc": {
    charA: "character-main",
    charB: "character-npc-1",
    type: "同事",
  },
};
const QA_API_CONFIG = {
  mainConfigs: [{
    id: "office-qa-endpoint",
    name: "Office QA",
    apiKey: "office-qa-key",
    baseUrl: "https://office-qa.invalid/v1",
    model: "office-qa-model",
    temperature: 0,
  }],
  selectedMainId: "office-qa-endpoint",
  secondaryConfigs: [],
  selectedSecondaryId: "",
  secondaryEnabled: false,
  retryCount: 0,
  failoverEnabled: false,
};
const QA_ACTIVITY_EVENTS = [
  {
    eventId: "qa-current-working",
    workSessionId: QA_WORK_SESSION_ID,
    actorId: "boss",
    participantIds: ["boss"],
    profileSnapshots: [{ name: "沈知白", personality: "自律、沉静" }],
    activityType: "working",
    status: "工作中",
    title: "工作记录",
    subject: "QA 当前工作记录",
    summary: "只属于当前工作时段的工作事件。",
    insightOrResult: "工作筛选应只显示这条记录。",
    requestSequence: 1,
    detailStatus: "complete",
  },
  {
    eventId: "qa-current-reading",
    workSessionId: QA_WORK_SESSION_ID,
    actorId: "employee1",
    participantIds: ["employee1"],
    profileSnapshots: [{ name: "周予安", personality: "沉静" }],
    activityType: "reading",
    status: "看书中",
    title: "阅读记录",
    subject: "QA 当前阅读记录",
    summary: "只属于当前工作时段的阅读事件。",
    insightOrResult: "阅读筛选应只显示这条记录。",
    propVariant: "hardcover",
    requestSequence: 1,
    detailStatus: "complete",
  },
  {
    eventId: "qa-old-gaming",
    workSessionId: "work-session-office-qa-old",
    actorId: "employee2",
    participantIds: ["employee2"],
    profileSnapshots: [{ name: "程雾", personality: "游戏" }],
    activityType: "gaming",
    status: "游戏中",
    title: "游戏记录",
    subject: "QA 旧时段事件不得显示",
    summary: "这条记录属于其他工作时段。",
    insightOrResult: "任何筛选结果都不能包含它。",
    requestSequence: 1,
    detailStatus: "complete",
  },
];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const viteCli = resolve(repositoryRoot, "node_modules/vite/bin/vite.js");
const qaDirectory = resolve(repositoryRoot, "docs/superpowers/qa");
const verifierPath = fileURLToPath(import.meta.url);

const delay = (milliseconds) => new Promise((resolveDelay) => {
  setTimeout(resolveDelay, milliseconds);
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectCount = async (locator, expected, label) => {
  const actual = await locator.count();
  assert(actual === expected, `${label}: expected ${expected}, received ${actual}`);
};

const waitForCount = async (locator, expected, label, timeoutMs = READY_TIMEOUT_MS) => {
  const deadline = Date.now() + timeoutMs;
  let actual = await locator.count();
  while (actual !== expected && Date.now() < deadline) {
    await delay(50);
    actual = await locator.count();
  }
  assert(actual === expected, `${label}: expected ${expected}, received ${actual}`);
};

const isAssetUrl = (url) => {
  try {
    return /\.(?:avif|gif|jpe?g|png|svg|webp|woff2?)(?:$|\?)/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

const parseTrailingPromptContext = (content) => {
  const source = String(content || "");
  const start = source.lastIndexOf("\n{");
  if (start < 0) throw new Error("mocked Office API prompt is missing trailing JSON context");
  return JSON.parse(source.slice(start + 1));
};

const installOfficeApiMock = async (context, apiRequests) => {
  await context.route(QA_API_URL, async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    const systemContent = body?.messages?.[0]?.content || "";
    const promptContext = parseTrailingPromptContext(systemContent);
    let content = "";

    if (systemContent.includes("补全当前办公室活动")) {
      const event = promptContext;
      apiRequests.push({ type: "activity", id: event.eventId });
      content = JSON.stringify({
        eventId: event.eventId,
        activityType: event.activityType,
        requestSequence: event.requestSequence,
        title: `QA ${event.activityType} 记录`,
        subject: `QA ${event.activityType} 主题`,
        summary: `QA ${event.activityType} 细节`,
        insightOrResult: `QA ${event.activityType} 结果`,
      });
    } else {
      const conversation = promptContext;
      const speakerId = conversation.members?.[0]?.memberId || "";
      apiRequests.push({ type: "conversation", id: conversation.conversationId });
      content = JSON.stringify({
        conversationId: conversation.conversationId,
        requestSequence: conversation.requestSequence,
        speakerId,
        text: String(conversation.conversationId).includes("-chat-1-")
          ? LONG_BUBBLE_TEXT
          : "这组会话保持自己的成员和话题。",
        end: false,
      });
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content } }] }),
    });
  });
};

const seedOfficeQaState = async (context) => {
  await context.addInitScript((seed) => {
    const now = Date.now();
    const events = seed.activityEvents.map((event, index) => ({
      ...event,
      startedAt: now - ((index + 1) * 60_000),
      endedAt: now - ((index + 1) * 30_000),
    }));
    const officeState = {
      mode: "free",
      now,
      durationMs: 8 * 60 * 60 * 1000,
      workSessionId: seed.workSessionId,
      conversations: {},
      activityEvents: events,
      activeEventBySlot: {},
      characters: {},
    };

    localStorage.setItem(seed.keys.assignments, JSON.stringify(seed.assignments));
    localStorage.setItem(seed.keys.officeState, JSON.stringify(officeState));
    localStorage.setItem(seed.keys.meProfiles, JSON.stringify(seed.meProfiles));
    localStorage.setItem(seed.keys.characterProfiles, JSON.stringify(seed.characterProfiles));
    localStorage.setItem(seed.keys.relations, JSON.stringify(seed.relations));
    localStorage.setItem(seed.keys.apiConfig, JSON.stringify(seed.apiConfig));

    let randomScenario = {};
    window.__setOfficeQaRandomValues = (scenario) => {
      randomScenario = scenario && typeof scenario === "object"
        ? {
            ...scenario,
            pickValues: [...(scenario.pickValues || [])],
            sessionValues: [...(scenario.sessionValues || [])],
          }
        : {};
    };
    window.__getOfficeQaRandomValues = () => ({ ...randomScenario });
    Math.random = () => {
      const stack = new Error().stack || "";
      let value = randomScenario.fallback ?? 0.35;
      if (stack.includes("getRandomCadence")) value = 0.35;
      else if (stack.includes("pickWeightedActivity")) value = randomScenario.activityRandom ?? value;
      else if (stack.includes("pickIndex")) value = randomScenario.pickValues?.shift() ?? value;
      else if (stack.includes("buildChatEvent")) value = randomScenario.groupSizeRandom ?? value;
      else if (stack.includes("buildConversationSession")) {
        value = randomScenario.sessionValues?.shift() ?? value;
      } else if (stack.includes("startDeskActivity")) value = 0.2;
      return Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0.35;
    };
  }, {
    activityEvents: QA_ACTIVITY_EVENTS,
    apiConfig: QA_API_CONFIG,
    assignments: QA_ASSIGNMENTS,
    characterProfiles: QA_CHARACTER_PROFILES,
    keys: {
      apiConfig: API_CONFIG_STORAGE_KEY,
      assignments: ASSIGNMENT_STORAGE_KEY,
      characterProfiles: CHARACTER_PROFILE_STORAGE_KEY,
      meProfiles: ME_PROFILE_STORAGE_KEY,
      officeState: OFFICE_STATE_STORAGE_KEY,
      relations: RELATION_STORAGE_KEY,
    },
    meProfiles: QA_ME_PROFILES,
    relations: QA_RELATIONS,
    workSessionId: QA_WORK_SESSION_ID,
  });
};

const setOfficeQaRandomValues = (page, scenario) => page.evaluate((nextScenario) => {
  if (typeof window.__setOfficeQaRandomValues !== "function") {
    throw new Error("Office QA random controller is unavailable");
  }
  window.__setOfficeQaRandomValues(nextScenario);
}, scenario);

const rectLabel = (rect) => (
  `[${rect.left.toFixed(1)}, ${rect.top.toFixed(1)} -> ${rect.right.toFixed(1)}, ${rect.bottom.toFixed(1)}]`
);

const isInside = (inner, outer) => (
  inner.left >= outer.left - GEOMETRY_TOLERANCE_PX
  && inner.top >= outer.top - GEOMETRY_TOLERANCE_PX
  && inner.right <= outer.right + GEOMETRY_TOLERANCE_PX
  && inner.bottom <= outer.bottom + GEOMETRY_TOLERANCE_PX
);

const overlaps = (left, right) => (
  Math.min(left.right, right.right) - Math.max(left.left, right.left) > GEOMETRY_TOLERANCE_PX
  && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > GEOMETRY_TOLERANCE_PX
);

const startVite = () => {
  const child = spawn(process.execPath, [
    viteCli,
    "--host",
    HOST,
    "--port",
    String(PORT),
    "--strictPort",
    "--base",
    BASE_PATH,
  ], {
    cwd: repositoryRoot,
    detached: process.platform !== "win32",
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const appendOutput = (chunk) => {
    output += chunk.toString();
  };
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);

  const exit = new Promise((resolveExit) => {
    child.once("error", (error) => resolveExit({ error }));
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });

  return {
    child,
    exit,
    getOutput: () => output.trim(),
  };
};

const waitForVite = async (server) => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    const probe = fetch(APP_URL, { signal: AbortSignal.timeout(1_000) })
      .then(async (response) => ({ response, html: await response.text() }))
      .catch((error) => ({ error }));
    const result = await Promise.race([
      probe.then((value) => ({ type: "probe", value })),
      server.exit.then((value) => ({ type: "exit", value })),
    ]);

    if (result.type === "exit") {
      const detail = result.value.error?.message
        || `exit code ${result.value.code ?? "unknown"}, signal ${result.value.signal ?? "none"}`;
      throw new Error(`Vite exited before readiness (${detail})`);
    }

    if (result.value.response?.ok && result.value.html.includes('id="root"')) return;
    lastError = result.value.error || new Error(`HTTP ${result.value.response?.status ?? "unknown"}`);
    await delay(200);
  }

  throw new Error(`Vite was not ready within ${READY_TIMEOUT_MS}ms: ${lastError?.message || "unknown error"}`);
};

const signalProcess = (child, signal) => {
  if (!child.pid) return;
  if (process.platform === "win32") {
    child.kill(signal);
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
};

const stopVite = async (server) => {
  const { child } = server;
  if (child.exitCode !== null || child.signalCode !== null) return;

  signalProcess(child, "SIGTERM");
  const stoppedGracefully = await Promise.race([
    server.exit.then(() => true),
    delay(3_000).then(() => false),
  ]);
  if (stoppedGracefully) return;

  signalProcess(child, "SIGKILL");
  await Promise.race([server.exit, delay(2_000)]);
};

const openWork = async (page) => {
  const secondLauncherPage = page.getByRole("button", { name: "第 2 页", exact: true });
  await secondLauncherPage.waitFor({ state: "visible" });
  await secondLauncherPage.click();

  const workLauncher = page.getByRole("button", { name: "工作", exact: true });
  await workLauncher.click();
  await page.locator(".work-app-screen").waitFor({ state: "visible" });
  await page.getByText("工作剩余", { exact: true }).waitFor({ state: "visible" });
};

const enterOffice = async (page, { reload = false } = {}) => {
  if (reload) await page.reload({ waitUntil: "domcontentloaded" });
  else await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  const unlock = page.getByRole("button", { name: "上划解锁", exact: true });
  if (await unlock.count()) await unlock.click();
  await page.locator(".phone-surface").waitFor({ state: "visible" });
  await openWork(page);
};

const verifyOfficeStructure = async (page, viewportLabel) => {
  await expectCount(page.locator(".office-character"), 5, `${viewportLabel} office characters`);
  await expectCount(
    page.locator('img.office-scene-background[src$="office-bg.webp"]'),
    1,
    `${viewportLabel} new office background`,
  );
  const selectedModules = page.locator(".office-module-layer > img.office-module-image");
  await expectCount(selectedModules, 6, `${viewportLabel} selected office modules`);
  const moduleInventory = await selectedModules.evaluateAll(async (images) => Promise.all(images.map(async (image) => {
    try {
      await image.decode();
    } catch (error) {
      throw new Error(
        `could not decode office module ${image.getAttribute("data-module-id") || "unknown"} `
        + `from ${image.currentSrc || image.src} (complete=${image.complete}, `
        + `natural=${image.naturalWidth}x${image.naturalHeight}): ${error.message}`,
      );
    }
    return {
      id: image.getAttribute("data-module-id") || "",
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  })));
  assert(moduleInventory.filter(({ id }) => id.startsWith("break-")).length === 1,
    `${viewportLabel}: expected one selected break module`);
  assert(moduleInventory.filter(({ id }) => !id.startsWith("break-")).length === 5,
    `${viewportLabel}: expected five selected station modules`);
  assert(new Set(moduleInventory.map(({ id }) => id)).size === 6,
    `${viewportLabel}: selected office modules should be unique`);
  assert(moduleInventory.every(({ width, height }) => width === 1080 && height === 1920),
    `${viewportLabel}: selected office modules should decode at 1080x1920`);
  await expectCount(page.locator(".office-character:visible"), 5, `${viewportLabel} visible characters`);
  await expectCount(page.locator(".office-character-name:visible"), 5, `${viewportLabel} visible names`);

  const shellBaseline = await page.evaluate(() => {
    const header = document.querySelector(".work-app-header");
    const screen = document.querySelector(".work-app-screen");
    const surface = document.querySelector(".work-office-surface");
    if (!header || !screen || !surface) return null;
    const safeTopProbe = document.createElement("span");
    safeTopProbe.style.cssText = [
      "position:fixed",
      "visibility:hidden",
      "pointer-events:none",
      "top:var(--app-safe-top-clearance)",
    ].join(";");
    document.body.append(safeTopProbe);
    const safeTop = Number.parseFloat(getComputedStyle(safeTopProbe).top);
    safeTopProbe.remove();
    const headerRect = header.getBoundingClientRect();
    const screenRect = screen.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    return {
      safeTop,
      headerTop: headerRect.top - screenRect.top,
      surfaceTop: surfaceRect.top - screenRect.top,
      computedSurfaceTop: Number.parseFloat(getComputedStyle(surface).top),
    };
  });
  assert(shellBaseline && Number.isFinite(shellBaseline.safeTop),
    `${viewportLabel}: could not read --app-safe-top-clearance`);
  assert(shellBaseline.headerTop + GEOMETRY_TOLERANCE_PX >= shellBaseline.safeTop,
    `${viewportLabel}: Work header top ${shellBaseline.headerTop}px is above safe clearance ${shellBaseline.safeTop}px`);
  assert(Math.abs(shellBaseline.computedSurfaceTop - 100) <= GEOMETRY_TOLERANCE_PX,
    `${viewportLabel}: .work-office-surface computed top is ${shellBaseline.computedSurfaceTop}px, expected 100px`);
  assert(Math.abs(shellBaseline.surfaceTop - 100) <= GEOMETRY_TOLERANCE_PX,
    `${viewportLabel}: .work-office-surface baseline is ${shellBaseline.surfaceTop}px, expected 100px`);
};

const verifyBuiltInOfficeAssets = async (page, viewportLabel) => {
  const sources = OFFICE_ASSET_IDS.map((id) => `${APP_URL}work-office-assets/chibi/${id}.webp`);
  const decoded = await page.evaluate(async (assetSources) => {
    const results = [];
    for (const src of assetSources) {
      const image = new Image();
      image.src = src;
      try {
        await image.decode();
      } catch (error) {
        throw new Error(
          `could not decode chibi atlas ${src} (complete=${image.complete}, `
          + `natural=${image.naturalWidth}x${image.naturalHeight}): ${error.message}`,
        );
      }
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparentPixels = 0;
      let opaquePixels = 0;
      let gutterOpaquePixels = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] === 0) transparentPixels += 1;
        if (pixels[index] === 255) opaquePixels += 1;
      }
      const atlasSize = image.naturalWidth;
      const cellSize = atlasSize / 8;
      for (let boundary = cellSize; boundary < atlasSize; boundary += cellSize) {
        for (let offset = -12; offset < 12; offset += 1) {
          for (let coordinate = 0; coordinate < atlasSize; coordinate += 1) {
            const verticalAlpha = pixels[((coordinate * atlasSize) + boundary + offset) * 4 + 3];
            const horizontalAlpha = pixels[(((boundary + offset) * atlasSize) + coordinate) * 4 + 3];
            if (verticalAlpha > 0) gutterOpaquePixels += 1;
            if (horizontalAlpha > 0) gutterOpaquePixels += 1;
          }
        }
      }
      results.push({
        src,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        transparentPixels,
        opaquePixels,
        gutterOpaquePixels,
      });
      canvas.width = 0;
      canvas.height = 0;
      image.src = "";
    }
    return results;
  }, sources);
  assert(decoded.length === 16, `${viewportLabel}: decoded ${decoded.length} built-in WebP assets, expected 16`);
  for (const asset of decoded) {
    assert(asset.naturalWidth === 2048 && asset.naturalHeight === 2048,
      `${viewportLabel}: Office asset is not 2048x2048: ${asset.src}`);
    assert(asset.transparentPixels > 0 && asset.opaquePixels > 0,
      `${viewportLabel}: Office asset does not contain decoded transparent and opaque pixels: ${asset.src}`);
    assert(asset.gutterOpaquePixels === 0,
      `${viewportLabel}: Office asset crosses a twelve-pixel sprite-cell gutter: ${asset.src}`);
  }
};

const verifyWorkShellRoundTrip = async (page, viewport) => {
  const phoneSurface = page.locator(".phone-surface");
  const workScreen = page.locator(".work-app-screen");

  assert(await phoneSurface.evaluate((element) => element.classList.contains("work-opening")),
    "opening Work did not add .phone-surface.work-opening");

  const shellGeometry = await workScreen.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  assert(shellGeometry.position === "fixed", `Work screen position is ${shellGeometry.position}, expected fixed`);
  assert(
    Math.abs(shellGeometry.rect.left) <= GEOMETRY_TOLERANCE_PX
      && Math.abs(shellGeometry.rect.top) <= GEOMETRY_TOLERANCE_PX
      && Math.abs(shellGeometry.rect.right - shellGeometry.viewport.width) <= GEOMETRY_TOLERANCE_PX
      && Math.abs(shellGeometry.rect.bottom - shellGeometry.viewport.height) <= GEOMETRY_TOLERANCE_PX,
    `Work screen is not full-bleed at ${viewport.width}x${viewport.height}: ${rectLabel(shellGeometry.rect)}`,
  );

  await page.getByRole("button", { name: "返回", exact: true }).click();
  await workScreen.waitFor({ state: "detached" });
  await page.waitForFunction(() => !document.querySelector(".phone-surface")?.classList.contains("work-opening"));

  await expectCount(page.locator(".work-app-screen"), 0, "closed Work screens");
  assert(!(await phoneSurface.evaluate((element) => element.classList.contains("work-opening"))),
    "returning from Work left .phone-surface.work-opening behind");
  await page.locator(".home-view").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "工作", exact: true }).waitFor({ state: "visible" });

  await openWork(page);
};

const getStoredCustomAssetSource = (page, slotId) => page.evaluate(({ key, targetSlotId }) => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    return stored?.[targetSlotId]?.customAssetSrc || "";
  } catch {
    return "";
  }
}, { key: ASSIGNMENT_STORAGE_KEY, targetSlotId: slotId });

const verifyAssignmentWorkflow = async (page) => {
  const opener = page.getByRole("button", { name: "员工安排", exact: true });
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "员工安排", exact: true });
  const overviewBackButton = dialog.getByRole("button", { name: "返回办公室", exact: true });
  await dialog.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.activeElement?.matches("[data-office-dialog-close]"));
  assert(await overviewBackButton.evaluate((element) => document.activeElement === element),
    "assignment dialog did not move focus to its close button");

  const inertState = await page.evaluate(() => Object.fromEntries([
    ["header", ".work-app-header"],
    ["modes", ".work-mode-control"],
    ["surface", ".work-office-surface"],
  ].map(([name, selector]) => {
    const element = document.querySelector(selector);
    return [name, Boolean(element?.inert && element.getAttribute("aria-hidden") === "true")];
  })));
  for (const [region, isInert] of Object.entries(inertState)) {
    assert(isInert, `assignment dialog left the Work ${region} interactive`);
  }

  await page.keyboard.press("Shift+Tab");
  const wrappedBackward = await dialog.evaluate((element, selector) => {
    const focusable = [...element.querySelectorAll(selector)]
      .filter((candidate) => candidate.tabIndex >= 0 && candidate.getAttribute("aria-hidden") !== "true");
    return focusable.length > 1 && document.activeElement === focusable.at(-1);
  }, DIALOG_FOCUSABLE_SELECTOR);
  assert(wrappedBackward, "Shift+Tab did not wrap from the first to the last dialog control");

  await page.keyboard.press("Tab");
  const wrappedForward = await dialog.evaluate((element, selector) => {
    const focusable = [...element.querySelectorAll(selector)]
      .filter((candidate) => candidate.tabIndex >= 0 && candidate.getAttribute("aria-hidden") !== "true");
    return focusable.length > 1 && document.activeElement === focusable[0];
  }, DIALOG_FOCUSABLE_SELECTOR);
  assert(wrappedForward, "Tab did not wrap from the last to the first dialog control");

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "员工安排");
  assert(await opener.evaluate((element) => document.activeElement === element),
    "Escape did not restore focus to the assignment opener");

  await opener.click();
  await dialog.waitFor({ state: "visible" });
  await dialog.locator(".office-assignment-overview button").filter({ hasText: "老板" }).click();
  const selectionBackButton = dialog.getByRole("button", { name: "返回员工安排", exact: true });
  await selectionBackButton.waitFor({ state: "visible" });
  const bossProfileOptions = await dialog.getByLabel("老板角色", { exact: true }).evaluate((select) => (
    [...select.options].filter((option) => option.value).map((option) => ({
      label: option.textContent?.trim() || "",
      value: option.value,
    }))
  ));
  assert(JSON.stringify(bossProfileOptions.map((option) => option.value)) === JSON.stringify(Object.keys(QA_ME_PROFILES)),
    `boss options are not limited to Me profiles: ${JSON.stringify(bossProfileOptions)}`);

  await selectionBackButton.click();
  await overviewBackButton.waitFor({ state: "visible" });
  await dialog.locator(".office-assignment-overview button").filter({ hasText: "员工一" }).click();
  await selectionBackButton.waitFor({ state: "visible" });
  const employeeProfileOptions = await dialog.getByLabel("员工一角色", { exact: true }).evaluate((select) => (
    [...select.options].filter((option) => option.value).map((option) => ({
      label: option.textContent?.trim() || "",
      value: option.value,
    }))
  ));
  assert(
    JSON.stringify(employeeProfileOptions.map((option) => option.value))
      === JSON.stringify(Object.keys(QA_CHARACTER_PROFILES)),
    `employee options do not contain exactly the Character profiles: ${JSON.stringify(employeeProfileOptions)}`,
  );
  assert(employeeProfileOptions.some((option) => option.value === "character-main" && option.label.includes("周予安")),
    "employee options are missing the main Character profile");
  assert(employeeProfileOptions.some((option) => option.value.startsWith("character-npc-") && option.label.includes("程雾")),
    "employee options are missing an NPC Character profile");

  await selectionBackButton.click();
  await overviewBackButton.waitFor({ state: "visible" });
  await overviewBackButton.click();
  await dialog.waitFor({ state: "detached" });
  await page.locator(".office-scene").waitFor({ state: "visible" });

  await opener.click();
  await dialog.waitFor({ state: "visible" });
  await dialog.locator(".office-assignment-overview button").filter({ hasText: "老板" }).click();
  await selectionBackButton.waitFor({ state: "visible" });
  const uploadInput = dialog.getByLabel("老板上传形象", { exact: true });
  const urlInput = dialog.getByLabel("老板形象地址", { exact: true });
  const bossAlert = dialog.getByRole("alert");
  const bossSprite = page.locator('.office-character[data-slot="boss"] .office-character-custom-sprite');
  const tinyPng = {
    name: "office-qa-1x1.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
  };

  await uploadInput.setInputFiles({
    name: "office-qa-too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(1024 * 1024 + 1),
  });
  await bossAlert.waitFor({ state: "visible" });
  assert((await bossAlert.innerText()).includes("图片不能超过 1 MB"),
    "oversized upload did not show the visible 1 MB limit error");

  await uploadInput.setInputFiles(tinyPng);
  await page.waitForFunction(() => (
    document.querySelector('input[aria-label="老板形象地址"]')?.value.startsWith("data:image/png;base64,")
  ));
  const uploadedSource = await urlInput.inputValue();
  assert(uploadedSource.startsWith("data:image/png;base64,"),
    "valid image upload did not populate a data:image controlled draft");
  await page.waitForFunction(({ key, expected }) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}")?.boss?.customAssetSrc === expected;
    } catch {
      return false;
    }
  }, { key: ASSIGNMENT_STORAGE_KEY, expected: uploadedSource });
  await bossSprite.waitFor({ state: "visible" });

  await urlInput.fill(BROKEN_IMAGE_DATA_URL);
  await page.waitForFunction(() => (
    document.querySelector('input[aria-label="老板形象地址"]')?.value === ""
  ));
  await bossAlert.waitFor({ state: "visible" });
  assert((await bossAlert.innerText()).includes("图片加载失败，已恢复内置形象"),
    "broken custom image did not show load-fallback feedback");
  assert(await getStoredCustomAssetSource(page, "boss") === "",
    "broken custom image did not clear persisted customAssetSrc");
  await expectCount(bossSprite, 0, "custom boss sprites after image fallback");

  await uploadInput.setInputFiles(tinyPng);
  await page.waitForFunction(() => (
    document.querySelector('input[aria-label="老板形象地址"]')?.value.startsWith("data:image/png;base64,")
  ));
  const priorAppliedSource = await urlInput.inputValue();
  await page.waitForFunction(({ key, expected }) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}")?.boss?.customAssetSrc === expected;
    } catch {
      return false;
    }
  }, { key: ASSIGNMENT_STORAGE_KEY, expected: priorAppliedSource });
  await bossSprite.waitFor({ state: "visible" });
  const priorSpriteSource = await bossSprite.getAttribute("src");
  const priorStoredAssignments = await page.evaluate((key) => localStorage.getItem(key), ASSIGNMENT_STORAGE_KEY);

  await page.evaluate((storageKey) => {
    if (window.__officeQaOriginalStorageSetItem) throw new Error("storage failure probe already installed");
    const originalSetItem = Storage.prototype.setItem;
    window.__officeQaOriginalStorageSetItem = originalSetItem;
    Storage.prototype.setItem = function setItemWithOfficeQuotaFailure(key, value) {
      if (String(key) === storageKey) throw new DOMException("Quota exceeded", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    };
  }, ASSIGNMENT_STORAGE_KEY);

  try {
    await urlInput.fill(TINY_GIF_DATA_URL);
    await page.waitForFunction(() => (
      [...document.querySelectorAll(".office-field-error")]
        .some((element) => element.textContent?.includes("图片无法保存"))
    ));
  } finally {
    await page.evaluate(() => {
      const originalSetItem = window.__officeQaOriginalStorageSetItem;
      if (originalSetItem) Storage.prototype.setItem = originalSetItem;
      delete window.__officeQaOriginalStorageSetItem;
    });
  }

  assert((await bossAlert.innerText()).includes("图片无法保存"),
    "quota failure did not show the custom-source storage error");
  assert(await page.evaluate((key) => localStorage.getItem(key), ASSIGNMENT_STORAGE_KEY) === priorStoredAssignments,
    "quota failure changed the prior persisted assignment");
  assert(await bossSprite.getAttribute("src") === priorSpriteSource,
    "quota failure changed the prior applied assignment");
  assert(await page.evaluate(() => !window.__officeQaOriginalStorageSetItem),
    "Storage.prototype.setItem was not restored after the quota probe");

  await urlInput.fill("");
  await page.waitForFunction((key) => {
    try {
      return (JSON.parse(localStorage.getItem(key) || "{}")?.boss?.customAssetSrc || "") === "";
    } catch {
      return false;
    }
  }, ASSIGNMENT_STORAGE_KEY);
  await expectCount(bossSprite, 0, "custom boss sprites after assignment cleanup");

  await selectionBackButton.click();
  await overviewBackButton.waitFor({ state: "visible" });
  await overviewBackButton.click();
  await dialog.waitFor({ state: "detached" });
  await page.locator(".office-scene").waitFor({ state: "visible" });
  return {
    assignmentBack: true,
    fallback: true,
    profileSources: true,
    quotaRollback: true,
    upload: true,
  };
};

const verifyActivityFilters = async (page) => {
  await page.getByRole("button", { name: "活动记录", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "活动记录", exact: true });
  await dialog.waitFor({ state: "visible" });

  const entries = dialog.locator(".office-activity-entry");
  await waitForCount(entries, 2, "current-session activity entries");
  await expectCount(dialog.getByText("QA 当前工作记录", { exact: true }), 1, "seeded current work event");
  await expectCount(dialog.getByText("QA 当前阅读记录", { exact: true }), 1, "seeded current reading event");
  await expectCount(dialog.getByText("QA 旧时段事件不得显示", { exact: true }), 0, "old-session events");

  const actorFilter = dialog.getByLabel("按角色筛选", { exact: true });
  const activityFilter = dialog.getByLabel("按活动筛选", { exact: true });
  await actorFilter.selectOption("boss");
  await waitForCount(entries, 1, "boss-filtered current-session activity entries");
  await expectCount(dialog.getByText("QA 当前工作记录", { exact: true }), 1, "boss-filtered work event");
  await expectCount(dialog.getByText("QA 当前阅读记录", { exact: true }), 0, "boss-filtered reading events");

  await actorFilter.selectOption("");
  await activityFilter.selectOption("reading");
  await waitForCount(entries, 1, "reading-filtered current-session activity entries");
  await expectCount(dialog.getByText("QA 当前阅读记录", { exact: true }), 1, "reading-filtered event");
  await expectCount(dialog.getByText("QA 当前工作记录", { exact: true }), 0, "reading-filtered work events");

  await dialog.getByRole("button", { name: "关闭活动记录", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await page.locator(".office-scene").waitFor({ state: "visible" });
  return { actor: true, activity: true, currentSessionOnly: true };
};

const triggerScheduledActivity = async (page, {
  activity,
  activityRandom,
  status,
}) => {
  await setOfficeQaRandomValues(page, {
    activityRandom,
    fallback: 0.2,
    pickValues: [0, 0.2],
  });
  await page.getByRole("button", { name: "休息一下", exact: true }).click();
  const character = page.locator(
    `.office-character[data-activity="${activity}"]:not([data-phase="walkingToActivity"]):not([data-phase="returning"])`,
  ).first();
  try {
    await character.waitFor({ state: "visible", timeout: 6_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      activeMode: document.querySelector('.work-mode-control button[data-active="true"]')?.textContent?.trim() || "",
      characters: [...document.querySelectorAll(".office-character")].map((element) => ({
        activity: element.getAttribute("data-activity"),
        phase: element.getAttribute("data-phase"),
        slot: element.getAttribute("data-slot"),
        status: element.querySelector(".office-character-status span")?.textContent?.trim() || "",
      })),
      randomValues: window.__getOfficeQaRandomValues?.() || [],
    }));
    throw new Error(`scheduled ${activity} did not reach its atlas action: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    });
  }
  const rendered = await character.evaluate((element) => {
    const sprite = element.querySelector(".office-character-atlas-sprite");
    const rect = sprite?.getBoundingClientRect();
    return {
    activity: element.getAttribute("data-activity") || "",
    frameRow: Number.parseInt(sprite?.style.getPropertyValue("--office-frame-row") || "-1", 10),
    frameColumn: Number.parseInt(sprite?.style.getPropertyValue("--office-frame-column") || "-1", 10),
    spriteVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
    status: element.querySelector(".office-character-status span")?.textContent?.trim() || "",
    };
  });
  const frameContract = ACTIVITY_FRAME_CONTRACT[activity];
  assert(rendered.activity === activity,
    `atlas action appeared under ${rendered.activity || "no activity"}, expected ${activity}`);
  assert(rendered.status === status,
    `${activity} appeared under ${JSON.stringify(rendered.status)}, expected ${JSON.stringify(status)}`);
  assert(rendered.spriteVisible, `${activity} atlas sprite is present but not visibly rendered`);
  assert(frameContract && rendered.frameRow === frameContract.row,
    `${activity} rendered atlas row ${rendered.frameRow}, expected ${frameContract?.row}`);
  assert(rendered.frameColumn >= frameContract.minColumn && rendered.frameColumn <= frameContract.maxColumn,
    `${activity} rendered atlas column ${rendered.frameColumn}, expected ${frameContract.minColumn}-${frameContract.maxColumn}`);
  const slotId = await character.getAttribute("data-slot");
  await expectCount(
    page.locator(`.office-module-image[data-module-id="${slotId}-active-shell"]`),
    1,
    `${activity} active-shell module`,
  );
  return slotId;
};

const verifyDeskActivityProps = async (page) => {
  const cases = [
    { activity: "working", activityRandom: 0.01, status: "工作中" },
    { activity: "slacking", activityRandom: 0.25, status: "摸鱼中" },
    { activity: "gaming", activityRandom: 0.55, status: "游戏中" },
    { activity: "reading", activityRandom: 0.1, status: "看书中" },
    { activity: "watchingSeries", activityRandom: 0.68, status: "刷剧中" },
    {
      activity: "watchingShortVideo",
      activityRandom: 0.8,
      status: "看抖音中",
    },
  ];
  const covered = [];
  for (const activityCase of cases) {
    await enterOffice(page, { reload: true });
    await triggerScheduledActivity(page, activityCase);
    covered.push(activityCase.activity);
  }
  return covered;
};

const verifyMealAndWalk = async (page) => {
  await enterOffice(page, { reload: true });
  await setOfficeQaRandomValues(page, {
    activityRandom: 0.35,
    fallback: 0.2,
    pickValues: [0, 0, 0.35],
  });
  await page.getByRole("button", { name: "休息一下", exact: true }).click();
  const journey = await observeRestJourney(page);
  assert(journey.slotId === "boss", `deterministic meal walk tracked ${journey.slotId}, expected boss`);

  const character = page.locator(`.office-character[data-slot="${journey.slotId}"]`);
  const mealState = await character.evaluate((element) => ({
    activity: element.getAttribute("data-activity") || "",
    frameRow: Number.parseInt(element.querySelector(".office-character-atlas-sprite")?.style
      .getPropertyValue("--office-frame-row") || "-1", 10),
    frameColumn: Number.parseInt(element.querySelector(".office-character-atlas-sprite")?.style
      .getPropertyValue("--office-frame-column") || "-1", 10),
    status: element.querySelector(".office-character-status span")?.textContent?.trim() || "",
  }));
  assert(mealState.activity === "eating" && mealState.status === "吃饭中",
    `meal atlas appeared under ${mealState.activity}/${mealState.status}, expected eating/吃饭中`);
  assert(mealState.frameRow === 4 && mealState.frameColumn >= 0 && mealState.frameColumn <= 3,
    `meal atlas rendered row/column ${mealState.frameRow}/${mealState.frameColumn}, expected row 4 columns 0-3`);
  assert(await page.locator('.office-module-image[data-module-id^="break-"]:not([data-module-state="both-empty"])').count() === 1,
    "meal did not switch the break counter to an occupied state");
  return journey;
};

const verifyTwoConversationCoverage = async (page) => {
  await enterOffice(page, { reload: true });
  await setOfficeQaRandomValues(page, {
    activityRandom: 0.92,
    fallback: 0.2,
    groupSizeRandom: 0,
    pickValues: [0, 0, 0.1],
    sessionValues: [0.1],
  });
  await page.getByRole("button", { name: "休息一下", exact: true }).click();
  await waitForCount(
    page.locator('.office-character[data-activity="chatting"]'),
    2,
    "first conversation members",
    MEAL_TIMEOUT_MS,
  );

  await setOfficeQaRandomValues(page, {
    activityRandom: 0.92,
    fallback: 0.2,
    groupSizeRandom: 0,
    pickValues: [0, 0, 0.2],
    sessionValues: [0.2],
  });
  await page.getByRole("button", { name: "休息一下", exact: true }).click();
  await waitForCount(
    page.locator('.office-character[data-activity="chatting"]'),
    4,
    "two disjoint conversation member sets",
    MEAL_TIMEOUT_MS,
  );

  const bubbles = page.locator(".office-speech-bubble:visible");
  await waitForCount(bubbles, 2, "two disjoint conversation bubbles", BUBBLE_TIMEOUT_MS);
  await waitForCount(page.locator(".office-chat-prop:visible"), 2, "chat props", BUBBLE_TIMEOUT_MS);
  const conversationStatusCount = await page.locator('.office-character[data-activity="chatting"] .office-character-status span')
    .evaluateAll((statuses) => statuses.filter((status) => status.textContent?.trim() === "闲聊中").length);
  assert(conversationStatusCount === 4,
    `chat/listen props are not all under 闲聊中 status (${conversationStatusCount}/4)`);

  const isolation = await page.evaluate((longText) => {
    const groups = {};
    for (const character of document.querySelectorAll(".office-character[data-conversation-group]")) {
      const conversationId = character.getAttribute("data-conversation-group") || "";
      const slotId = character.getAttribute("data-slot") || "";
      if (!groups[conversationId]) groups[conversationId] = [];
      groups[conversationId].push(slotId);
    }
    const bubbleRecords = [...document.querySelectorAll(".office-speech-bubble")].map((bubble) => ({
      conversationId: bubble.getAttribute("data-conversation-id") || "",
      slotId: bubble.closest(".office-character")?.getAttribute("data-slot") || "",
      text: bubble.textContent?.trim() || "",
    }));
    const longBubble = [...document.querySelectorAll(".office-speech-bubble")]
      .find((bubble) => bubble.textContent?.trim() === longText);
    const sceneRect = document.querySelector(".office-scene")?.getBoundingClientRect();
    const bubbleRect = longBubble?.getBoundingClientRect();
    const bubbleStyle = longBubble ? getComputedStyle(longBubble) : null;
    let contentScrollHeight = 0;
    if (longBubble) {
      const measurementStyle = document.createElement("style");
      measurementStyle.textContent = `
        .office-speech-bubble[data-office-qa-measure-content="true"]::after {
          display: none !important;
        }
      `;
      longBubble.setAttribute("data-office-qa-measure-content", "true");
      document.head.append(measurementStyle);
      contentScrollHeight = longBubble.scrollHeight;
      measurementStyle.remove();
      longBubble.removeAttribute("data-office-qa-measure-content");
    }
    return {
      groups,
      bubbleRecords,
      longBubble: longBubble && sceneRect && bubbleRect && bubbleStyle ? {
        clientHeight: longBubble.clientHeight,
        clientWidth: longBubble.clientWidth,
        insideScene: bubbleRect.left >= sceneRect.left - 1
          && bubbleRect.right <= sceneRect.right + 1
          && bubbleRect.top >= sceneRect.top - 1
          && bubbleRect.bottom <= sceneRect.bottom + 1,
        lineHeight: Number.parseFloat(bubbleStyle.lineHeight),
        rectHeight: bubbleRect.height,
        contentScrollHeight,
        scrollHeight: longBubble.scrollHeight,
        scrollWidth: longBubble.scrollWidth,
      } : null,
    };
  }, LONG_BUBBLE_TEXT);

  const conversationIds = Object.keys(isolation.groups);
  assert(conversationIds.length === 2,
    `expected two conversation IDs, received ${JSON.stringify(conversationIds)}`);
  const firstMembers = new Set(isolation.groups[conversationIds[0]]);
  const secondMembers = isolation.groups[conversationIds[1]];
  assert(secondMembers.every((slotId) => !firstMembers.has(slotId)),
    `conversation member sets overlap: ${JSON.stringify(isolation.groups)}`);
  assert(isolation.bubbleRecords.length === 2,
    `expected two member bubbles, received ${JSON.stringify(isolation.bubbleRecords)}`);
  for (const bubble of isolation.bubbleRecords) {
    assert(isolation.groups[bubble.conversationId]?.includes(bubble.slotId),
      `bubble leaked across conversations: ${JSON.stringify(bubble)}`);
  }

  const longBubble = isolation.longBubble;
  assert(longBubble, "the mocked 40-digit conversation bubble was not rendered");
  assert(longBubble.insideScene, "the 40-digit conversation bubble extends outside the office scene");
  assert(longBubble.rectHeight > longBubble.lineHeight * 1.5,
    "the 40-digit conversation bubble did not wrap onto multiple lines");
  assert(longBubble.scrollWidth <= longBubble.clientWidth + GEOMETRY_TOLERANCE_PX,
    `the 40-digit bubble overflows horizontally (${longBubble.scrollWidth}/${longBubble.clientWidth})`);
  assert(longBubble.contentScrollHeight === longBubble.clientHeight,
    `the 40-digit bubble clips vertically (${longBubble.contentScrollHeight}/${longBubble.clientHeight}); `
    + `decorated scrollHeight=${longBubble.scrollHeight}`);
  return { conversationIds, longBubble: true };
};

const prepareMeetingScreenshot = async (page) => {
  await setOfficeQaRandomValues(page, {
    fallback: 0.2,
    pickValues: [0.1],
    sessionValues: [0.1],
  });
  await page.getByRole("button", { name: "开会", exact: true }).click();
  const bubble = page.locator(".office-speech-bubble:visible").first();
  await bubble.waitFor({ state: "visible", timeout: BUBBLE_TIMEOUT_MS });
  await page.locator(".office-chat-prop:visible").first().waitFor({ state: "visible", timeout: BUBBLE_TIMEOUT_MS });
};

const observeRestJourney = async (page) => {
  const deadline = Date.now() + MEAL_TIMEOUT_MS;
  const facings = new Set();
  let trackedSlotId = "";
  let previous = null;
  let maximumJumpPx = 0;
  let positionChangedBeforeEating = false;
  let samples = 0;

  while (Date.now() < deadline) {
    const sample = await page.evaluate((slotId) => {
      const character = slotId
        ? document.querySelector(`.office-character[data-slot="${CSS.escape(slotId)}"]`)
        : document.querySelector('.office-character[data-phase="walkingToActivity"][data-activity="eating"]');
      if (!character) return null;
      const sceneRect = document.querySelector(".office-scene")?.getBoundingClientRect();
      const sprite = character.querySelector(".office-character-atlas-sprite");
      const frameRow = Number.parseInt(sprite?.style.getPropertyValue("--office-frame-row") || "-1", 10);
      const frameColumn = Number.parseInt(sprite?.style.getPropertyValue("--office-frame-column") || "-1", 10);
      return {
        slotId: character.getAttribute("data-slot") || "",
        phase: character.getAttribute("data-phase") || "",
        facing: character.getAttribute("data-facing") || "",
        left: Number.parseFloat(character.style.left),
        top: Number.parseFloat(character.style.top),
        renderedAt: Number.parseFloat(character.getAttribute("data-motion-now")),
        sceneWidth: sceneRect?.width || 0,
        sceneHeight: sceneRect?.height || 0,
        mealVisible: character.getAttribute("data-activity") === "eating"
          && character.getAttribute("data-phase") !== "walkingToActivity"
          && character.getAttribute("data-phase") !== "returning"
          && frameRow === 4
          && frameColumn >= 0
          && frameColumn <= 3,
      };
    }, trackedSlotId);

    if (sample) {
      if (!trackedSlotId) trackedSlotId = sample.slotId;
      if (sample.slotId === trackedSlotId) {
        samples += 1;
        if (sample.phase === "walkingToActivity") facings.add(sample.facing);
        if (previous) {
          assert(Number.isFinite(sample.renderedAt) && Number.isFinite(previous.renderedAt),
            `${trackedSlotId} is missing its rendered motion clock`);
          const elapsedSeconds = Math.max(0, sample.renderedAt - previous.renderedAt) / 1_000;
          const deltaX = sample.left - previous.left;
          const deltaY = sample.top - previous.top;
          const distanceInSceneUnits = Math.hypot(deltaX, deltaY);
          const constrainingSceneDimension = Math.min(sample.sceneWidth, sample.sceneHeight);
          const onePixelInSceneUnits = constrainingSceneDimension > 0
            ? 100 / constrainingSceneDimension
            : 0;
          const maximumDistance = (OFFICE_WALK_SPEED * elapsedSeconds) + onePixelInSceneUnits;
          const jumpPx = Math.hypot(
            (deltaX / 100) * sample.sceneWidth,
            (deltaY / 100) * sample.sceneHeight,
          );
          maximumJumpPx = Math.max(maximumJumpPx, jumpPx);
          assert(distanceInSceneUnits <= maximumDistance,
            `${trackedSlotId} jumped ${jumpPx.toFixed(2)}px across a ${Math.round(elapsedSeconds * 1_000)}ms sample; `
            + `expected at most OFFICE_WALK_SPEED * elapsed + 1px`);
          if (sample.phase === "walkingToActivity" && distanceInSceneUnits > 0.01) {
            positionChangedBeforeEating = true;
          }
        }
        previous = sample;

        if (sample.mealVisible && positionChangedBeforeEating && facings.size >= 2 && samples >= 3) {
          return {
            slotId: trackedSlotId,
            directions: [...facings],
            maximumJumpPx,
            samples,
          };
        }
      }
    }

    await delay(POSITION_SAMPLE_INTERVAL_MS);
  }

  throw new Error(
    `meal journey did not prove a smooth multi-node walk within ${MEAL_TIMEOUT_MS}ms `
    + `(slot=${trackedSlotId || "none"}, samples=${samples}, directions=${[...facings].join(",") || "none"})`,
  );
};

const collectGeometry = (page) => page.evaluate(() => {
  const toRect = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  };
  const isVisible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number.parseFloat(style.opacity || "1") > 0
      && rect.width > 0
      && rect.height > 0;
  };
  const collect = (selector, visibleOnly = false) => [...document.querySelectorAll(selector)]
    .filter((element) => !visibleOnly || isVisible(element))
    .map((element, index) => {
      const character = element.closest(".office-character");
      const slot = character?.getAttribute("data-slot") || "";
      const groupCount = character?.getAttribute("data-group-count") || "";
      const groupIndex = character?.getAttribute("data-group-index") || "";
      const text = element.textContent?.trim() || `${selector} ${index + 1}`;
      return {
        label: `${slot || "scene"}:${text}${groupCount ? ` [${groupCount}/${groupIndex}]` : ""}`,
        rect: toRect(element),
      };
    });

  const scene = document.querySelector(".office-scene");
  const header = document.querySelector(".work-app-header");
  const modeControl = document.querySelector(".work-mode-control");
  const background = document.querySelector(".office-scene-background");
  const root = document.documentElement;
  const body = document.body;

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: {
      width: Math.max(root.scrollWidth, body?.scrollWidth || 0),
      height: Math.max(root.scrollHeight, body?.scrollHeight || 0),
    },
    scene: scene ? toRect(scene) : null,
    header: header ? toRect(header) : null,
    modeControl: modeControl ? toRect(modeControl) : null,
    names: collect(".office-character-name", true),
    statuses: collect(".office-character-status", true),
    bubbles: collect(".office-speech-bubble", true),
    background: background ? {
      complete: background.complete,
      naturalWidth: background.naturalWidth,
      naturalHeight: background.naturalHeight,
    } : null,
  };
});

const verifyGeometry = (geometry, viewport) => {
  assert(geometry.document.width <= geometry.viewport.width + GEOMETRY_TOLERANCE_PX,
    `document width ${geometry.document.width}px overflows ${geometry.viewport.width}px viewport`);
  assert(geometry.document.height <= geometry.viewport.height + GEOMETRY_TOLERANCE_PX,
    `document height ${geometry.document.height}px overflows ${geometry.viewport.height}px viewport`);
  assert(geometry.scene, "missing .office-scene geometry");
  assert(geometry.header, "missing .work-app-header geometry");
  assert(geometry.modeControl, "missing .work-mode-control geometry");
  assert(geometry.scene.width > 0 && geometry.scene.height > 0,
    `office scene has invalid dimensions ${geometry.scene.width}x${geometry.scene.height}`);
  assert(geometry.background?.complete
    && geometry.background.naturalWidth > 0
    && geometry.background.naturalHeight > 0,
  "office background image did not decode");
  assert(geometry.names.length === 5,
    `${viewport.width}x${viewport.height}: expected 5 visible names, received ${geometry.names.length}`);
  assert(geometry.statuses.length === 5,
    `${viewport.width}x${viewport.height}: expected 5 visible statuses, received ${geometry.statuses.length}`);
  assert(geometry.bubbles.length >= 1,
    `${viewport.width}x${viewport.height}: expected at least 1 visible speech bubble`);

  for (const item of [...geometry.names, ...geometry.statuses, ...geometry.bubbles]) {
    assert(isInside(item.rect, geometry.scene),
      `${item.label} is outside the office scene: ${rectLabel(item.rect)} vs ${rectLabel(geometry.scene)}`);
    assert(!overlaps(item.rect, geometry.header),
      `${item.label} overlaps the Work header: ${rectLabel(item.rect)} vs ${rectLabel(geometry.header)}`);
    assert(!overlaps(item.rect, geometry.modeControl),
      `${item.label} overlaps the mode controls: ${rectLabel(item.rect)} vs ${rectLabel(geometry.modeControl)}`);
  }

  for (let index = 0; index < geometry.statuses.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < geometry.statuses.length; otherIndex += 1) {
      assert(!overlaps(geometry.statuses[index].rect, geometry.statuses[otherIndex].rect),
        `${geometry.statuses[index].label} ${rectLabel(geometry.statuses[index].rect)} overlaps `
        + `${geometry.statuses[otherIndex].label} ${rectLabel(geometry.statuses[otherIndex].rect)}`);
    }
  }
};

const verifyViewport = async (browser, viewport) => {
  const viewportLabel = `${viewport.width}x${viewport.height}`;
  const browserErrors = [];
  const failedAssetRequests = [];
  const unexpectedApiRequests = [];
  const apiRequests = [];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await seedOfficeQaState(context);
  await installOfficeApiMock(context, apiRequests);
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack || error.message}`));
  page.on("requestfailed", (request) => {
    if (isAssetUrl(request.url())) {
      failedAssetRequests.push(`${request.url()}: ${request.failure()?.errorText || "request failed"}`);
    }
  });
  page.on("response", (response) => {
    if (isAssetUrl(response.url()) && !response.ok()) {
      failedAssetRequests.push(`${response.url()}: HTTP ${response.status()}`);
    }
  });
  page.on("request", (request) => {
    if (!["fetch", "xhr"].includes(request.resourceType())) return;
    if (request.url() === QA_API_URL && request.method() === "POST") return;
    unexpectedApiRequests.push(`${request.method()} ${request.url()}`);
  });

  try {
    await enterOffice(page);

    if (viewport.verifyShellRestoration) {
      await verifyWorkShellRoundTrip(page, viewport);
    }

    await verifyOfficeStructure(page, viewportLabel);
    await verifyBuiltInOfficeAssets(page, viewportLabel);

    const timer = page.getByRole("timer");
    await expectCount(timer, 1, `${viewportLabel} timers`);
    const timerText = (await timer.innerText()).replace(/\s+/g, " ").trim();
    assert(/^工作剩余 \d{2}:\d{2}:\d{2}$/.test(timerText),
      `${viewportLabel}: invalid timer text ${JSON.stringify(timerText)}`);

    let assignmentEvidence = null;
    let activityFilterEvidence = null;
    let conversationEvidence = null;
    let deskActivities = [];
    let journey = null;
    if (viewport.verifyShellRestoration) {
      assignmentEvidence = await verifyAssignmentWorkflow(page);
      activityFilterEvidence = await verifyActivityFilters(page);
      deskActivities = await verifyDeskActivityProps(page);
      journey = await verifyMealAndWalk(page);
      conversationEvidence = await verifyTwoConversationCoverage(page);
    } else {
      await prepareMeetingScreenshot(page);
    }

    await page.locator(".office-scene-background").evaluate(async (image) => {
      try {
        await image.decode();
      } catch (error) {
        throw new Error(
          `could not decode office background ${image.currentSrc || image.src} `
          + `(complete=${image.complete}, natural=${image.naturalWidth}x${image.naturalHeight}): ${error.message}`,
        );
      }
    });
    const geometry = await collectGeometry(page);
    verifyGeometry(geometry, viewport);

    await page.evaluate(() => {
      const timer = document.querySelector(".work-remaining strong");
      if (!timer) throw new Error("missing Work timer before screenshot");
      timer.setAttribute("data-office-qa-time", "07:59:52");
      const style = document.createElement("style");
      style.textContent = `
        .work-remaining strong[data-office-qa-time] {
          position: relative;
          visibility: hidden;
        }
        .work-remaining strong[data-office-qa-time]::after {
          position: absolute;
          inset: 0;
          color: inherit;
          content: attr(data-office-qa-time);
          visibility: visible;
        }
      `;
      document.head.append(style);
    });

    const screenshotPath = resolve(qaDirectory, `office-${viewportLabel}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });

    const sceneBuffer = await page.locator(".office-scene").screenshot({
      type: "png",
      animations: "disabled",
    });
    assert(sceneBuffer.length > SCENE_SCREENSHOT_MIN_BYTES,
      `${viewportLabel}: office scene screenshot is blank or too small (${sceneBuffer.length} bytes)`);

    assert(browserErrors.length === 0,
      `${viewportLabel}: browser errors:\n${browserErrors.join("\n")}`);
    assert(failedAssetRequests.length === 0,
      `${viewportLabel}: failed asset requests:\n${failedAssetRequests.join("\n")}`);
    assert(unexpectedApiRequests.length === 0,
      `${viewportLabel}: unexpected API requests:\n${unexpectedApiRequests.join("\n")}`);
    assert(apiRequests.length > 0, `${viewportLabel}: the isolated Office API mock received no requests`);
    console.log(
      `[office QA] ${viewportLabel}: 5 characters, 16 chibi WebPs, 6 selected modules, props=${deskActivities.length + (journey ? 2 : 0)}, `
      + `walk=${journey ? `${journey.samples}x50ms/${journey.maximumJumpPx.toFixed(2)}px` : "n/a"}, `
      + `bubbles=${geometry.bubbles.length}, conversations=${conversationEvidence ? "2 isolated" : "1 meeting"}, `
      + `assignments=${assignmentEvidence ? "covered" : "n/a"}, `
      + `filters=${activityFilterEvidence ? "covered" : "n/a"}, apiMocks=${apiRequests.length}, `
      + `scene=${sceneBuffer.length} bytes`,
    );
  } catch (error) {
    const diagnostics = [
      browserErrors.length ? `Browser errors:\n${browserErrors.join("\n")}` : "",
      failedAssetRequests.length ? `Failed assets:\n${failedAssetRequests.join("\n")}` : "",
      unexpectedApiRequests.length ? `Unexpected APIs:\n${unexpectedApiRequests.join("\n")}` : "",
    ].filter(Boolean).join("\n");
    throw new Error(
      `[office QA ${viewportLabel}] ${error.message}${diagnostics ? `\n${diagnostics}` : ""}`,
      { cause: error },
    );
  } finally {
    await context.close();
  }
};

const isAppReachable = async () => {
  try {
    const response = await fetch(APP_URL, { signal: AbortSignal.timeout(750) });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
};

const waitForOutputMarker = async ({ child, getOutput, marker, timeoutMs }) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const output = getOutput();
    if (output.includes(marker)) return output;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`signal probe target exited before ${JSON.stringify(marker)}\n${output}`);
    }
    await delay(50);
  }
  throw new Error(`timed out waiting for ${JSON.stringify(marker)}\n${getOutput()}`);
};

const isProcessGroupRunning = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
};

const signalProcessGroupByPid = (pid, signal) => {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
};

const teardownProcessGroup = async (pid, stillOwnsGroup = () => true) => {
  if (!Number.isInteger(pid) || pid <= 0 || !stillOwnsGroup() || !isProcessGroupRunning(pid)) return;
  signalProcessGroupByPid(pid, "SIGTERM");
  const termDeadline = Date.now() + 1_000;
  while (Date.now() < termDeadline) {
    if (!stillOwnsGroup() || !isProcessGroupRunning(pid)) return;
    await delay(50);
  }
  if (!stillOwnsGroup() || !isProcessGroupRunning(pid)) return;

  signalProcessGroupByPid(pid, "SIGKILL");
  const killDeadline = Date.now() + 2_000;
  while (Date.now() < killDeadline) {
    if (!stillOwnsGroup() || !isProcessGroupRunning(pid)) return;
    await delay(50);
  }
  if (!stillOwnsGroup()) return;
  assert(!isProcessGroupRunning(pid), `Vite process group ${pid} survived bounded teardown`);
};

const spawnSignalProbeTarget = (mode = "") => {
  const child = spawn(process.execPath, [verifierPath], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      [SIGNAL_PROBE_TARGET_ENV]: "1",
      [SIGNAL_PROBE_MODE_ENV]: mode,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const appendOutput = (chunk) => {
    output += chunk.toString();
  };
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);
  const exit = new Promise((resolveExit) => {
    child.once("error", (error) => resolveExit({ error, code: null, signal: null }));
    child.once("exit", (code, signal) => resolveExit({ error: null, code, signal }));
  });
  return { child, exit, getOutput: () => output };
};

const waitForProbeExit = (target, timeoutMs) => Promise.race([
  target.exit,
  delay(timeoutMs).then(() => null),
]);

const terminateAndReapProbeTarget = async (target) => {
  if (target.child.exitCode === null && target.child.signalCode === null) {
    target.child.kill("SIGTERM");
  }
  let result = await waitForProbeExit(target, 2_000);
  if (!result) {
    target.child.kill("SIGKILL");
    result = await waitForProbeExit(target, 2_000);
  }
  assert(result, `signal probe target could not be reaped\n${target.getOutput()}`);
  return result;
};

const cleanupSignalProbeProcesses = async ({
  target,
  vitePid,
  reapTarget = terminateAndReapProbeTarget,
  teardownGroup = teardownProcessGroup,
  groupIsRunning = isProcessGroupRunning,
}) => {
  const attempts = [
    {
      label: "target reaping",
      run: () => reapTarget(target),
    },
    {
      label: "Vite process-group teardown",
      run: async () => {
        const output = target.getOutput();
        const ownsLiveGroup = vitePid > 0
          && output.includes(`${SIGNAL_PROBE_VITE_STARTED} vitePid=${vitePid}`)
          && !output.includes(SIGNAL_PROBE_VITE_STOPPED)
          && groupIsRunning(vitePid);
        if (!ownsLiveGroup || target.getOutput().includes(SIGNAL_PROBE_VITE_STOPPED)) return;
        await teardownGroup(
          vitePid,
          () => !target.getOutput().includes(SIGNAL_PROBE_VITE_STOPPED),
        );
      },
    },
  ];
  const results = await Promise.allSettled(attempts.map(({ run }) => Promise.resolve().then(run)));
  const cleanupErrors = results.flatMap((result, index) => (
    result.status === "rejected"
      ? [new Error(`${attempts[index].label} failed: ${result.reason?.message || result.reason}`, {
        cause: result.reason,
      })]
      : []
  ));
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, "signal probe process cleanup failed");
  }
};

const captureProbeVitePid = async (target) => {
  const startedOutput = await waitForOutputMarker({
    child: target.child,
    getOutput: target.getOutput,
    marker: SIGNAL_PROBE_VITE_STARTED,
    timeoutMs: READY_TIMEOUT_MS,
  });
  const vitePid = Number.parseInt(startedOutput.match(/vitePid=(\d+)/)?.[1] || "0", 10);
  assert(vitePid > 0, `signal probe target did not report its Vite pid\n${startedOutput}`);
  return vitePid;
};

const assertProbeResourcesGone = async (vitePid, label) => {
  assert(!(await isAppReachable()), `Vite still responds at ${APP_URL} after ${label}`);
  assert(!isProcessGroupRunning(vitePid), `Vite process group ${vitePid} remains after ${label}`);
};

const runSingleSignalCleanupProbe = async (signal, expectedCode) => {
  assert(!(await isAppReachable()),
    `cannot run signal cleanup probe because ${APP_URL} is already in use`);

  const target = spawnSignalProbeTarget();
  let vitePid = 0;

  try {
    vitePid = await captureProbeVitePid(target);
    await waitForOutputMarker({
      child: target.child,
      getOutput: target.getOutput,
      marker: SIGNAL_PROBE_READY,
      timeoutMs: READY_TIMEOUT_MS,
    });
    assert(target.child.kill(signal), `failed to send ${signal} to signal probe target`);
    await delay(10);
    if (target.child.exitCode === null && target.child.signalCode === null) target.child.kill(signal);

    const result = await waitForProbeExit(target, 10_000);
    assert(result, `signal probe target did not exit within 10 seconds\n${target.getOutput()}`);
    assert(!result.error, `signal probe target failed to launch: ${result.error?.message}`);
    assert(result.code === expectedCode && result.signal === null,
      `signal probe target exited with code=${result.code} signal=${result.signal || "none"}, `
      + `expected code=${expectedCode}\n${target.getOutput()}`);
    assert(target.getOutput().includes(SIGNAL_PROBE_BROWSER_CLOSED),
      `signal probe did not confirm browser cleanup\n${target.getOutput()}`);
    assert(target.getOutput().includes(SIGNAL_PROBE_VITE_STOPPED),
      `signal probe did not confirm Vite cleanup\n${target.getOutput()}`);
  } finally {
    await cleanupSignalProbeProcesses({ target, vitePid });
  }

  await assertProbeResourcesGone(vitePid, `${signal} cleanup`);
  console.log(`[office signal probe] PASS: ${signal} closed Chromium and the detached Vite process group`);
};

const runPreBrowserFailureProbe = async () => {
  assert(!(await isAppReachable()),
    `cannot run pre-browser failure probe because ${APP_URL} is already in use`);

  const target = spawnSignalProbeTarget("stall-before-browser");
  let vitePid = 0;
  try {
    vitePid = await captureProbeVitePid(target);
    await waitForOutputMarker({
      child: target.child,
      getOutput: target.getOutput,
      marker: SIGNAL_PROBE_PRE_BROWSER_STALL,
      timeoutMs: READY_TIMEOUT_MS,
    });
    assert(await isAppReachable(), "pre-browser failure probe never observed the live Vite listener");
    assert(target.child.kill("SIGKILL"), "failed to crash the pre-browser probe target");
    const result = await waitForProbeExit(target, 5_000);
    assert(result?.signal === "SIGKILL",
      `pre-browser probe target did not fail with SIGKILL\n${target.getOutput()}`);
    assert(!target.getOutput().includes(SIGNAL_PROBE_READY),
      `pre-browser failure probe unexpectedly reached Chromium readiness\n${target.getOutput()}`);
  } finally {
    await cleanupSignalProbeProcesses({ target, vitePid });
  }

  await assertProbeResourcesGone(vitePid, "pre-browser failure cleanup");
  console.log("[office signal probe] PASS: pre-browser failure left no Vite listener or process group");
};

const runSignalProbeContractTests = async () => {
  const stoppedTarget = {
    getOutput: () => `${SIGNAL_PROBE_VITE_STARTED} vitePid=123\n${SIGNAL_PROBE_VITE_STOPPED}`,
  };
  let normalTeardownCalls = 0;
  await cleanupSignalProbeProcesses({
    target: stoppedTarget,
    vitePid: 123,
    reapTarget: async () => {},
    teardownGroup: async () => { normalTeardownCalls += 1; },
    groupIsRunning: () => true,
  });
  assert(normalTeardownCalls === 0,
    "normal probe cleanup invoked process-group teardown after the Vite-stopped marker");

  let failedReapTeardownCalls = 0;
  let cleanupFailure = null;
  try {
    await cleanupSignalProbeProcesses({
      target: { getOutput: () => `${SIGNAL_PROBE_VITE_STARTED} vitePid=456` },
      vitePid: 456,
      reapTarget: async () => { throw new Error("simulated reap failure"); },
      teardownGroup: async () => { failedReapTeardownCalls += 1; },
      groupIsRunning: () => true,
    });
  } catch (error) {
    cleanupFailure = error;
  }
  assert(cleanupFailure instanceof AggregateError,
    "probe cleanup did not aggregate a simulated target-reaping failure");
  assert(failedReapTeardownCalls === 1,
    "probe cleanup skipped process-group teardown after target reaping failed");

  assert(!shouldStallBeforeBrowser({ [SIGNAL_PROBE_MODE_ENV]: "stall-before-browser" }),
    "an inherited probe mode can stall an ordinary verifier");
  assert(shouldStallBeforeBrowser({
    [SIGNAL_PROBE_TARGET_ENV]: "1",
    [SIGNAL_PROBE_MODE_ENV]: "stall-before-browser",
  }), "the pre-browser failure target no longer enters its requested stall mode");
  console.log("[office signal probe] PASS: cleanup ownership contracts");
};

const runSignalCleanupProbe = async () => {
  await runSignalProbeContractTests();
  await runPreBrowserFailureProbe();
  await runSingleSignalCleanupProbe("SIGTERM", 143);
  await runSingleSignalCleanupProbe("SIGINT", 130);
};

const shouldStallBeforeBrowser = (environment = process.env) => (
  environment[SIGNAL_PROBE_TARGET_ENV] === "1"
  && environment[SIGNAL_PROBE_MODE_ENV] === "stall-before-browser"
);

const runVerifier = async () => {
  let server = null;
  let browser = null;
  let failure = null;
  let cleanupPromise = null;
  let terminationSignal = "";

  const cleanupResources = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const cleanupErrors = [];
      if (browser) {
        const activeBrowser = browser;
        browser = null;
        try {
          await activeBrowser.close();
          if (process.env[SIGNAL_PROBE_TARGET_ENV] === "1") console.log(SIGNAL_PROBE_BROWSER_CLOSED);
        } catch (error) {
          cleanupErrors.push(new Error(`Failed to close Playwright browser: ${error.message}`, { cause: error }));
        }
      }
      if (server) {
        const activeServer = server;
        server = null;
        try {
          await stopVite(activeServer);
          if (process.env[SIGNAL_PROBE_TARGET_ENV] === "1") console.log(SIGNAL_PROBE_VITE_STOPPED);
        } catch (error) {
          cleanupErrors.push(new Error(`Failed to stop Vite: ${error.message}`, { cause: error }));
        }
      }
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "office verifier cleanup failed");
    })();
    return cleanupPromise;
  };

  const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };
  const removeSignalHandlers = () => {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  };
  const handleSignal = (signal) => {
    if (terminationSignal) return;
    terminationSignal = signal;
    let exitCode = signalExitCodes[signal] || 1;
    console.error(`[office QA] received ${signal}; closing browser and Vite before exit`);
    void cleanupResources()
      .catch((error) => {
        exitCode = 1;
        console.error(error.stack || error.message || error);
      })
      .finally(() => {
        removeSignalHandlers();
        process.exit(exitCode);
      });
  };
  const onSigint = () => handleSignal("SIGINT");
  const onSigterm = () => handleSignal("SIGTERM");
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  try {
    await mkdir(qaDirectory, { recursive: true });
    server = startVite();
    if (process.env[SIGNAL_PROBE_TARGET_ENV] === "1") {
      console.log(`${SIGNAL_PROBE_VITE_STARTED} vitePid=${server.child.pid}`);
    }
    await waitForVite(server);
    if (shouldStallBeforeBrowser()) {
      console.log(SIGNAL_PROBE_PRE_BROWSER_STALL);
      await delay(60_000);
    }
    browser = await chromium.launch({
      handleSIGHUP: false,
      handleSIGINT: false,
      handleSIGTERM: false,
    });
    if (process.env[SIGNAL_PROBE_TARGET_ENV] === "1") {
      console.log(SIGNAL_PROBE_READY);
    }

    for (const viewport of VIEWPORTS) {
      await verifyViewport(browser, viewport);
    }
  } catch (error) {
    if (!terminationSignal) {
      failure = error;
      console.error(error.stack || error.message || error);
      const viteOutput = server?.getOutput();
      if (viteOutput) console.error(`\nVite output:\n${viteOutput}`);
    }
  } finally {
    try {
      await cleanupResources();
    } catch (error) {
      failure ||= error;
      console.error(error.stack || error.message || error);
    }
    removeSignalHandlers();
  }

  if (failure) process.exitCode = 1;
};

if (process.argv.includes(SIGNAL_PROBE_FLAG)) await runSignalCleanupProbe();
else await runVerifier();
