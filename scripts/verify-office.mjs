import { spawn } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  OFFICE_RELEASE_VIEWPORTS,
  assertActorMotionEvidence,
  assertConversationActivityCoverage,
  assertDisjointRectangles,
} from "./office-release-contract.mjs";

const HOST = "127.0.0.1";
const BASE_PATH = "/ai-roleplay-phone/";
const READY_TIMEOUT_MS = 30_000;
const SCREENSHOT_MIN_BYTES = 20_000;
const QA_API_URL = "https://office-qa.invalid/v1/chat/completions";
const QA_WORK_SESSION_ID = "work-session-office-v2-release";
const LONG_DIALOGUE = "项目复盘需要逐项确认风险进度结论后续安排并同步所有相关同事".repeat(3).slice(0, 80);
const STORAGE_KEYS = Object.freeze({
  assignments: "ccatOfficeAssignmentsV1",
  officeState: "ccatOfficeStateV1",
  apiConfig: "ccat-ai-api-configs",
  meProfiles: "apiMeProfiles",
  characters: "apiCharacters",
  relations: "apiRelations",
});
const SLOT_IDS = Object.freeze(["boss", "employee1", "employee2", "employee3", "employee4"]);
const RELEASE_VERSION = "0.2.98";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const viteCli = resolve(repositoryRoot, "node_modules/vite/bin/vite.js");
const qaDirectory = resolve(repositoryRoot, "docs/superpowers/qa");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const labelViewport = ({ width, height }) => `${width}x${height}`;

const QA_ME_PROFILES = Object.freeze({
  "qa-owner": { name: "沈知白", identity: "公司负责人", personality: "自律、沉静" },
});
const QA_CHARACTER_PROFILES = Object.freeze({
  "qa-main": { name: "周予安", identity: "主角色", type: "main", personality: "沉静" },
  "qa-npc-1": { name: "程雾", identity: "NPC 角色", type: "npc", personality: "游戏、外向" },
  "qa-npc-2": { name: "许青禾", identity: "NPC 角色", type: "npc", personality: "贪吃" },
  "qa-npc-3": { name: "顾南星", identity: "NPC 角色", type: "npc", personality: "追剧、短视频" },
});
const QA_ASSIGNMENTS = Object.freeze({
  boss: { profileId: "qa-owner", chibiId: "boss-f-01", customManifestUrl: "", customAnimationManifest: null },
  employee1: { profileId: "qa-main", chibiId: "employee-f-01", customManifestUrl: "", customAnimationManifest: null },
  employee2: { profileId: "qa-npc-1", chibiId: "employee-m-01", customManifestUrl: "", customAnimationManifest: null },
  employee3: { profileId: "qa-npc-2", chibiId: "employee-f-02", customManifestUrl: "", customAnimationManifest: null },
  employee4: { profileId: "qa-npc-3", chibiId: "employee-m-02", customManifestUrl: "", customAnimationManifest: null },
});
const QA_RELATIONS = Object.freeze({
  "qa-main-npc": { charA: "qa-main", charB: "qa-npc-1", type: "同事" },
});
const QA_API_CONFIG = Object.freeze({
  mainConfigs: [{
    id: "office-v2-qa",
    name: "Office V2 QA",
    apiKey: "office-v2-qa-key",
    baseUrl: "https://office-qa.invalid/v1",
    model: "office-v2-qa-model",
    temperature: 0,
  }],
  selectedMainId: "office-v2-qa",
  secondaryConfigs: [],
  selectedSecondaryId: "",
  secondaryEnabled: false,
  retryCount: 0,
  failoverEnabled: false,
});

const pathExists = async (path) => access(path).then(() => true).catch(() => false);

async function verifyReleaseFiles() {
  const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(resolve(repositoryRoot, "package-lock.json"), "utf8"));
  const appSource = await readFile(resolve(repositoryRoot, "src/App.jsx"), "utf8");
  const globalStyles = await readFile(resolve(repositoryRoot, "src/styles.css"), "utf8");
  const officeStyles = await readFile(resolve(repositoryRoot, "src/work/office.css"), "utf8");
  const retiredDirectory = ["work", "office", "assets"].join("-");

  assert(packageJson.version === RELEASE_VERSION, `package.json must remain ${RELEASE_VERSION}`);
  assert(packageLock.version === RELEASE_VERSION, `package-lock.json must remain ${RELEASE_VERSION}`);
  assert(packageLock.packages?.[""]?.version === RELEASE_VERSION, "package-lock root package version is stale");
  assert(appSource.includes(`Ccat OS V${RELEASE_VERSION}`), "visible app version is stale");
  assert(appSource.includes(`worldbook-assets/\${fileName}?v=${RELEASE_VERSION}`), "worldbook app cache marker is stale");
  assert(globalStyles.includes(`?v=${RELEASE_VERSION}`), "worldbook CSS cache marker is stale");
  assert(!/rug|carpet/iu.test(officeStyles), "office runtime CSS contains a forbidden floor-zone reference");
  assert(!await pathExists(resolve(repositoryRoot, "public", retiredDirectory)), "retired office asset directory still exists");
}

const reservePort = () => new Promise((resolvePort, rejectPort) => {
  const server = createNetServer();
  server.once("error", rejectPort);
  server.listen(0, HOST, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    server.close((error) => (error ? rejectPort(error) : resolvePort(port)));
  });
});

function startVite(port) {
  const child = spawn(process.execPath, [
    viteCli,
    "--host", HOST,
    "--port", String(port),
    "--strictPort",
    "--base", BASE_PATH,
  ], {
    cwd: repositoryRoot,
    detached: process.platform !== "win32",
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const exited = new Promise((resolveExit) => {
    child.once("error", (error) => resolveExit({ error }));
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
  return { child, exited, getOutput: () => output.trim() };
}

const signalProcessTree = (child, signal) => {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* already stopped */ }
  }
};

async function stopVite(server) {
  if (!server?.child || server.child.exitCode !== null || server.child.signalCode !== null) return;
  signalProcessTree(server.child, "SIGTERM");
  const stopped = await Promise.race([server.exited.then(() => true), delay(3_000).then(() => false)]);
  if (stopped) return;
  signalProcessTree(server.child, "SIGKILL");
  await Promise.race([server.exited, delay(2_000)]);
}

async function waitForVite(server, appUrl) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await Promise.race([
      fetch(appUrl, { signal: AbortSignal.timeout(1_000) })
        .then(async (response) => ({ response, html: await response.text() }))
        .catch((error) => ({ error })),
      server.exited.then((exit) => ({ exit })),
    ]);
    if (result.exit) throw new Error(`Vite exited before readiness: ${result.exit.error?.message || result.exit.code}`);
    if (result.response?.ok && result.html.includes('id="root"')) return;
    await delay(150);
  }
  throw new Error(`Vite was not ready within ${READY_TIMEOUT_MS}ms`);
}

const parsePromptContext = (systemContent) => {
  const marker = systemContent.lastIndexOf("\n{");
  return marker >= 0 ? JSON.parse(systemContent.slice(marker + 1)) : {};
};

