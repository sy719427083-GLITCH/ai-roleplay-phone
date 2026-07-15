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
const SCENE_SCREENSHOT_MIN_BYTES = 20_000;
const ASSIGNMENT_STORAGE_KEY = "ccatOfficeAssignmentsV1";
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
  const closeButton = page.getByRole("button", { name: "关闭员工安排", exact: true });
  await dialog.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.activeElement?.matches("[data-office-dialog-close]"));
  assert(await closeButton.evaluate((element) => document.activeElement === element),
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
  const bossRow = dialog.locator(".office-assignment-row").filter({ hasText: "老板" }).first();
  const uploadInput = bossRow.getByLabel("老板上传形象", { exact: true });
  const urlInput = bossRow.getByLabel("老板形象地址", { exact: true });
  const bossAlert = bossRow.getByRole("alert");
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

  await closeButton.click();
  await dialog.waitFor({ state: "detached" });
  return { oversized: true, upload: true, fallback: true, quotaRollback: true };
};

const observeRestJourney = async (page, initialTargets) => {
  const deadline = Date.now() + MEAL_TIMEOUT_MS;
  const routeNodes = new Set();
  let trackedSlotId = "";
  let previous = null;
  let horizontalStep = null;
  let positionChangedBeforeEating = false;

  while (Date.now() < deadline) {
    const sample = await page.evaluate((slotId) => {
      const character = slotId
        ? document.querySelector(`.office-character[data-slot="${CSS.escape(slotId)}"]`)
        : document.querySelector('.office-character[data-phase="walkingToActivity"][data-activity="eating"]');
      if (!character) return null;
      const meal = character.querySelector(".office-meal");
      const mealRect = meal?.getBoundingClientRect();
      return {
        slotId: character.getAttribute("data-slot") || "",
        node: character.getAttribute("data-node") || "",
        phase: character.getAttribute("data-phase") || "",
        facing: character.getAttribute("data-facing") || "",
        leftTarget: Number.parseFloat(character.style.left),
        mealVisible: Boolean(mealRect && mealRect.width > 0 && mealRect.height > 0),
      };
    }, trackedSlotId);

    if (sample) {
      if (!trackedSlotId) trackedSlotId = sample.slotId;
      if (sample.slotId === trackedSlotId) {
        if (!previous && initialTargets[sample.slotId]) previous = initialTargets[sample.slotId];
        routeNodes.add(`${sample.node}:${sample.leftTarget}`);
        if (previous && sample.node !== previous.node) {
          if (sample.phase === "walkingToActivity") positionChangedBeforeEating = true;
          const deltaX = sample.leftTarget - previous.leftTarget;
          if (Math.abs(deltaX) > 0.01 && !horizontalStep) {
            const expectedFacing = deltaX > 0 ? "right" : "left";
            assert(sample.facing === expectedFacing,
              `${trackedSlotId} moved from ${previous.leftTarget}% to ${sample.leftTarget}% `
              + `but faced ${sample.facing}, expected ${expectedFacing}`);
            horizontalStep = {
              from: previous.leftTarget,
              to: sample.leftTarget,
              facing: sample.facing,
            };
          }
        }
        previous = sample;

        if (sample.mealVisible && horizontalStep && positionChangedBeforeEating && routeNodes.size >= 2) {
          return {
            slotId: trackedSlotId,
            horizontalStep,
            routePositions: routeNodes.size,
          };
        }
      }
    }

    await delay(80);
  }

  throw new Error(
    `meal journey did not prove walking direction and route movement within ${MEAL_TIMEOUT_MS}ms `
    + `(slot=${trackedSlotId || "none"}, positions=${routeNodes.size}, horizontal=${Boolean(horizontalStep)})`,
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
    .map((element, index) => ({
      label: element.textContent?.trim() || `${selector} ${index + 1}`,
      rect: toRect(element),
    }));

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
  assert(geometry.bubbles.length >= 1,
    `${viewport.width}x${viewport.height}: expected at least 1 visible speech bubble`);

  for (const item of [...geometry.names, ...geometry.bubbles]) {
    assert(isInside(item.rect, geometry.scene),
      `${item.label} is outside the office scene: ${rectLabel(item.rect)} vs ${rectLabel(geometry.scene)}`);
    assert(!overlaps(item.rect, geometry.header),
      `${item.label} overlaps the Work header: ${rectLabel(item.rect)} vs ${rectLabel(geometry.header)}`);
    assert(!overlaps(item.rect, geometry.modeControl),
      `${item.label} overlaps the mode controls: ${rectLabel(item.rect)} vs ${rectLabel(geometry.modeControl)}`);
  }
};

const verifyViewport = async (browser, viewport) => {
  const viewportLabel = `${viewport.width}x${viewport.height}`;
  const browserErrors = [];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    Math.random = () => 0.35;
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack || error.message}`));

  try {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    const unlock = page.getByRole("button", { name: "上划解锁", exact: true });
    if (await unlock.count()) await unlock.click();
    await page.locator(".phone-surface").waitFor({ state: "visible" });
    await openWork(page);

    if (viewport.verifyShellRestoration) {
      await verifyWorkShellRoundTrip(page, viewport);
    }

    const assignmentEvidence = viewport.verifyShellRestoration
      ? await verifyAssignmentWorkflow(page)
      : null;

    await expectCount(page.locator(".office-character:visible"), 5, `${viewportLabel} visible characters`);
    await expectCount(page.locator(".office-character-name:visible"), 5, `${viewportLabel} visible names`);

    const timer = page.getByRole("timer");
    await expectCount(timer, 1, `${viewportLabel} timers`);
    const timerText = (await timer.innerText()).replace(/\s+/g, " ").trim();
    assert(/^工作剩余 \d{2}:\d{2}:\d{2}$/.test(timerText),
      `${viewportLabel}: invalid timer text ${JSON.stringify(timerText)}`);

    const initialRouteTargets = await page.locator(".office-character").evaluateAll((characters) => (
      Object.fromEntries(characters.map((character) => [character.getAttribute("data-slot"), {
        node: character.getAttribute("data-node") || "",
        leftTarget: Number.parseFloat(character.style.left),
      }]))
    ));
    await page.getByRole("button", { name: "休息一下", exact: true }).click();
    const journey = await observeRestJourney(page, initialRouteTargets);
    const meal = page.locator(`.office-character[data-slot="${journey.slotId}"] .office-meal`);
    await meal.waitFor({ state: "visible", timeout: MEAL_TIMEOUT_MS });
    const mealState = await meal.evaluate((element) => {
      const character = element.closest(".office-character");
      const food = element.querySelector(".office-food");
      const foodRect = food?.getBoundingClientRect();
      return {
        activity: character?.getAttribute("data-activity"),
        phase: character?.getAttribute("data-phase"),
        meal: element.getAttribute("data-meal"),
        label: element.getAttribute("aria-label"),
        foodVisible: Boolean(foodRect && foodRect.width > 0 && foodRect.height > 0),
      };
    });
    assert(mealState.meal === "rice",
      `${viewportLabel}: Math.random=0.35 produced ${mealState.meal || "no meal"}, expected rice`);
    assert(mealState.activity === "eating" && mealState.phase === "eating",
      `${viewportLabel}: meal is attached to ${mealState.phase}/${mealState.activity}, expected eating/eating`);
    assert(mealState.foodVisible && mealState.label?.includes("米饭"),
      `${viewportLabel}: concrete rice meal is not visibly rendered`);

    const meeting = page.getByRole("button", { name: "开会", exact: true });
    assert(await meeting.isEnabled(), `${viewportLabel}: meeting was not available after one member started eating`);
    await meeting.click();
    const visibleBubbles = page.locator(".office-speech-bubble:visible");
    await visibleBubbles.first().waitFor({ state: "visible", timeout: BUBBLE_TIMEOUT_MS });
    const bubbleCount = await visibleBubbles.count();
    assert(bubbleCount >= 1, `${viewportLabel}: meeting produced no visible speech bubble`);
    assert(await meal.isVisible(), `${viewportLabel}: meal disappeared before the meeting bubble became visible`);

    await page.locator(".office-scene-background").evaluate((image) => image.decode());
    const geometry = await collectGeometry(page);
    verifyGeometry(geometry, viewport);

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
    console.log(
      `[office QA] ${viewportLabel}: 5 characters, 5 names, meal=${mealState.meal}, `
      + `walk=${journey.horizontalStep.from}->${journey.horizontalStep.to}/${journey.horizontalStep.facing}, `
      + `bubbles=${geometry.bubbles.length}, assignments=${assignmentEvidence ? "covered" : "n/a"}, `
      + `scene=${sceneBuffer.length} bytes`,
    );
  } catch (error) {
    const browserErrorDetail = browserErrors.length
      ? `\nBrowser errors:\n${browserErrors.join("\n")}`
      : "";
    throw new Error(`[office QA ${viewportLabel}] ${error.message}${browserErrorDetail}`, { cause: error });
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
