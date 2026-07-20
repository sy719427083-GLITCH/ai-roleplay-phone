import { spawn } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  OFFICE_RELEASE_VIEWPORTS,
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
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  const unlock = page.getByRole("button", { name: "上划解锁", exact: true });
  if (await unlock.count() && await unlock.isVisible()) await unlock.click();
  await page.locator(".phone-surface").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "第 2 页", exact: true }).click();
  await page.getByRole("button", { name: "工作", exact: true }).click();
  await page.locator(".work-app-screen").waitFor({ state: "visible" });
  await page.locator('canvas[data-office-renderer="pixi"]').waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
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

async function getOverlayGeometry(page) {
  return page.evaluate(() => {
    const scene = document.querySelector(".office-scene");
    const sceneRect = scene?.getBoundingClientRect();
    const overlays = [...document.querySelectorAll("[data-office-actor-overlay]:not([hidden])")];
    const elementRect = (element, id) => {
      const rect = element.getBoundingClientRect();
      return { id, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    return {
      scene: sceneRect && { left: sceneRect.left, top: sceneRect.top, right: sceneRect.right, bottom: sceneRect.bottom },
      actorIds: overlays.map((element) => element.dataset.officeActorOverlay),
      labels: overlays.flatMap((element) => [
        element.querySelector(".office-actor-bubble"),
        element.querySelector(".office-actor-name"),
        element.querySelector(".office-actor-status"),
      ].filter(Boolean).map((child, index) => elementRect(child, `${element.dataset.officeActorOverlay}:${index}`))),
      positions: overlays.map((element) => ({
        id: element.dataset.officeActorOverlay,
        sceneId: "office",
        x: Number(element.dataset.worldX),
        y: Number(element.dataset.worldY),
      })),
      headByActor: Object.fromEntries(overlays.map((element) => [
        element.dataset.officeActorOverlay,
        sceneRect.top + Number(element.dataset.headScreenY),
      ])),
    };
  });
}

async function verifyOverlays(page, viewportLabel) {
  const geometry = await getOverlayGeometry(page);
  assert(geometry.actorIds.length === 5, `${viewportLabel}: expected five visible office overlays`);
  assert(new Set(geometry.actorIds).size === 5, `${viewportLabel}: duplicate actor overlay IDs`);
  assertDisjointRectangles(geometry.labels, geometry.scene);
  assert(geometry.labels.every((rectangle) => {
    const actorId = rectangle.id.split(":")[0];
    return rectangle.bottom <= geometry.headByActor[actorId] - 4;
  }), `${viewportLabel}: an overlay covers its actor instead of staying above the head`);
  const legality = await page.evaluate(async (positions) => {
    const moduleUrl = new URL("src/work/officePathfinding.js", location.href).href;
    const { isLegalCharacterPosition } = await import(moduleUrl);
    return positions.map((position) => ({ ...position, legal: isLegalCharacterPosition(position.sceneId, position) }));
  }, geometry.positions);
  assert(legality.every(({ legal }) => legal), `${viewportLabel}: at least one character collider is illegal`);
  const forbiddenDom = await page.locator(".work-app-screen").evaluate((element) => /rug|carpet/iu.test(element.innerHTML));
  assert(!forbiddenDom, `${viewportLabel}: forbidden floor-zone DOM found`);
  return { actorIds: geometry.actorIds, colliderCount: legality.length, overlayRectCount: geometry.labels.length };
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

async function verifySceneSwitch(page, viewportLabel) {
  const door = page.locator(".office-door-control");
  assert(await door.getAttribute("aria-label") === "进入休息区", `${viewportLabel}: office door label is incorrect`);
  const officeCanvas = await verifyCanvas(page, viewportLabel, "office");
  const officeScreenshot = await saveSceneScreenshot(page, viewportLabel, "office");
  await door.click();
  await page.locator('.office-door-control[data-scene="lounge"]').waitFor({ state: "visible" });
  assert(await door.getAttribute("aria-label") === "返回办公室", `${viewportLabel}: lounge door label is incorrect`);
  const focusedAfterEntering = await door.evaluate((element) => document.activeElement === element);
  assert(focusedAfterEntering, `${viewportLabel}: door focus was not restored after entering lounge`);
  assert(await page.locator('[data-office-actor-overlay]:visible').count() === 0, `${viewportLabel}: inactive office overlays remain visible in lounge`);
  const loungeCanvas = await verifyCanvas(page, viewportLabel, "lounge");
  const loungeScreenshot = await saveSceneScreenshot(page, viewportLabel, "lounge");
  await door.click();
  await page.locator('.office-door-control[data-scene="office"]').waitFor({ state: "visible" });
  assert(await door.getAttribute("aria-label") === "进入休息区", `${viewportLabel}: office door label was not restored`);
  assert(await door.evaluate((element) => document.activeElement === element), `${viewportLabel}: door focus was not restored after returning`);
  assert(await page.locator('[data-office-actor-overlay]:not([hidden])').count() === 5, `${viewportLabel}: office overlay state was not restored`);
  return { officeCanvas, loungeCanvas, officeScreenshot, loungeScreenshot };
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

async function verifyLiveLocomotion(page, viewportLabel) {
  const meeting = page.getByRole("button", { name: "开会", exact: true });
  assert(await meeting.isEnabled(), `${viewportLabel}: deterministic meeting action is unavailable`);
  await meeting.click();
  const actorId = "employee1";
  const actor = page.locator(`[data-office-actor-overlay="${actorId}"]`);
  await page.locator(`[data-office-actor-overlay="${actorId}"][data-moving="true"]`).waitFor({ state: "visible", timeout: 5_000 });
  const samples = [];
  for (let index = 0; index < 16; index += 1) {
    const sample = await actor.evaluate((element) => ({
      time: performance.now(),
      x: Number(element.dataset.worldX),
      y: Number(element.dataset.worldY),
      frame: Number(element.dataset.motionFrame),
      clip: element.dataset.motionClip,
      moving: element.dataset.moving,
    }));
    if (sample.moving !== "true") break;
    samples.push(sample);
    await delay(90);
  }
  assert(samples.length >= 8, `${viewportLabel}: walking actor arrived before enough live samples were captured`);
  assert(samples.every(({ clip, moving: isMoving }) => clip === "locomotion" && isMoving === "true"), `${viewportLabel}: live walking actor did not retain locomotion clip`);
  const positions = new Set(samples.map(({ x, y }) => `${x.toFixed(2)}:${y.toFixed(2)}`));
  const frames = new Set(samples.map(({ frame }) => frame));
  assert(positions.size >= 6, `${viewportLabel}: live route did not expose continuous position samples`);
  assert(frames.size >= 4, `${viewportLabel}: locomotion frames did not advance`);
  const distances = samples.slice(1).map((sample, index) => Math.hypot(sample.x - samples[index].x, sample.y - samples[index].y));
  const speeds = samples.slice(1).map((sample, index) => {
    const elapsedSeconds = Math.max(0.001, (sample.time - samples[index].time) / 1_000);
    return distances[index] / elapsedSeconds;
  });
  assert(
    speeds.every((speed) => speed >= 0 && speed <= 220),
    `${viewportLabel}: walking samples exceed physical route speed (${speeds.map((speed) => speed.toFixed(1)).join(", ")})`,
  );
  assert(distances.filter((distance) => distance > 0).length >= 6, `${viewportLabel}: walking samples contain too many stalls`);
  const assignment = QA_ASSIGNMENTS[actorId] || QA_ASSIGNMENTS.employee1;
  const legEvidence = await inspectLocomotionLegEvidence(page, assignment.chibiId);
  assert(legEvidence.frameCount === 8, `${viewportLabel}: locomotion strip must contain eight frames`);
  assert(legEvidence.uniqueSignatures >= 6, `${viewportLabel}: lower-body locomotion frames are not distinct`);
  assert(legEvidence.balanceRange > 10_000 && legEvidence.directionChanges >= 2, `${viewportLabel}: no alternating left/right leg evidence`);
  return { actorId, positionSamples: samples.length, distinctPositions: positions.size, distinctFrames: frames.size, legEvidence };
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
    ensure(probes.sofaTv.sceneId === "lounge" && probes.sofaTv.targetAnchors[0] === "tv:view", "sofa TV probe failed");

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
    for (const definition of manifestEntries) {
      for (const clipId of Object.values(definition.clips)) {
        ensure(clipModule.OFFICE_CLIP_METADATA[clipId]?.bodyOnly === true, `${definition.id}: invalid body-only clip ${clipId}`);
      }
      for (const templateAnchor of definition.targetAnchors) {
        const anchor = templateAnchor.startsWith("$actor:") ? `employee1:${templateAnchor.slice(7)}` : templateAnchor;
        ensure(sceneModule.getSceneAnchor(definition.sceneId, anchor), `${definition.id}: missing furniture anchor ${anchor}`);
      }
      const actorClip = definition.clips.actor || definition.clips.host;
      const anchorId = definition.targetAnchors[0].startsWith("$actor:")
        ? `employee1:${definition.targetAnchors[0].slice(7)}`
        : definition.targetAnchors[0];
      const propStates = sceneViewModule.getActivityPropStates([{
        slotId: definition.requiredActorIds?.[0] || "employee1",
        sceneId: definition.sceneId,
        activity: actorClip,
        anchorId,
      }]);
      for (const propState of propStates) {
        ensure(furnitureByScene[propState.sceneId]?.has(propState.objectId), `${definition.id}: prop is not attached to existing furniture`);
        ensure(propState.propIds.every((propId) => assetModule.OFFICE_ASSET_MANIFEST.props[propId]), `${definition.id}: missing prop asset`);
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
    const overlays = await verifyOverlays(page, viewportLabel);
    const conversations = await verifyConversationPanel(page, viewportLabel);
    const scenes = await verifySceneSwitch(page, viewportLabel);
    await openWork(page, appUrl);
    const locomotion = await verifyLiveLocomotion(page, viewportLabel);
    const contracts = await runDeterministicContractProbes(page);

    assert(diagnostics.consoleErrors.length === 0, `${viewportLabel}: console errors: ${diagnostics.consoleErrors.join(" | ")}`);
    assert(diagnostics.pageErrors.length === 0, `${viewportLabel}: page errors: ${diagnostics.pageErrors.join(" | ")}`);
    assert(diagnostics.failedImages.length === 0, `${viewportLabel}: failed images: ${diagnostics.failedImages.join(" | ")}`);
    assert(diagnostics.unexpectedRequests.length === 0, `${viewportLabel}: unexpected requests: ${diagnostics.unexpectedRequests.join(" | ")}`);
    return { viewport: viewportLabel, overlays, conversations, scenes, contracts, locomotion, diagnostics };
  } finally {
    await context.close();
  }
}

async function writeQaReport(results) {
  const screenshotRows = results.flatMap((result) => [
    `| ${result.viewport} | office | \`${result.scenes.officeScreenshot.path.replace(`${repositoryRoot}/`, "")}\` | ${result.scenes.officeScreenshot.bytes} |`,
    `| ${result.viewport} | lounge | \`${result.scenes.loungeScreenshot.path.replace(`${repositoryRoot}/`, "")}\` | ${result.scenes.loungeScreenshot.bytes} |`,
  ]).join("\n");
  const contract = results[0].contracts;
  const report = `# Office V2 V${RELEASE_VERSION} Release QA\n\n`
    + `Date: 2026-07-20\n\n`
    + `Status: release code and local QA ready; Pages sync, push, online access, and live verification were intentionally not run in this phase. The deploy marker will be written by the later sync step.\n\n`
    + `## Automated Evidence\n\n`
    + `- Viewports: ${results.map(({ viewport }) => viewport).join(", ")} at deviceScaleFactor 2.\n`
    + `- Pixi: exactly one nonblank canvas per viewport; office and lounge each passed pixel variation and 2x backing checks.\n`
    + `- World: ${contract.deskCount} employee desks share \`${contract.deskAlias}\`; ${contract.crossDoorRouteEntries} cross-door route entries cover ${contract.crossDoorSceneIds.join(" and ")}.\n`
    + `- Activities: ${contract.activityCount} manifest entries checked; ${contract.propPlacementCount} visible prop placements attach to existing furniture with no duplicated furniture.\n`
    + `- Physical probes: desk visit, boss report, printer, whiteboard, dining chat, sofa TV, and two isolated simultaneous conversations passed.\n`
    + `- Motion: all viewports exposed continuous live position samples, advancing locomotion frames, and alternating lower-body evidence.\n`
    + `- Overlays and records: five legal actor colliders; bounded, non-overlapping bubble/name/status stacks remain above their actor heads; long dialogue containment and strict conversation-only history passed.\n`
    + `- Runtime hygiene: zero console errors, page errors, failed images, and unexpected API requests.\n\n`
    + `## Screenshots\n\n| Viewport | Scene | File | Bytes |\n| --- | --- | --- | ---: |\n${screenshotRows}\n\n`
    + `## Release Boundary\n\nPackage, lockfile, visible version, and worldbook cache markers are ${RELEASE_VERSION}. This report does not claim deployment; the controller will run the final Pages sync and live checks after review.\n`;
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