async function installNetworkPolicy(context, appOrigin, diagnostics) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    if (url === QA_API_URL) {
      diagnostics.apiRequests.push(url);
      const body = request.postDataJSON();
      const systemContent = String(body?.messages?.[0]?.content || "");
      const prompt = parsePromptContext(systemContent);
      const content = prompt.activityType
        ? JSON.stringify({
            eventId: prompt.eventId,
            activityType: prompt.activityType,
            requestSequence: prompt.requestSequence,
            title: `QA ${prompt.activityType}`,
            subject: "发布前验证",
            summary: "验证动作语义与画面一致",
            insightOrResult: "确定性探针通过",
          })
        : JSON.stringify({
            conversationId: prompt.conversationId,
            requestSequence: prompt.requestSequence,
            speakerId: prompt.members?.[0]?.memberId || "boss",
            text: "这一组对话只使用自己的角色与上下文。",
            end: false,
          });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ choices: [{ message: { content } }] }),
      });
      return;
    }

    const parsed = new URL(url);
    const sameOriginApiRequest = parsed.origin === appOrigin
      && ["fetch", "xhr"].includes(request.resourceType())
      && /\/(?:api|v1)(?:\/|$)/u.test(parsed.pathname);
    if (parsed.origin !== appOrigin || sameOriginApiRequest) {
      diagnostics.unexpectedRequests.push(`${request.method()} ${url}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

async function seedReleaseState(context) {
  await context.addInitScript((seed) => {
    const now = Date.now();
    const conversationRecord = {
      conversationId: "qa-conversation-history",
      workSessionId: seed.workSessionId,
      sceneId: "office",
      locationId: "employee1:desk",
      topic: "发布前项目复盘",
      participantSnapshots: [
        { memberId: "employee1", profileId: "qa-main", name: "周予安", personality: "沉静" },
        { memberId: "employee2", profileId: "qa-npc-1", name: "程雾", personality: "游戏、外向" },
      ],
      startedAt: now - 120_000,
      endedAt: now - 60_000,
      transcript: [{ speakerId: "employee1", text: seed.longDialogue }],
    };
    const rejectedRecordKey = ["activity", "Events"].join("");
    const officeState = {
      mode: "free",
      now,
      durationMs: 8 * 60 * 60 * 1000,
      workSessionId: seed.workSessionId,
      visibleSceneId: "office",
      conversationRecords: [conversationRecord],
      [rejectedRecordKey]: [{ title: seed.rejectedRecordText }],
    };
    localStorage.setItem(seed.keys.assignments, JSON.stringify(seed.assignments));
    localStorage.setItem(seed.keys.officeState, JSON.stringify(officeState));
    localStorage.setItem(seed.keys.apiConfig, JSON.stringify(seed.apiConfig));
    localStorage.setItem(seed.keys.meProfiles, JSON.stringify(seed.meProfiles));
    localStorage.setItem(seed.keys.characters, JSON.stringify(seed.characters));
    localStorage.setItem(seed.keys.relations, JSON.stringify(seed.relations));
    Math.random = () => 0.999999;
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = (callback, milliseconds, ...args) => (
      milliseconds === 250 ? 0 : nativeSetInterval(callback, milliseconds, ...args)
    );
  }, {
    apiConfig: QA_API_CONFIG,
    assignments: QA_ASSIGNMENTS,
    characters: QA_CHARACTER_PROFILES,
    keys: STORAGE_KEYS,
    longDialogue: LONG_DIALOGUE,
    meProfiles: QA_ME_PROFILES,
    rejectedRecordText: "QA_REJECTED_NON_DIALOGUE_RECORD",
    relations: QA_RELATIONS,
    workSessionId: QA_WORK_SESSION_ID,
  });
}

async function openWork(page, appUrl) {
  const qaUrl = new URL(appUrl);
  qaUrl.searchParams.set("officeQa", "1");
  await page.goto(qaUrl.href, { waitUntil: "domcontentloaded" });
  const unlock = page.getByRole("button", { name: "上划解锁", exact: true });
  if (await unlock.count() && await unlock.isVisible()) await unlock.click();
  await page.locator(".phone-surface").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "第 2 页", exact: true }).click();
  await page.getByRole("button", { name: "工作", exact: true }).click();
  await page.locator(".work-app-screen").waitFor({ state: "visible" });
  await page.locator('canvas[data-office-renderer="pixi"]').waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean(window.__CCAT_OFFICE_QA__), null, { timeout: READY_TIMEOUT_MS });
  assert(await page.getByText("场景暂时无法加载", { exact: true }).count() === 0, "renderer fallback is visible");
}

async function inspectRenderedPixels(page, locator, label) {
  const overlay = page.locator(".office-scene-overlay");
  await overlay.evaluate((element) => { element.style.visibility = "hidden"; });
  const bytes = await locator.screenshot();
  await overlay.evaluate((element) => { element.style.visibility = ""; });
  const result = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    let nonTransparent = 0;
    const stride = Math.max(4, Math.floor((canvas.width * canvas.height) / 50_000) * 4);
    for (let index = 0; index + 3 < pixels.length; index += stride) {
      if (pixels[index + 3] > 0) nonTransparent += 1;
      colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}:${pixels[index + 3]}`);
    }
    return { width: canvas.width, height: canvas.height, nonTransparent, uniqueColors: colors.size };
  }, bytes.toString("base64"));
  assert(result.nonTransparent > 100, `${label}: canvas screenshot is transparent or empty`);
  assert(result.uniqueColors > 32, `${label}: canvas screenshot is blank or effectively monochrome`);
  return result;
}

async function verifyCanvas(page, viewportLabel, sceneLabel) {
  const canvases = page.locator('canvas[data-office-renderer="pixi"]');
  assert(await canvases.count() === 1, `${viewportLabel} ${sceneLabel}: expected exactly one Pixi canvas`);
  const canvas = canvases.first();
  assert(await page.locator(".office-renderer-error").count() === 0, `${viewportLabel} ${sceneLabel}: renderer fallback is visible`);
  const metrics = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { cssWidth: rect.width, cssHeight: rect.height, backingWidth: element.width, backingHeight: element.height };
  });
  assert(metrics.cssWidth > 0 && metrics.cssHeight > 0, `${viewportLabel} ${sceneLabel}: canvas has no CSS size`);
  assert(metrics.backingWidth >= Math.floor(metrics.cssWidth * 2), `${viewportLabel} ${sceneLabel}: canvas backing width is below 2x CSS`);
  assert(metrics.backingHeight >= Math.floor(metrics.cssHeight * 2), `${viewportLabel} ${sceneLabel}: canvas backing height is below 2x CSS`);
  const pixels = await inspectRenderedPixels(page, canvas, `${viewportLabel} ${sceneLabel}`);
  return { ...metrics, ...pixels };
}

const rectanglesOverlap = (left, right) => (
  Math.min(left.right, right.right) > Math.max(left.left, right.left)
  && Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top)
);

