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
const GEOMETRY_TOLERANCE_PX = 1;
const SCENE_SCREENSHOT_MIN_BYTES = 20_000;
const VIEWPORTS = [
  { width: 375, height: 812, verifyShellRestoration: true },
  { width: 390, height: 844, verifyShellRestoration: false },
];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const viteCli = resolve(repositoryRoot, "node_modules/vite/bin/vite.js");
const qaDirectory = resolve(repositoryRoot, "docs/superpowers/qa");

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

    await expectCount(page.locator(".office-character:visible"), 5, `${viewportLabel} visible characters`);
    await expectCount(page.locator(".office-character-name:visible"), 5, `${viewportLabel} visible names`);

    const timer = page.getByRole("timer");
    await expectCount(timer, 1, `${viewportLabel} timers`);
    const timerText = (await timer.innerText()).replace(/\s+/g, " ").trim();
    assert(/^工作剩余 \d{2}:\d{2}:\d{2}$/.test(timerText),
      `${viewportLabel}: invalid timer text ${JSON.stringify(timerText)}`);

    await page.getByRole("button", { name: "休息一下", exact: true }).click();
    const meal = page.locator(".office-meal").first();
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

    await page.locator(".office-scene-background").evaluate((image) => image.decode());
    const geometry = await collectGeometry(page);
    verifyGeometry(geometry, viewport);

    const sceneBuffer = await page.locator(".office-scene").screenshot({ type: "png" });
    assert(sceneBuffer.length > SCENE_SCREENSHOT_MIN_BYTES,
      `${viewportLabel}: office scene screenshot is blank or too small (${sceneBuffer.length} bytes)`);

    const screenshotPath = resolve(qaDirectory, `office-${viewportLabel}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    assert(browserErrors.length === 0,
      `${viewportLabel}: browser errors:\n${browserErrors.join("\n")}`);
    console.log(
      `[office QA] ${viewportLabel}: 5 characters, 5 names, meal=${mealState.meal}, `
      + `bubbles=${geometry.bubbles.length}, scene=${sceneBuffer.length} bytes`,
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

let server = null;
let browser = null;
let failure = null;

try {
  await mkdir(qaDirectory, { recursive: true });
  server = startVite();
  await waitForVite(server);
  browser = await chromium.launch();

  for (const viewport of VIEWPORTS) {
    await verifyViewport(browser, viewport);
  }
} catch (error) {
  failure = error;
  console.error(error.stack || error.message || error);
  const viteOutput = server?.getOutput();
  if (viteOutput) console.error(`\nVite output:\n${viteOutput}`);
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      failure ||= error;
      console.error(`Failed to close Playwright browser: ${error.message}`);
    }
  }
  if (server) {
    try {
      await stopVite(server);
    } catch (error) {
      failure ||= error;
      console.error(`Failed to stop Vite: ${error.message}`);
    }
  }
}

if (failure) process.exitCode = 1;
