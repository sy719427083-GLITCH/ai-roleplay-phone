import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

import { WORK_ROUTE_DATA, getWorkRouteTheme, validateWorkRouteTheme } from "../src/workRouteData.js";
import { WORK_MAP_THEMES, buildLocalThemeJobs, getWorkTheme } from "../src/workThemes.js";

const DEFAULT_OUTPUT_ROOT = "artifacts/work-routes";
const VIEWPORT = Object.freeze({ width: 390, height: 844 });
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_CLEANUP_TIMEOUT_MS = 2_000;

const WORLDBOOK_STORAGE_KEY = "ccat-worldbook-worlds-v1";
const WORK_JOBS_STORAGE_KEY = "ccatWorkJobs";
const WORK_ACTIVE_STORAGE_KEY = "ccatActiveWork";
const WORK_SOURCE_STORAGE_KEY = "ccatWorkSource";
const WORK_WORLDBOOK_STORAGE_KEY = "ccatWorkWorldbookId";
const WORK_TAG_STORAGE_KEY = "ccatWorkTagByWorld";

const THEME_IDS = Object.keys(WORK_MAP_THEMES);

export const buildScreenshotPath = (themeId, placeType, rootDir = DEFAULT_OUTPUT_ROOT) => (
  path.posix.join(rootDir, themeId, `${placeType}.png`)
);

export const isProcessAlive = (processId) => {
  const pid = Number(processId);
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
};

const waitForProcessExit = async (processId, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (!isProcessAlive(processId)) return true;
    await delay(25);
  }
  return !isProcessAlive(processId);
};

const signalProcessGroup = (processId, signal) => {
  const pid = Number(processId);
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      try {
        process.kill(pid, signal);
      } catch (fallbackError) {
        if (fallbackError?.code !== "ESRCH") throw fallbackError;
      }
    }
  }
};

export const stopProcessGroup = async (
  child,
  { gracefulTimeoutMs = 500, forceTimeoutMs = 5_000 } = {},
) => {
  if (!child?.pid || !isProcessAlive(child.pid)) return;

  signalProcessGroup(child.pid, "SIGTERM");
  if (await waitForProcessExit(child.pid, gracefulTimeoutMs)) return;

  signalProcessGroup(child.pid, "SIGKILL");
  if (await waitForProcessExit(child.pid, forceTimeoutMs)) return;

  throw new Error(`Process group ${child.pid} did not exit after SIGKILL`);
};

export const withTimeout = async (operation, timeoutMs, label, onTimeout = async () => {}) => {
  let timerId = null;
  let settled = false;

  return new Promise((resolve, reject) => {
    timerId = setTimeout(() => {
      if (settled) return;
      settled = true;
      Promise.resolve()
        .then(onTimeout)
        .catch(() => {});
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(operation)
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        reject(error);
      });
  });
};

export const runBoundedCleanup = (cleanup, timeoutMs, label = "resource cleanup") => {
  let timerId = null;
  const cleanupResult = Promise.resolve()
    .then(cleanup)
    .then(
      () => ({ label, status: "fulfilled" }),
      (error) => ({ error, label, status: "rejected" }),
    );
  const timeoutResult = new Promise((resolve) => {
    timerId = setTimeout(() => resolve({ label, status: "timed_out" }), timeoutMs);
  });

  return Promise.race([cleanupResult, timeoutResult])
    .finally(() => clearTimeout(timerId));
};

export const createResourceLifecycle = ({ cleanupTimeoutMs = DEFAULT_CLEANUP_TIMEOUT_MS } = {}) => {
  const abortController = new AbortController();
  const records = [];

  const scheduleCleanup = (record) => {
    if (record.cleanupTask) return record.cleanupTask;
    record.cleanupTask = runBoundedCleanup(
      () => record.cleanup(record.resource),
      cleanupTimeoutMs,
      `${record.name} cleanup`,
    );
    return record.cleanupTask;
  };

  const abort = () => {
    if (!abortController.signal.aborted) abortController.abort();
    records.forEach(scheduleCleanup);
  };

  const register = (name, resource, cleanup) => {
    const record = { cleanup, cleanupTask: null, name, resource };
    records.push(record);
    if (abortController.signal.aborted) scheduleCleanup(record);
    return resource;
  };

  return {
    acquire(name, acquisition, cleanup, { timeoutMs = 0 } = {}) {
      const registeredAcquisition = Promise.resolve(acquisition)
        .then((resource) => register(name, resource, cleanup));
      if (!timeoutMs) return registeredAcquisition;
      return withTimeout(
        registeredAcquisition,
        timeoutMs,
        `${name} acquisition`,
        abort,
      );
    },
    get aborted() {
      return abortController.signal.aborted;
    },
    abort,
    async cleanupAll() {
      abort();
      await Promise.allSettled(records.map(scheduleCleanup));
    },
    register,
    signal: abortController.signal,
    throwIfAborted(label = "route verification") {
      if (abortController.signal.aborted) {
        throw new Error(`${label} aborted after timeout`);
      }
    },
  };
};