async function getOverlayGeometry(page) {
  return page.evaluate(async () => {
    const { OFFICE_SCENES } = await import(new URL("src/work/officeSceneManifest.js", location.href).href);
    const scene = document.querySelector(".office-scene");
    const canvas = document.querySelector('canvas[data-office-renderer="pixi"]');
    const sceneRect = scene?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const overlays = [...document.querySelectorAll("[data-office-actor-overlay]:not([hidden])")];
    const elementRect = (element, id, kind = "label") => {
      const rect = element.getBoundingClientRect();
      return { id, kind, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const sceneId = document.querySelector(".office-door-control")?.dataset.scene || "office";
    const scale = Math.min(canvasRect.width / 1080, canvasRect.height / 1920);
    const offsetX = canvasRect.left + ((canvasRect.width - (1080 * scale)) / 2);
    const offsetY = canvasRect.top + ((canvasRect.height - (1920 * scale)) / 2);
    const furniture = OFFICE_SCENES[sceneId].objects.map((object) => {
      const colliders = object.colliders?.length ? object.colliders : [object];
      return {
        id: object.id,
        left: offsetX + (Math.min(...colliders.map(({ x }) => x)) * scale),
        top: offsetY + (Math.min(...colliders.map(({ y }) => y)) * scale),
        right: offsetX + (Math.max(...colliders.map(({ x, width }) => x + width)) * scale),
        bottom: offsetY + (Math.max(...colliders.map(({ y, height }) => y + height)) * scale),
      };
    });
    const bodies = overlays.map((element) => {
      const screenX = Number(element.dataset.screenX);
      const screenY = Number(element.dataset.screenY);
      const headY = Number(element.dataset.headScreenY);
      const height = Math.max(1, screenY - headY);
      const width = Math.min(90, Math.max(34, height * 0.6));
      return {
        id: `${element.dataset.officeActorOverlay}:body`,
        left: sceneRect.left + screenX - (width / 2),
        top: sceneRect.top + headY,
        right: sceneRect.left + screenX + (width / 2),
        bottom: sceneRect.top + screenY,
      };
    });
    return {
      sceneId,
      scene: sceneRect && { left: sceneRect.left, top: sceneRect.top, right: sceneRect.right, bottom: sceneRect.bottom },
      actorIds: overlays.map((element) => element.dataset.officeActorOverlay),
      labels: overlays.flatMap((element) => [
        [element.querySelector(".office-actor-bubble"), "bubble"],
        [element.querySelector(".office-actor-label"), "label"],
        [element.querySelector(".office-actor-status"), "status"],
      ].filter(([child]) => Boolean(child)).map(([child, kind]) => (
        elementRect(child, `${element.dataset.officeActorOverlay}:${kind}`, kind)
      ))),
      names: overlays.map((element) => elementRect(
        element.querySelector(".office-actor-name"),
        element.dataset.officeActorOverlay,
      )),
      positions: overlays.map((element) => ({
        id: element.dataset.officeActorOverlay,
        sceneId: element.dataset.sceneId,
        x: Number(element.dataset.worldX),
        y: Number(element.dataset.worldY),
      })),
      headByActor: Object.fromEntries(overlays.map((element) => [
        element.dataset.officeActorOverlay,
        sceneRect.top + Number(element.dataset.headScreenY),
      ])),
      screenXByActor: Object.fromEntries(overlays.map((element) => [
        element.dataset.officeActorOverlay,
        sceneRect.left + Number(element.dataset.screenX),
      ])),
      bodies,
      furniture,
    };
  });
}

async function verifyOverlays(page, viewportLabel, expectedSceneId = "office") {
  const geometry = await getOverlayGeometry(page);
  assert(geometry.sceneId === expectedSceneId, `${viewportLabel}: expected ${expectedSceneId} overlay geometry`);
  assert(geometry.actorIds.length === 5, `${viewportLabel}: expected five visible ${expectedSceneId} overlays`);
  assert(new Set(geometry.actorIds).size === 5, `${viewportLabel}: duplicate actor overlay IDs`);
  assertDisjointRectangles(geometry.labels, geometry.scene);
  assert(geometry.labels.every((rectangle) => {
    const actorId = rectangle.id.split(":")[0];
    return rectangle.bottom <= geometry.headByActor[actorId] - 4;
  }), `${viewportLabel}: an overlay covers its actor instead of staying above the head`);
  const detached = geometry.labels.filter((rectangle) => {
    const actorId = rectangle.id.split(":")[0];
    const maximumGap = rectangle.kind === "bubble" ? 90 : 30.5;
    return rectangle.bottom < geometry.headByActor[actorId] - maximumGap;
  }).map((rectangle) => ({
    id: rectangle.id,
    bottom: rectangle.bottom,
    head: geometry.headByActor[rectangle.id.split(":")[0]],
  }));
  assert(detached.length === 0, `${viewportLabel}: an overlay is detached from its actor head; ${JSON.stringify(detached)}`);
  assert(geometry.names.every((rectangle) => (
    Math.abs(((rectangle.left + rectangle.right) / 2) - geometry.screenXByActor[rectangle.id]) <= 16
  )), `${viewportLabel}: a name moved too far from its actor head`);
  assert(geometry.labels.every(({ top }) => top >= geometry.scene.top + 4),
    `${viewportLabel}: an overlay is clipped against the scene top or navigation`);
  for (const label of geometry.labels) {
    const bodyOverlap = geometry.bodies.find((body) => rectanglesOverlap(label, body));
    assert(!bodyOverlap, `${viewportLabel}: ${label.id} covers actor body ${bodyOverlap?.id}; label=${JSON.stringify(label)} body=${JSON.stringify(bodyOverlap)}`);
    const furnitureOverlap = geometry.furniture.find((item) => rectanglesOverlap(label, item));
    assert(!furnitureOverlap, `${viewportLabel}: ${label.id} covers fixed furniture ${furnitureOverlap?.id}; label=${JSON.stringify(label)} furniture=${JSON.stringify(furnitureOverlap)}`);
  }
  const legality = await page.evaluate(async (positions) => {
    const moduleUrl = new URL("src/work/officePathfinding.js", location.href).href;
    const { isLegalCharacterPosition } = await import(moduleUrl);
    return positions.map((position) => ({ ...position, legal: isLegalCharacterPosition(position.sceneId, position) }));
  }, geometry.positions);
  assert(legality.every(({ legal }) => legal), `${viewportLabel}: at least one character collider is illegal`);
  const forbiddenDom = await page.locator(".work-app-screen").evaluate((element) => /rug|carpet/iu.test(element.innerHTML));
  assert(!forbiddenDom, `${viewportLabel}: forbidden floor-zone DOM found`);
  return {
    actorIds: geometry.actorIds,
    colliderCount: legality.length,
    overlayRectCount: geometry.labels.length,
    furnitureAvoidCount: geometry.furniture.length,
  };
}

async function verifyConversationPanel(page, viewportLabel) {
  await page.getByRole("button", { name: "对话记录", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "对话记录", exact: true });
  await panel.waitFor({ state: "visible" });
  assert(await panel.locator("article").count() === 1, `${viewportLabel}: panel must contain only one seeded conversation history`);
  assert(await panel.locator("article p").filter({ hasText: LONG_DIALOGUE }).count() === 1, `${viewportLabel}: long conversation transcript is missing`);
  assert(await panel.getByText("QA_REJECTED_NON_DIALOGUE_RECORD", { exact: true }).count() === 0, `${viewportLabel}: non-dialogue record leaked into panel`);
  const bounds = await panel.evaluate((element) => {
    const outer = element.getBoundingClientRect();
    const offenders = [...element.querySelectorAll("article, article *")].flatMap((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left < outer.left - 1 || rect.right > outer.right + 1
        ? [{ tag: child.tagName, left: rect.left, right: rect.right, outerLeft: outer.left, outerRight: outer.right }]
        : [];
    });
    return { offenders };
  });
  assert(bounds.offenders.length === 0, `${viewportLabel}: long conversation DOM overflows horizontally`);
  await page.getByRole("button", { name: "关闭对话记录", exact: true }).click();
  await panel.waitFor({ state: "hidden" });
  return { visibleRecords: 1, strictDialogueOnly: true };
}

async function saveSceneScreenshot(page, viewportLabel, sceneId) {
  const path = resolve(qaDirectory, `office-v2-${viewportLabel}-${sceneId}.png`);
  await page.locator(".phone-surface").screenshot({ path });
  const details = await stat(path);
  assert(details.size >= SCREENSHOT_MIN_BYTES, `${viewportLabel} ${sceneId}: screenshot is unexpectedly small`);
  return { path, bytes: details.size };
}

async function verifyDoorAlignment(page, viewportLabel, expectedSceneId) {
  const evidence = await page.evaluate(async (sceneId) => {
    const { OFFICE_SCENES } = await import(new URL("src/work/officeSceneManifest.js", location.href).href);
    const canvasRect = document.querySelector('canvas[data-office-renderer="pixi"]')?.getBoundingClientRect();
    const button = document.querySelector(".office-door-control");
    const buttonRect = button?.getBoundingClientRect();
    const doorId = sceneId === "lounge" ? "lounge-door" : "office-door";
    const door = OFFICE_SCENES[sceneId].objects.find(({ id }) => id === doorId);
    const scale = Math.min(canvasRect.width / 1080, canvasRect.height / 1920);
    const offsetX = canvasRect.left + ((canvasRect.width - (1080 * scale)) / 2);
    const offsetY = canvasRect.top + ((canvasRect.height - (1920 * scale)) / 2);
    const doorRect = {
      left: offsetX + (door.x * scale),
      top: offsetY + (door.y * scale),
      right: offsetX + ((door.x + door.width) * scale),
      bottom: offsetY + ((door.y + door.height) * scale),
    };
    const center = { x: (buttonRect.left + buttonRect.right) / 2, y: (buttonRect.top + buttonRect.bottom) / 2 };
    return {
      center,
      doorRect,
      dataX: Number(button.dataset.doorScreenX) + canvasRect.left,
      dataY: Number(button.dataset.doorScreenY) + canvasRect.top,
    };
  }, expectedSceneId);
  assert(evidence.center.x >= evidence.doorRect.left && evidence.center.x <= evidence.doorRect.right
    && evidence.center.y >= evidence.doorRect.top && evidence.center.y <= evidence.doorRect.bottom,
  `${viewportLabel}: ${expectedSceneId} door control floats outside the drawn door`);
  assert(Math.hypot(evidence.center.x - evidence.dataX, evidence.center.y - evidence.dataY) <= 1.5,
    `${viewportLabel}: ${expectedSceneId} door control does not use the projected door anchor`);
  return evidence;
}

async function verifySceneSwitch(page, viewportLabel) {
  const door = page.locator(".office-door-control");
  assert(await door.getAttribute("aria-label") === "进入休息区", `${viewportLabel}: office door label is incorrect`);
  const officeCanvas = await verifyCanvas(page, viewportLabel, "office");
  const officeDoor = await verifyDoorAlignment(page, viewportLabel, "office");
  await door.click();
  await page.locator('.office-door-control[data-scene="lounge"]').waitFor({ state: "visible" });
  assert(await door.getAttribute("aria-label") === "返回办公室", `${viewportLabel}: lounge door label is incorrect`);
  const focusedAfterEntering = await door.evaluate((element) => document.activeElement === element);
  assert(focusedAfterEntering, `${viewportLabel}: door focus was not restored after entering lounge`);
  assert(await page.locator('[data-office-actor-overlay]:visible').count() === 0, `${viewportLabel}: inactive office overlays remain visible in lounge`);
  const loungeCanvas = await verifyCanvas(page, viewportLabel, "lounge");
  const loungeDoor = await verifyDoorAlignment(page, viewportLabel, "lounge");
  await door.click();
  await page.locator('.office-door-control[data-scene="office"]').waitFor({ state: "visible" });
  assert(await door.getAttribute("aria-label") === "进入休息区", `${viewportLabel}: office door label was not restored`);
  assert(await door.evaluate((element) => document.activeElement === element), `${viewportLabel}: door focus was not restored after returning`);
  assert(await page.locator('[data-office-actor-overlay]:not([hidden])').count() === 5, `${viewportLabel}: office overlay state was not restored`);
  return { officeCanvas, loungeCanvas, officeDoor, loungeDoor };
}

async function inspectLocomotionLegEvidence(page, characterId) {
  return page.evaluate(async (id) => {
    const moduleUrl = new URL("src/work/pixi/officeCharacterClips.js", location.href).href;
    const { getCharacterClipSource } = await import(moduleUrl);
    const clip = getCharacterClipSource(id, "locomotion");
    const image = new Image();
    image.src = clip.src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = clip.cellSize;
    canvas.height = clip.cellSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const balances = [];
    const signatures = [];
    for (let frame = 0; frame < clip.frameCount; frame += 1) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        frame * clip.cellSize,
        0,
        clip.cellSize,
        clip.cellSize,
        0,
        0,
        clip.cellSize,
        clip.cellSize,
      );
      const pixels = context.getImageData(0, Math.floor(clip.cellSize * 0.62), clip.cellSize, Math.floor(clip.cellSize * 0.32)).data;
      let left = 0;
      let right = 0;
      let hash = 2166136261;
      for (let index = 0; index + 3 < pixels.length; index += 4) {
        const x = (index / 4) % clip.cellSize;
        const alpha = pixels[index + 3];
        if (x < clip.cellSize / 2) left += alpha;
        else right += alpha;
        if (index % 64 === 0) hash = Math.imul(hash ^ alpha, 16777619) >>> 0;
      }
      balances.push(left - right);
      signatures.push(hash);
    }
    const deltas = balances.slice(1).map((balance, index) => balance - balances[index]);
    return {
      frameCount: clip.frameCount,
      uniqueSignatures: new Set(signatures).size,
      balanceRange: Math.max(...balances) - Math.min(...balances),
      directionChanges: deltas.slice(1).filter((delta, index) => delta && deltas[index] && Math.sign(delta) !== Math.sign(deltas[index])).length,
    };
  }, characterId);
}

async function captureLiveCanvasFrame(page, sceneId) {
  const dataUrl = await page.evaluate((requestedSceneId) => (
    window.__CCAT_OFFICE_QA__.captureSceneFrame(requestedSceneId)
  ), sceneId);
  assert(typeof dataUrl === "string" && dataUrl.startsWith("data:image/png;base64,"),
    `${sceneId}: Pixi scene extraction did not return a PNG frame`);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function inspectCanvasCrop(page, screenshot, crop) {
  return page.evaluate(async ({ base64, crop: requested }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const scaleX = image.naturalWidth / requested.cssWidth;
    const scaleY = image.naturalHeight / requested.cssHeight;
    const left = Math.max(0, Math.floor((requested.centerX - (requested.width / 2)) * scaleX));
    const top = Math.max(0, Math.floor((requested.centerY - (requested.height / 2)) * scaleY));
    const width = Math.max(1, Math.min(image.naturalWidth - left, Math.ceil(requested.width * scaleX)));
    const height = Math.max(1, Math.min(image.naturalHeight - top, Math.ceil(requested.height * scaleY)));
    const pixels = context.getImageData(left, top, width, height).data;
    let borderR = 0;
    let borderG = 0;
    let borderB = 0;
    let borderCount = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (x > 1 && x < width - 2 && y > 1 && y < height - 2) continue;
        const index = ((y * width) + x) * 4;
        borderR += pixels[index];
        borderG += pixels[index + 1];
        borderB += pixels[index + 2];
        borderCount += 1;
      }
    }
    const background = [borderR / borderCount, borderG / borderCount, borderB / borderCount];
    let fingerprint = 2166136261;
    let nonBackgroundPixels = 0;
    for (let index = 0; index + 3 < pixels.length; index += 4) {
      const distance = Math.abs(pixels[index] - background[0])
        + Math.abs(pixels[index + 1] - background[1])
        + Math.abs(pixels[index + 2] - background[2]);
      if (pixels[index + 3] > 0 && distance > 45) nonBackgroundPixels += 1;
      fingerprint = Math.imul(fingerprint ^ pixels[index], 16777619) >>> 0;
      fingerprint = Math.imul(fingerprint ^ pixels[index + 1], 16777619) >>> 0;
      fingerprint = Math.imul(fingerprint ^ pixels[index + 2], 16777619) >>> 0;
    }
    return { cropFingerprint: fingerprint.toString(16), nonBackgroundPixels, width, height };
  }, { base64: screenshot.toString("base64"), crop });
}

async function compareCanvasMotionFrames(page, before, after, oldCrop, newCrop) {
  return page.evaluate(async ({ beforeBase64, afterBase64, oldCrop: oldRequested, newCrop: newRequested }) => {
    const decode = async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, context };
    };
    const [left, right] = await Promise.all([decode(beforeBase64), decode(afterBase64)]);
    const compare = (requested) => {
      const scaleX = left.width / requested.cssWidth;
      const scaleY = left.height / requested.cssHeight;
      const x = Math.max(0, Math.floor((requested.centerX - (requested.width / 2)) * scaleX));
      const y = Math.max(0, Math.floor((requested.centerY - (requested.height / 2)) * scaleY));
      const width = Math.max(1, Math.min(left.width - x, Math.ceil(requested.width * scaleX)));
      const height = Math.max(1, Math.min(left.height - y, Math.ceil(requested.height * scaleY)));
      const beforePixels = left.context.getImageData(x, y, width, height).data;
      const afterPixels = right.context.getImageData(x, y, width, height).data;
      let changed = 0;
      let brightened = 0;
      let darkened = 0;
      for (let index = 0; index + 3 < beforePixels.length; index += 4) {
        const red = afterPixels[index] - beforePixels[index];
        const green = afterPixels[index + 1] - beforePixels[index + 1];
        const blue = afterPixels[index + 2] - beforePixels[index + 2];
        if ((Math.abs(red) + Math.abs(green) + Math.abs(blue)) > 45) changed += 1;
        const luminanceDelta = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
        if (luminanceDelta > 10) brightened += 1;
        else if (luminanceDelta < -10) darkened += 1;
      }
      return { changed, brightened, darkened };
    };
    const oldRegion = compare(oldRequested);
    const newRegion = compare(newRequested);
    const lightActorDirection = oldRegion.darkened + newRegion.brightened;
    const darkActorDirection = oldRegion.brightened + newRegion.darkened;
    return {
      oldRegionChangedPixels: oldRegion.changed,
      newRegionChangedPixels: newRegion.changed,
      oldRegionClearedPixels: darkActorDirection >= lightActorDirection ? oldRegion.brightened : oldRegion.darkened,
      newRegionAppearedPixels: darkActorDirection >= lightActorDirection ? newRegion.darkened : newRegion.brightened,
    };
  }, {
    beforeBase64: before.toString("base64"),
    afterBase64: after.toString("base64"),
    oldCrop,
    newCrop,
  });
}