export const resolveVerificationPlan = ({
  availableThemes = WORK_MAP_THEMES,
  routeData = WORK_ROUTE_DATA,
  themeId = "",
  placeType = "",
} = {}) => {
  const normalizedThemeId = String(themeId || "").trim();
  const normalizedPlaceType = String(placeType || "").trim();

  if (normalizedPlaceType && !normalizedThemeId) {
    throw new Error("--place requires --theme");
  }

  if (normalizedThemeId) {
    const theme = availableThemes[normalizedThemeId];
    if (!theme) {
      throw new Error(`Unknown theme: ${normalizedThemeId}`);
    }

    if (!routeData[normalizedThemeId]) {
      return { targets: [], missingThemes: [normalizedThemeId] };
    }

    const places = normalizedPlaceType
      ? theme.places.filter((place) => place.type === normalizedPlaceType)
      : theme.places;

    if (normalizedPlaceType && places.length === 0) {
      throw new Error(`Unknown place for ${normalizedThemeId}: ${normalizedPlaceType}`);
    }

    return {
      targets: places.map((place) => ({ themeId: normalizedThemeId, placeType: place.type })),
      missingThemes: [],
    };
  }

  const targets = [];
  const missingThemes = [];
  for (const id of Object.keys(availableThemes)) {
    const theme = availableThemes[id];
    if (!routeData[id]) {
      missingThemes.push(id);
      continue;
    }

    for (const place of theme.places) {
      targets.push({ themeId: id, placeType: place.type });
    }
  }

  return { targets, missingThemes };
};

const parseArgs = (argv) => {
  const options = {
    themeId: "",
    placeType: "",
    baseUrl: "",
    outputRoot: DEFAULT_OUTPUT_ROOT,
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--theme") options.themeId = argv[index + 1] || "";
    if (token === "--theme") index += 1;
    if (token === "--place" || token === "--job") options.placeType = argv[index + 1] || "";
    if (token === "--place" || token === "--job") index += 1;
    if (token === "--base-url") options.baseUrl = argv[index + 1] || "";
    if (token === "--base-url") index += 1;
    if (token === "--output-dir") options.outputRoot = argv[index + 1] || DEFAULT_OUTPUT_ROOT;
    if (token === "--output-dir") index += 1;
    if (token === "--timeout-ms") options.timeoutMs = Math.max(1_000, Number(argv[index + 1]) || DEFAULT_TIMEOUT_MS);
    if (token === "--timeout-ms") index += 1;
    if (token === "--headed") options.headless = false;
  }

  return options;
};

const ensureRouteThemeIsValid = (themeId) => {
  const theme = WORK_MAP_THEMES[themeId];
  const routeTheme = getWorkRouteTheme(themeId);
  const issues = validateWorkRouteTheme(themeId, theme, routeTheme);
  if (issues.length > 0) {
    throw new Error(issues.join("\n"));
  }
};

const buildWorldbookPayload = (themeId) => {
  const theme = getWorkTheme(themeId);
  const worldId = `verify-${themeId}`;
  return {
    [WORLDBOOK_STORAGE_KEY]: JSON.stringify([{
      id: worldId,
      name: `${theme.name} 校验`,
      tags: [theme.tag],
      tone: "Route verification",
      updated: "刚刚",
      custom: true,
    }]),
    [WORK_SOURCE_STORAGE_KEY]: "worldbook",
    [WORK_WORLDBOOK_STORAGE_KEY]: worldId,
    [WORK_TAG_STORAGE_KEY]: JSON.stringify({ [worldId]: theme.tag }),
    [WORK_JOBS_STORAGE_KEY]: JSON.stringify(buildLocalThemeJobs(themeId)),
  };
};

const preparePageState = async (page, baseUrl, themeId) => {
  const payload = buildWorldbookPayload(themeId);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(({ payload, activeStorageKey }) => {
    window.localStorage.clear();
    Object.entries(payload).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
    window.localStorage.removeItem(activeStorageKey);
  }, {
    payload,
    activeStorageKey: WORK_ACTIVE_STORAGE_KEY,
  });
  await page.reload({ waitUntil: "networkidle" });
};