async function verifyLiveLocomotion(page, viewportLabel) {
  const qaSpeed = 60;
  const event = await page.evaluate((speed) => window.__CCAT_OFFICE_QA__.schedule("printing", { speed }), qaSpeed);
  assert(event?.activityId === "printing" && event.actorIds?.length === 1,
    `${viewportLabel}: real scheduler did not create the printing route`);
  const actorId = event.actorIds[0];
  const actor = page.locator(`[data-office-actor-overlay="${actorId}"]`);
  await page.locator(`[data-office-actor-overlay="${actorId}"][data-moving="true"]`).waitFor({ state: "visible", timeout: 5_000 });
  const samples = [];
  const screenshots = [];
  const crops = [];
  const canvas = page.locator('canvas[data-office-renderer="pixi"]');
  const canvasMetrics = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { cssWidth: rect.width, cssHeight: rect.height };
  });
  for (let index = 0; index < 8; index += 1) {
    const sample = await actor.evaluate((element) => ({
      time: performance.now(),
      x: Number(element.dataset.worldX),
      y: Number(element.dataset.worldY),
      screenX: Number(element.dataset.screenX),
      screenY: Number(element.dataset.screenY),
      headScreenY: Number(element.dataset.headScreenY),
      frame: Number(element.dataset.motionFrame),
      clip: element.dataset.motionClip,
      moving: element.dataset.moving,
    }));
    if (sample.moving !== "true") break;
    const bodyHeight = Math.max(54, sample.screenY - sample.headScreenY);
    const crop = {
      ...canvasMetrics,
      centerX: sample.screenX,
      centerY: sample.headScreenY + (bodyHeight / 2),
      width: Math.min(100, Math.max(48, bodyHeight * 0.72)),
      height: bodyHeight,
    };
    const screenshot = await captureLiveCanvasFrame(page, "office");
    samples.push(sample);
    screenshots.push(screenshot);
    crops.push(crop);
    await delay(100);
  }
  assert(samples.length >= 6, `${viewportLabel}: walking actor arrived before enough live samples were captured`);
  for (let index = 0; index < samples.length; index += 1) {
    Object.assign(samples[index], await inspectCanvasCrop(page, screenshots[index], crops[index]));
  }
  assert(samples.every(({ clip, moving: isMoving }) => clip === "locomotion" && isMoving === "true"), `${viewportLabel}: live walking actor did not retain locomotion clip`);
  const transitions = [];
  for (let index = 1; index < samples.length; index += 1) {
    transitions.push({
      distance: Math.hypot(samples[index].x - samples[index - 1].x, samples[index].y - samples[index - 1].y),
      elapsedMs: samples[index].time - samples[index - 1].time,
      ...await compareCanvasMotionFrames(page, screenshots[index - 1], screenshots[index], crops[index - 1], crops[index]),
    });
  }
  assertActorMotionEvidence({ samples, transitions });
  const assignment = QA_ASSIGNMENTS[actorId] || QA_ASSIGNMENTS.employee1;
  const legEvidence = await inspectLocomotionLegEvidence(page, assignment.chibiId);
  assert(legEvidence.frameCount === 8, `${viewportLabel}: locomotion strip must contain eight frames`);
  assert(legEvidence.uniqueSignatures >= 6, `${viewportLabel}: lower-body locomotion frames are not distinct`);
  assert(legEvidence.balanceRange > 10_000 && legEvidence.directionChanges >= 2, `${viewportLabel}: no alternating left/right leg evidence`);
  await page.waitForFunction((id) => {
    const character = window.__CCAT_OFFICE_QA__.getState().state.characters[id];
    return character?.phase === "printing" && character?.targetAnchorId === "printer:front";
  }, actorId, { timeout: 30_000 });
  return {
    actorId,
    activityId: event.activityId,
    positionSamples: samples.length,
    distinctPositions: new Set(samples.map(({ x, y }) => `${x.toFixed(2)}:${y.toFixed(2)}`)).size,
    distinctFrames: new Set(samples.map(({ frame }) => frame)).size,
    canvasTransitions: transitions.length,
    legEvidence,
  };
}

async function getWorldCrop(page, { x, y, width, height }) {
  return page.locator('canvas[data-office-renderer="pixi"]').evaluate((element, worldRect) => {
    const rect = element.getBoundingClientRect();
    const scale = Math.min(rect.width / 1080, rect.height / 1920);
    const offsetX = (rect.width - (1080 * scale)) / 2;
    const offsetY = (rect.height - (1920 * scale)) / 2;
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      centerX: offsetX + (worldRect.x * scale),
      centerY: offsetY + (worldRect.y * scale),
      width: worldRect.width * scale,
      height: worldRect.height * scale,
    };
  }, { x, y, width, height });
}

async function assertCanvasRegionChanged(page, before, after, worldRect, label) {
  const crop = await getWorldCrop(page, worldRect);
  const difference = await compareCanvasMotionFrames(page, before, after, crop, crop);
  assert(difference.oldRegionChangedPixels >= 40, `${label}: expected live canvas pixels to change`);
  return difference.oldRegionChangedPixels;
}

async function scheduleQaActivity(page, viewportLabel, activityId, speed = 900, randomValues = [0], blockedAnchorIds = []) {
  const event = await page.evaluate(({ requestedActivityId, requestedSpeed, requestedRandomValues, requestedBlockedAnchorIds }) => (
    window.__CCAT_OFFICE_QA__.schedule(requestedActivityId, {
      blockedAnchorIds: requestedBlockedAnchorIds,
      speed: requestedSpeed,
      randomValues: requestedRandomValues,
    })
  ), {
    requestedActivityId: activityId,
    requestedSpeed: speed,
    requestedRandomValues: randomValues,
    requestedBlockedAnchorIds: blockedAnchorIds,
  });
  assert(event?.activityId === activityId, `${viewportLabel}: real scheduler did not create ${activityId}`);
  return event;
}

async function waitForQaActivity(page, event, timeout = 15_000) {
  await page.waitForFunction((expected) => {
    const state = window.__CCAT_OFFICE_QA__.getState().state;
    return expected.actorIds.every((actorId) => {
      const character = state.characters[actorId];
      return character?.activity === expected.activityId
        && !["walkingToActivity", "waitingForConversation"].includes(character.phase);
    });
  }, { actorIds: event.actorIds, activityId: event.activityId }, { timeout });
}

async function queueConversationEvidence(page, textByActivityId, speakerOffset = 0) {
  return page.evaluate(({ requestedTexts, requestedSpeakerOffset }) => {
    const bridge = window.__CCAT_OFFICE_QA__;
    const conversations = Object.values(bridge.getState().state.conversations);
    return conversations.map((conversation, index) => {
      const text = requestedTexts[conversation.activityId] || "";
      const speakerId = conversation.memberIds[(index + requestedSpeakerOffset) % conversation.memberIds.length];
      return {
        id: conversation.id,
        activityId: conversation.activityId,
        memberIds: [...conversation.memberIds],
        speakerId,
        text,
        queued: Boolean(text) && bridge.queueBubble(
          conversation.id,
          speakerId,
          text,
        ),
      };
    });
  }, { requestedTexts: textByActivityId, requestedSpeakerOffset: speakerOffset });
}

async function verifyQueuedConversationBubbles(page, expected, viewportLabel) {
  await page.waitForFunction((requested) => requested.every(({ speakerId, text }) => {
    const actor = document.querySelector(`[data-office-actor-overlay="${speakerId}"]`);
    return actor?.querySelector(".office-actor-bubble")?.textContent === text;
  }), expected);
  const visible = await page.locator(".office-actor-bubble").evaluateAll((elements) => elements.map((element) => ({
    speakerId: element.closest("[data-office-actor-overlay]")?.dataset.officeActorOverlay,
    text: element.textContent,
  })));
  assert(visible.length === expected.length, `${viewportLabel}: unexpected visible conversation bubble count`);
  assert(expected.every((bubble) => visible.some((entry) => (
    entry.speakerId === bubble.speakerId && entry.text === bubble.text
  ))), `${viewportLabel}: visible conversation text or speaker crossed sessions`);
  return visible;
}

async function runDynamicOfficeEvidence(page, viewportLabel) {
  const canvas = page.locator('canvas[data-office-renderer="pixi"]');
  const idleCanvas = await canvas.screenshot();
  const locomotion = await verifyLiveLocomotion(page, viewportLabel);
  const whiteboard = await scheduleQaActivity(page, viewportLabel, "whiteboardWork");
  const chatting = await scheduleQaActivity(
    page,
    viewportLabel,
    "chatting",
    900,
    [0.999, 0, 0.999],
  );
  assert(/^(?:boss|employee[1-4]):desk$/u.test(chatting.locationId),
    `${viewportLabel}: evidence chat did not use a real colleague desk`);
  assert(chatting.anchorByMember[chatting.hostId] === `${chatting.hostId}:seat-approach`
    && chatting.visitorIds.every((visitorId) => chatting.anchorByMember[visitorId].startsWith(`${chatting.hostId}:visitor-`)),
  `${viewportLabel}: desk chat did not keep its host seated and route visitors to the desk front`);
  await Promise.all([waitForQaActivity(page, whiteboard), waitForQaActivity(page, chatting)]);
  await page.waitForFunction(() => Object.keys(window.__CCAT_OFFICE_QA__.getState().state.conversations).length === 1);
  const conversations = await queueConversationEvidence(page, {
    chatting: "发布清单已核对，结论一致。",
  }, 1);
  assertConversationActivityCoverage(conversations, ["chatting"]);
  assert(conversations.length === 1 && conversations[0].queued, `${viewportLabel}: office conversation bubble was not queued`);
  await verifyQueuedConversationBubbles(page, conversations, viewportLabel);
  await delay(250);
  const activeCanvas = await canvas.screenshot();
  const screenshot = await saveSceneScreenshot(page, viewportLabel, "office");
  const overlays = await verifyOverlays(page, viewportLabel, "office");
  const door = await verifyDoorAlignment(page, viewportLabel, "office");
  const propPixelChanges = {
    printer: await assertCanvasRegionChanged(page, idleCanvas, activeCanvas,
      { x: 190, y: 1510, width: 300, height: 250 }, `${viewportLabel} printer`),
    whiteboard: await assertCanvasRegionChanged(page, idleCanvas, activeCanvas,
      { x: 900, y: 520, width: 260, height: 400 }, `${viewportLabel} whiteboard`),
  };
  const canvasEvidence = await verifyCanvas(page, viewportLabel, "office-dynamic");
  const runtime = await page.evaluate(() => {
    const state = window.__CCAT_OFFICE_QA__.getState().state;
    return Object.fromEntries(Object.entries(state.characters).map(([id, character]) => [id, {
      activity: character.activity,
      phase: character.phase,
      targetAnchorId: character.targetAnchorId,
    }]));
  });
  assert(Object.values(runtime).some(({ activity, targetAnchorId }) => activity === "printing" && targetAnchorId === "printer:front"),
    `${viewportLabel}: printing actor is not visibly anchored at the printer`);
  assert(Object.values(runtime).some(({ activity, targetAnchorId }) => activity === "whiteboardWork" && targetAnchorId.startsWith("whiteboard:")),
    `${viewportLabel}: whiteboard actor is not visibly anchored at the whiteboard`);
  return {
    screenshot,
    canvas: canvasEvidence,
    overlays,
    door,
    locomotion,
    conversationIds: conversations.map(({ id }) => id),
    propPixelChanges,
    runtime,
  };
}

async function runDynamicLoungeEvidence(page, appUrl, viewportLabel) {
  await openWork(page, appUrl);
  await page.evaluate(() => window.__CCAT_OFFICE_QA__.setVisibleScene("lounge"));
  await page.locator('.office-door-control[data-scene="lounge"]').waitFor({ state: "visible" });
  const canvas = page.locator('canvas[data-office-renderer="pixi"]');
  const idleLounge = await canvas.screenshot();
  const watchingTv = await scheduleQaActivity(page, viewportLabel, "watchingTv");
  await waitForQaActivity(page, watchingTv);
  const tvCanvas = await canvas.screenshot();
  const tvPixelChanges = await assertCanvasRegionChanged(page, idleLounge, tvCanvas,
    { x: 850, y: 1400, width: 360, height: 420 }, `${viewportLabel} sofa TV`);

  await openWork(page, appUrl);
  await page.evaluate(() => window.__CCAT_OFFICE_QA__.setVisibleScene("lounge"));
  await page.locator('.office-door-control[data-scene="lounge"]').waitFor({ state: "visible" });
  const diningChat = await scheduleQaActivity(page, viewportLabel, "diningChat");
  const sofaChat = await scheduleQaActivity(page, viewportLabel, "sofaChat");
  const drinking = await scheduleQaActivity(page, viewportLabel, "drinking");
  await Promise.all([
    waitForQaActivity(page, diningChat),
    waitForQaActivity(page, sofaChat),
    waitForQaActivity(page, drinking),
  ]);
  await page.waitForFunction(() => Object.keys(window.__CCAT_OFFICE_QA__.getState().state.conversations).length === 2);
  const conversations = await queueConversationEvidence(page, {
    diningChat: "午餐组只讨论今天的菜和下午安排。",
    sofaChat: "沙发组正在聊这部剧的剧情，不会串到午餐组。",
  });
  assertConversationActivityCoverage(conversations, ["diningChat", "sofaChat"]);
  assert(conversations.length === 2 && conversations.every(({ queued }) => queued),
    `${viewportLabel}: two isolated lounge bubbles were not queued`);
  assert(conversations.every(({ memberIds }) => memberIds.length === 2)
    && conversations[0].memberIds.every((id) => !conversations[1].memberIds.includes(id)),
  `${viewportLabel}: queued lounge conversations crossed members`);
  await verifyQueuedConversationBubbles(page, conversations, viewportLabel);
  await delay(250);
  const activeCanvas = await canvas.screenshot();
  const screenshot = await saveSceneScreenshot(page, viewportLabel, "lounge");
  const overlays = await verifyOverlays(page, viewportLabel, "lounge");
  const door = await verifyDoorAlignment(page, viewportLabel, "lounge");
  const activityPixelChanges = {
    dining: await assertCanvasRegionChanged(page, idleLounge, activeCanvas,
      { x: 540, y: 920, width: 700, height: 520 }, `${viewportLabel} dining chat`),
    sofa: await assertCanvasRegionChanged(page, idleLounge, activeCanvas,
      { x: 470, y: 1490, width: 850, height: 500 }, `${viewportLabel} sofa chat`),
  };
  const canvasEvidence = await verifyCanvas(page, viewportLabel, "lounge-dynamic");
  const runtime = await page.evaluate(() => {
    const state = window.__CCAT_OFFICE_QA__.getState().state;
    return {
      characters: Object.fromEntries(Object.entries(state.characters).map(([id, character]) => [id, {
        activity: character.activity,
        phase: character.phase,
        sceneId: character.sceneId,
        targetAnchorId: character.targetAnchorId,
      }])),
      conversations: Object.values(state.conversations).map(({ id, memberIds, activityId, bubbleQueue }) => ({
        id,
        memberIds: [...memberIds],
        activityId,
        bubbleCount: bubbleQueue.length,
      })),
    };
  });
  assert(Object.values(runtime.characters).every(({ sceneId }) => sceneId === "lounge"),
    `${viewportLabel}: not all lounge actors completed the cross-door route`);
  assert(runtime.conversations.length === 2
    && runtime.conversations.every(({ memberIds }) => memberIds.length === 2)
    && runtime.conversations[0].memberIds.every((id) => !runtime.conversations[1].memberIds.includes(id)),
  `${viewportLabel}: live conversation groups crossed members or bubbles`);
  return {
    screenshot,
    canvas: canvasEvidence,
    overlays,
    door,
    standaloneTvActivityId: watchingTv.activityId,
    tvPixelChanges,
    activityPixelChanges,
    conversationIds: conversations.map(({ id }) => id),
    runtime,
  };
}