const openWorkApp = async (page) => {
  const unlockHandle = page.getByLabel("上划解锁");
  if (await unlockHandle.isVisible()) {
    await unlockHandle.click();
  }
  await page.getByLabel("第 2 页").click();
  await page.getByRole("button", { name: "工作" }).click();
  await page.getByLabel("工作地图").waitFor({ state: "visible" });
};

const captureThemePlace = async (page, themeId, placeType, outputRoot) => {
  const theme = getWorkTheme(themeId);
  const placeIndex = theme.places.findIndex((place) => place.type === placeType);
  if (placeIndex < 0) {
    throw new Error(`Unknown place for ${themeId}: ${placeType}`);
  }

  const screenshotRelativePath = buildScreenshotPath(themeId, placeType, outputRoot);
  const screenshotPath = path.resolve(process.cwd(), screenshotRelativePath);
  await mkdir(path.dirname(screenshotPath), { recursive: true });

  await page.locator(".work-job-row").nth(placeIndex).click();
  await page.locator(".work-job-row.active").waitFor({ state: "visible" });
  await page.locator(".work-road-route").waitFor({ state: "visible" });
  await page.screenshot({ path: screenshotPath });

  return screenshotRelativePath;
};

const findAvailablePort = async (startPort = 4173) => {
  for (let port = startPort; port < startPort + 50; port += 1) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error("Unable to find an open local port for Vite");
};

const waitForServer = async (baseUrl, signal) => {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (signal?.aborted) throw new Error(`Server startup aborted for ${baseUrl}`);
    try {
      const response = await fetch(baseUrl, { signal });
      if (response.ok) return;
    } catch (error) {
      if (signal?.aborted) throw new Error(`Server startup aborted for ${baseUrl}`);
      lastError = error;
    }
    await delay(250, undefined, signal ? { signal } : undefined);
  }
  throw new Error(`Timed out waiting for ${baseUrl}${lastError ? `: ${lastError.message}` : ""}`);
};

const startViteServer = async (lifecycle) => {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: process.cwd(),
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  const server = {
    baseUrl,
    child,
    stop: async () => stopProcessGroup(child, { gracefulTimeoutMs: 250, forceTimeoutMs: 1_000 }),
  };
  lifecycle.register("Vite server", server, (resource) => resource.stop());

  try {
    await waitForServer(baseUrl, lifecycle.signal);
  } catch (error) {
    lifecycle.abort();
    throw error;
  }

  return server;
};

const runVerification = async (options) => {
  const plan = resolveVerificationPlan({
    themeId: options.themeId,
    placeType: options.placeType,
  });

  if (plan.missingThemes.length > 0) {
    throw new Error(`Missing calibrated route themes: ${plan.missingThemes.join(", ")}`);
  }

  [...new Set(plan.targets.map((target) => target.themeId))].forEach(ensureRouteThemeIsValid);

  const groupedTargets = plan.targets.reduce((groups, target) => {
    groups[target.themeId] ||= [];
    groups[target.themeId].push(target.placeType);
    return groups;
  }, {});

  const lifecycle = createResourceLifecycle();
  const operation = (async () => {
    const server = options.baseUrl ? null : await startViteServer(lifecycle);
    lifecycle.throwIfAborted("server startup");
    const baseUrl = options.baseUrl || server.baseUrl;

    const browser = await lifecycle.acquire(
      "Playwright browser",
      chromium.launch({ headless: options.headless, timeout: options.timeoutMs }),
      (resource) => resource.close(),
      { timeoutMs: options.timeoutMs },
    );
    lifecycle.throwIfAborted("browser launch");

    const context = await lifecycle.acquire(
      "Playwright context",
      browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 }),
      (resource) => resource.close(),
      { timeoutMs: options.timeoutMs },
    );
    lifecycle.throwIfAborted("browser context creation");

    const page = await context.newPage();
    const screenshots = [];

    for (const themeId of Object.keys(groupedTargets)) {
      await preparePageState(page, baseUrl, themeId);
      await openWorkApp(page);
      for (const placeType of groupedTargets[themeId]) {
        screenshots.push(await captureThemePlace(page, themeId, placeType, options.outputRoot));
      }
    }
    return { screenshots, baseUrl };
  })();

  try {
    return await withTimeout(operation, options.timeoutMs, "route verification", () => lifecycle.abort());
  } finally {
    await lifecycle.cleanupAll();
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const { screenshots, baseUrl } = await runVerification(options);
  console.log(`Verified ${screenshots.length} route screenshot(s) via ${baseUrl}`);
  screenshots.forEach((entry) => console.log(entry));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