async function runDeterministicContractProbes(page) {
  return page.evaluate(async () => {
    const load = (path) => import(new URL(`src/work/${path}`, location.href).href);
    const [
      scheduler,
      stateModule,
      sceneModule,
      pathfinding,
      worldModule,
      activityModule,
      conversationApi,
      recordModule,
      clipModule,
      assetModule,
      sceneViewModule,
    ] = await Promise.all([
      load("officeScheduler.js"),
      load("officeState.js"),
      load("officeSceneManifest.js"),
      load("officePathfinding.js"),
      load("officeWorld.js"),
      load("officeActivityManifest.js"),
      load("officeConversationApi.js"),
      load("officeConversationRecords.js"),
      load("pixi/officeCharacterClips.js"),
      load("pixi/officeAssetManifest.js"),
      load("pixi/OfficeSceneView.js"),
    ]);
    const ensure = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const slotIds = ["boss", "employee1", "employee2", "employee3", "employee4"];
    const assignments = Object.fromEntries(slotIds.map((slotId) => [slotId, {
      profileId: slotId,
      profile: { id: slotId, name: slotId, personality: slotId === "employee2" ? "外向" : "自然" },
    }]));
    const createState = (now) => stateModule.createOfficeState({
      assignments,
      now,
      durationMs: 8 * 60 * 60 * 1000,
      workSessionId: "qa-contract-session",
    });
    const choose = (activityId, now) => {
      const state = createState(now);
      state.forcedActivityId = activityId;
      const event = scheduler.chooseOfficeEvent({ state, profiles: assignments, random: () => 0, now });
      ensure(event, `missing deterministic event ${activityId}`);
      return event;
    };

    const probes = {
      deskVisit: choose("chatting", 1_000),
      bossReport: choose("reporting", 2_000),
      printer: choose("printing", 3_000),
      whiteboard: choose("whiteboardWork", 4_000),
      diningChat: choose("diningChat", 5_000),
      sofaTv: choose("watchingTv", 6_000),
    };
    ensure(probes.deskVisit.locationId.endsWith(":desk"), "desk visit did not target a colleague desk");
    ensure(probes.deskVisit.actorIds.length === 2 && Object.keys(probes.deskVisit.routesByActor).length === 1, "desk host must stay while visitor walks");
    ensure(probes.bossReport.actorIds[0] !== "boss" && probes.bossReport.actorIds[1] === "boss", "boss report role contract failed");
    ensure(probes.printer.targetAnchors[0] === "printer:front", "printer probe anchor failed");
    ensure(probes.whiteboard.targetAnchors.every((anchor) => anchor.startsWith("whiteboard:")), "whiteboard probe anchor failed");
    ensure(probes.diningChat.sceneId === "lounge" && probes.diningChat.locationId === "dining", "dining chat probe failed");
    ensure(probes.sofaTv.sceneId === "lounge" && probes.sofaTv.targetAnchors[0].startsWith("sofa:seat-"), "sofa TV probe failed");

    const simultaneousState = createState(7_000);
    simultaneousState.forcedActivityId = "chatting";
    const first = scheduler.chooseOfficeEvent({ simultaneousState, state: simultaneousState, profiles: assignments, random: () => 0, now: 7_000 });
    ensure(first, "first isolated conversation event missing");
    for (const actorId of first.actorIds) {
      simultaneousState.characters[actorId] = { ...simultaneousState.characters[actorId], phase: "waitingForConversation", activity: "chatting" };
    }
    const second = scheduler.chooseOfficeEvent({ state: simultaneousState, profiles: assignments, random: () => 0, now: 7_100 });
    ensure(second, "second isolated conversation event missing");
    ensure(first.actorIds.every((actorId) => !second.actorIds.includes(actorId)), "simultaneous conversation members crossed");
    ensure(first.reservationGroupId !== second.reservationGroupId, "simultaneous reservations crossed");

    const sessionFor = (event, text) => ({
      id: event.reservationGroupId,
      memberIds: [...event.actorIds],
      requestSequence: 1,
      topic: "独立会话",
      currentActivity: event.activityId,
      transcript: [{ conversationId: event.reservationGroupId, speakerId: event.actorIds[0], text }],
    });
    const messagesA = conversationApi.buildOfficeConversationMessages(sessionFor(first, "第一组"), assignments, {});
    const messagesB = conversationApi.buildOfficeConversationMessages(sessionFor(second, "第二组"), assignments, {});
    const contextFrom = (messages) => JSON.parse(messages[0].content.slice(messages[0].content.lastIndexOf("\n{") + 1));
    const contextA = contextFrom(messagesA);
    const contextB = contextFrom(messagesB);
    ensure(contextA.conversationId === first.reservationGroupId && contextB.conversationId === second.reservationGroupId, "conversation API IDs crossed");
    ensure(contextA.members.every(({ memberId }) => first.actorIds.includes(memberId)), "first API context leaked members");
    ensure(contextB.members.every(({ memberId }) => second.actorIds.includes(memberId)), "second API context leaked members");

    const from = { sceneId: "office", ...sceneModule.getSceneAnchor("office", "employee1:seat-approach") };
    const to = { sceneId: "lounge", ...sceneModule.getSceneAnchor("lounge", "dining:seat-1") };
    const route = worldModule.buildWorldRoute({ from, to });
    ensure(route.some((entry) => entry.transition === true), "cross-door route has no scene transition");
    const routeSamples = Array.from({ length: 25 }, (_, index) => worldModule.sampleWorldRoute({
      route,
      startedAt: 0,
      now: index * 1_000,
      speed: 180,
    }));
    ensure(routeSamples.some(({ sceneId }) => sceneId === "office") && routeSamples.some(({ sceneId }) => sceneId === "lounge"), "cross-door samples do not cover both scenes");
    ensure(routeSamples.every((sample) => pathfinding.isLegalCharacterPosition(sample.sceneId, sample)), "cross-door sample crossed a collider");

    const deskObjects = sceneModule.OFFICE_SCENES.office.objects.filter(({ templateId }) => templateId === "employee-desk");
    ensure(deskObjects.length === 4, "expected four employee desk objects");
    ensure(new Set(deskObjects.map(({ assetId }) => assetId)).size === 1 && deskObjects[0].assetId === "employee-desk", "employee desks do not share one alias");
    const sceneInventory = JSON.stringify(sceneModule.OFFICE_SCENES).toLowerCase();
    ensure(!/rug|carpet/u.test(sceneInventory), "scene manifest contains a forbidden floor zone");

    const manifestEntries = Object.values(activityModule.OFFICE_ACTIVITY_MANIFEST);
    const furnitureByScene = Object.fromEntries(Object.entries(sceneModule.OFFICE_SCENES).map(([sceneId, scene]) => [
      sceneId,
      new Set(scene.objects.map(({ id }) => id)),
    ]));
    let propPlacementCount = 0;
    let activityVariantCount = 0;
    let visibleActivityVariantCount = 0;
    for (const definition of manifestEntries) {
      for (const clipId of Object.values(definition.clips)) {
        ensure(clipModule.OFFICE_CLIP_METADATA[clipId]?.bodyOnly === true, `${definition.id}: invalid body-only clip ${clipId}`);
      }
      for (const templateAnchor of definition.targetAnchors) {
        const anchor = templateAnchor.startsWith("$actor:") ? `employee1:${templateAnchor.slice(7)}` : templateAnchor;
        ensure(sceneModule.getSceneAnchor(definition.sceneId, anchor), `${definition.id}: missing furniture anchor ${anchor}`);
      }
      const anchorId = definition.targetAnchors[0].startsWith("$actor:")
        ? `employee1:${definition.targetAnchors[0].slice(7)}`
        : definition.targetAnchors[0];
      for (const variant of definition.propState.variants) {
        activityVariantCount += 1;
        const [propState] = sceneViewModule.getActivityPropStates([{
          slotId: definition.requiredActorIds?.[0] || "employee1",
          sceneId: definition.sceneId,
          activityId: definition.id,
          activity: definition.clips.actor || definition.clips.host,
          anchorId,
          propState: { category: definition.propState.category, variant },
        }]);
        ensure(propState, `${definition.id}:${variant}: runtime prop state did not resolve`);
        ensure(furnitureByScene[propState.sceneId]?.has(propState.objectId), `${definition.id}:${variant}: prop is not attached to existing furniture`);
        ensure(propState.generatedFurnitureIds.length === 0, `${definition.id}:${variant}: activity generated duplicate furniture`);
        ensure(propState.props.length === propState.propIds.length, `${definition.id}:${variant}: prop layout count mismatch`);
        ensure(propState.propIds.every((propId) => assetModule.OFFICE_ASSET_MANIFEST.props[propId]), `${definition.id}:${variant}: missing prop asset`);
        const intentionallyPropless = variant === "none";
        ensure(intentionallyPropless || propState.propIds.length > 0, `${definition.id}:${variant}: required visible prop is missing`);
        if (!intentionallyPropless) visibleActivityVariantCount += 1;
        propPlacementCount += propState.propIds.length;
      }
    }

    const strictRecord = {
      conversationId: "qa-strict-record",
      workSessionId: "qa-contract-session",
      sceneId: "office",
      locationId: "employee1:desk",
      topic: "严格记录",
      participantSnapshots: [{ memberId: "employee1", name: "员工一" }, { memberId: "employee2", name: "员工二" }],
      startedAt: 10,
      endedAt: 20,
      transcript: [{ speakerId: "employee1", text: "只记录对话" }],
    };
    const rejectedRecord = { ...strictRecord, eventId: "not-a-conversation-record" };
    const restored = recordModule.restoreConversationRecords([strictRecord, rejectedRecord]);
    ensure(restored.length === 1, "non-dialogue record migration was accepted");
    ensure(Object.keys(restored[0]).join("|") === recordModule.OFFICE_CONVERSATION_RECORD_KEYS.join("|"), "conversation record keys are not strict");

    return {
      activityCount: manifestEntries.length,
      deskAlias: deskObjects[0].assetId,
      deskCount: deskObjects.length,
      propPlacementCount,
      activityVariantCount,
      visibleActivityVariantCount,
      physicalProbeIds: Object.fromEntries(Object.entries(probes).map(([name, event]) => [name, event.activityId])),
      simultaneousConversationIds: [first.reservationGroupId, second.reservationGroupId],
      crossDoorRouteEntries: route.length,
      crossDoorSceneIds: [...new Set(routeSamples.map(({ sceneId }) => sceneId))],
      strictRecordKeys: Object.keys(restored[0]),
    };
  });
}

async function verifyViewport(browser, appUrl, viewport) {
  const viewportLabel = labelViewport(viewport);
  const diagnostics = { consoleErrors: [], failedImages: [], pageErrors: [], unexpectedRequests: [], apiRequests: [] };
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    serviceWorkers: "block",
  });
  try {
    await installNetworkPolicy(context, new URL(appUrl).origin, diagnostics);
    await seedReleaseState(context);
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.resourceType() === "image") diagnostics.failedImages.push(`${request.url()} ${request.failure()?.errorText || "failed"}`);
    });
    page.on("response", (response) => {
      if (response.request().resourceType() === "image" && !response.ok()) diagnostics.failedImages.push(`${response.status()} ${response.url()}`);
    });

    await openWork(page, appUrl);
    const overlays = await verifyOverlays(page, viewportLabel, "office");
    const conversations = await verifyConversationPanel(page, viewportLabel);
    const scenes = await verifySceneSwitch(page, viewportLabel);
    await openWork(page, appUrl);
    const dynamicOffice = await runDynamicOfficeEvidence(page, viewportLabel);
    const dynamicLounge = await runDynamicLoungeEvidence(page, appUrl, viewportLabel);
    const contracts = await runDeterministicContractProbes(page);

    assert(diagnostics.consoleErrors.length === 0, `${viewportLabel}: console errors: ${diagnostics.consoleErrors.join(" | ")}`);
    assert(diagnostics.pageErrors.length === 0, `${viewportLabel}: page errors: ${diagnostics.pageErrors.join(" | ")}`);
    assert(diagnostics.failedImages.length === 0, `${viewportLabel}: failed images: ${diagnostics.failedImages.join(" | ")}`);
    assert(diagnostics.unexpectedRequests.length === 0, `${viewportLabel}: unexpected requests: ${diagnostics.unexpectedRequests.join(" | ")}`);
    return {
      viewport: viewportLabel,
      overlays,
      conversations,
      scenes,
      dynamicOffice,
      dynamicLounge,
      contracts,
      diagnostics,
    };
  } finally {
    await context.close();
  }
}

async function writeQaReport(results) {
  const screenshotRows = results.flatMap((result) => [
    `| ${result.viewport} | office: printing + whiteboard + desk chat | \`${result.dynamicOffice.screenshot.path.replace(`${repositoryRoot}/`, "")}\` | ${result.dynamicOffice.screenshot.bytes} |`,
    `| ${result.viewport} | lounge: dining chat + sofa chat/rest | \`${result.dynamicLounge.screenshot.path.replace(`${repositoryRoot}/`, "")}\` | ${result.dynamicLounge.screenshot.bytes} |`,
  ]).join("\n");
  const contract = results[0].contracts;
  const report = `# Office V2 V${RELEASE_VERSION} Release QA\n\n`
    + `Date: 2026-07-21\n\n`
    + `Status: release code, local QA, and Pages sync are complete; push, online access, and live verification remain. The deploy marker is ${RELEASE_VERSION}.\n\n`
    + `## Automated Evidence\n\n`
    + `- Viewports: ${results.map(({ viewport }) => viewport).join(", ")} at deviceScaleFactor 2.\n`
    + `- Pixi: exactly one nonblank canvas per viewport; office and lounge each passed pixel variation and 2x backing checks, with the fallback absent.\n`
    + `- World: ${contract.deskCount} employee desks share \`${contract.deskAlias}\`; ${contract.crossDoorRouteEntries} cross-door route entries cover ${contract.crossDoorSceneIds.join(" and ")}.\n`
    + `- Activities: ${contract.activityCount} manifest entries and ${contract.activityVariantCount} prop variants checked; ${contract.visibleActivityVariantCount} variants require visible props and ${contract.propPlacementCount} prop sprites resolve onto existing furniture with zero generated furniture.\n`
    + `- Physical probes: desk visit, boss report, printer, whiteboard, dining chat, sofa TV, and two isolated simultaneous conversations passed; live screenshots exercise printing, whiteboard work, desk chat, dining chat, sofa chat/rest, and TV viewing.\n`
    + `- Motion: all viewports exposed live Canvas actor pixels at old and new positions, old-region clearing, continuous route samples, changing locomotion crop fingerprints, and alternating lower-body evidence.\n`
    + `- Overlays and records: five legal actor colliders per dynamic scene; bounded, mutually disjoint bubble/name/status stacks stay above heads and avoid actor bodies plus fixed furniture; long dialogue containment and strict conversation-only history passed.\n`
    + `- Runtime hygiene: zero console errors, page errors, failed images, and unexpected API requests.\n\n`
    + `## Screenshots\n\n| Viewport | Scene | File | Bytes |\n| --- | --- | --- | ---: |\n${screenshotRows}\n\n`
    + `## Release Boundary\n\nPackage, lockfile, visible version, worldbook cache markers, and the synchronized Pages deploy marker are ${RELEASE_VERSION}. This report does not claim live deployment until the controller pushes and completes the online checks.\n`;
  const reportPath = resolve(qaDirectory, "office-v2-release.md");
  await writeFile(reportPath, report, "utf8");
  return reportPath;
}

async function main() {
  let vite = null;
  let browser = null;
  let cleanupPromise = null;
  let signalReceived = "";
  const cleanup = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      if (browser) {
        const activeBrowser = browser;
        browser = null;
        await activeBrowser.close();
      }
      if (vite) {
        const activeVite = vite;
        vite = null;
        await stopVite(activeVite);
      }
    })();
    return cleanupPromise;
  };
  const onSignal = (signal) => {
    if (signalReceived) return;
    signalReceived = signal;
    void cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  };
  const onSigint = () => onSignal("SIGINT");
  const onSigterm = () => onSignal("SIGTERM");
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  try {
    await verifyReleaseFiles();
    await mkdir(qaDirectory, { recursive: true });
    const port = await reservePort();
    const appUrl = `http://${HOST}:${port}${BASE_PATH}`;
    vite = startVite(port);
    await waitForVite(vite, appUrl);
    browser = await chromium.launch({ handleSIGHUP: false, handleSIGINT: false, handleSIGTERM: false });
    const results = [];
    for (const viewport of OFFICE_RELEASE_VIEWPORTS) {
      results.push(await verifyViewport(browser, appUrl, viewport));
      console.log(`PASS ${labelViewport(viewport)}: Pixi, scenes, overlays, motion, records, and physical probes`);
    }
    const reportPath = await writeQaReport(results);
    console.log(`PASS release QA report: ${reportPath}`);
  } catch (error) {
    const viteOutput = vite?.getOutput();
    if (viteOutput) process.stderr.write(`\nVite output:\n${viteOutput}\n`);
    throw error;
  } finally {
    try {
      await cleanup();
    } finally {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
