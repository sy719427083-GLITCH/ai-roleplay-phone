import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const url = `${origin}/ai-roleplay-phone/`;
const server = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], { stdio: "ignore", detached: true });
server.unref();

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vite server did not start");
}

const alphaBounds = {
  boss: [41 / 720, 67 / 480, 676 / 720, 405 / 480],
  employee: [55 / 520, 41 / 360, 449 / 520, 303 / 360],
  tea: [79 / 900, 9 / 520, 820 / 900, 505 / 520],
};

async function readVisibleFurniture(page) {
  return page.locator(".office-object").evaluateAll((elements, bounds) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const kind = element.classList.contains("boss") ? "boss" : element.classList.contains("tea") ? "tea" : "employee";
    const alpha = bounds[kind];
    return {
      label: element.getAttribute("aria-label"),
      left: box.left + box.width * alpha[0],
      top: box.top + box.height * alpha[1],
      right: box.left + box.width * alpha[2],
      bottom: box.top + box.height * alpha[3],
    };
  }), alphaBounds);
}

async function readCharacterAnchor(character) {
  return character.evaluate((element) => {
    const scene = element.closest(".office-scene").getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      x: scene.left + Number.parseFloat(styles.left),
      y: scene.top + Number.parseFloat(styles.top),
      moving: element.classList.contains("is-moving"),
    };
  });
}

async function walkWithoutCrossingFurniture(page, character, destination, allowedLabels) {
  const furniture = await readVisibleFurniture(page);
  const startedAt = Date.now();
  let observedSlowMovement = false;
  await page.getByRole("button", { name: destination }).click();
  const profileId = await character.getAttribute("data-profile-id");
  await page.waitForFunction((id) => document.querySelector(`.office-character[data-profile-id="${id}"]`)?.classList.contains("is-moving"), profileId);

  while (Date.now() - startedAt < 25000) {
    const anchor = await readCharacterAnchor(character);
    const elapsed = Date.now() - startedAt;
    if (anchor.moving && elapsed > 500) observedSlowMovement = true;
    const collision = furniture.find((item) => (
      !allowedLabels.includes(item.label)
      && anchor.x > item.left
      && anchor.x < item.right
      && anchor.y > item.top
      && anchor.y < item.bottom
    ));
    assert.equal(collision, undefined, `${destination} route anchor avoids ${collision?.label || "furniture"}`);
    if (!anchor.moving) {
      assert.equal(observedSlowMovement, true, `${destination} movement lasts beyond the former 430ms step`);
      return anchor;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${destination} route did not finish within 25 seconds`);
}

try {
  await waitForServer();
  await mkdir("artifacts/work-office-qa", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    let aiRequestMode = "success";
    let testedProfileIds = [];
    await page.route("https://qa.example/v1/chat/completions", async (route) => {
      if (aiRequestMode === "failure") return route.abort("failed");
      const requestBody = route.request().postDataJSON();
      const prompt = JSON.parse(requestBody.messages[1].content);
      if (Array.isArray(prompt.participants)) {
        const turns = prompt.participants.slice(0, 2).map((profile, index) => ({ speakerId: profile.id, text: index ? "我来补充细节。" : "我们确认一下进度。" }));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ turns }) } }] }) });
      }
      testedProfileIds = prompt.profiles.map((profile) => profile.id);
      const characters = Object.fromEntries(prompt.profiles.map((profile) => [profile.id, {
        activity: "working", label: "工作中", destination: "boss-home", startsAt: prompt.startsAt, endsAt: prompt.endsAt,
      }]));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ id: "qa-ai-scene", startsAt: prompt.startsAt, endsAt: prompt.endsAt, characters, conversation: null }) } }] }),
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem("apiMeProfiles", JSON.stringify({ qaMe: { name: "测试我", avatar: "" } }));
      localStorage.setItem("apiCharacters", JSON.stringify(Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`qa${index + 1}`, { name: `测试角色${index + 1}`, type: index > 3 ? "npc" : "main", personality: index % 2 ? "开朗健谈，喜欢游戏" : "认真负责，擅长报表", persona: index === 4 ? "喜欢刷抖音" : "办公室同事", avatar: "" }]))));
      localStorage.setItem("ccatWorkCompanyV1", JSON.stringify({ version: 1, prefix: "测试", fullName: "测试有限公司", createdAt: "2026-07-28T00:00:00.000Z" }));
      const qaEndpoint = { id: "qa-main", name: "QA 主 API", apiKey: "qa-key", baseUrl: "https://qa.example/v1", model: "qa-model", customModel: "", temperature: 0.7 };
      localStorage.setItem("ccat-ai-api-configs", JSON.stringify({ mainConfigs: [qaEndpoint], selectedMainId: qaEndpoint.id, mainDraft: qaEndpoint, secondaryConfigs: [], selectedSecondaryId: "", secondaryDraft: {}, secondaryEnabled: false }));
      if (!localStorage.getItem("ccatWorkOfficeV1")) {
        localStorage.setItem("ccatWorkOfficeV1", JSON.stringify({ version: 2, assignments: { boss: "me:qaMe", employee1: "character:qa1", employee2: "character:qa2", employee3: "character:qa3", employee4: "character:qa4", employee5: "character:qa5", employee6: "character:qa6" }, avatarOverrides: {}, meWaypoint: "boss-home", simulation: { mode: "local", plan: null } }));
      }
      localStorage.setItem("ccatWorkProjectsV1", JSON.stringify({
        projects: Array.from({ length: 5 }, (_, index) => ({
          id: `qa-${index + 1}`,
          name: `已缓存项目 ${index + 1}`,
          durationHours: (index + 2) * 24,
          amountValue: (index + 1) * 1000,
          duration: `${index + 2} 天`,
          amount: `¥${(index + 1) * 1000}`,
          description: `办公室浏览器测试合同 ${index + 1}`,
          difficulty: ["简单", "中等", "困难"][index % 3],
        })),
        startedProjectId: null,
        revision: 1,
        source: "main",
        generatedAt: "2026-07-25T00:00:00.000Z",
      }));
    });
    await page.goto(url);
    await page.getByRole("button", { name: "上划解锁" }).click();
    await page.getByRole("button", { name: "工作" }).click();
    assert.equal(await page.locator(".work-bottom-nav button").count(), 3);
    await page.locator(".office-character").first().waitFor();
    assert.equal(await page.locator(".office-character").count(), 7);
    assert.equal(await page.locator(".office-character-activity").count(), 7);
    assert.equal(await page.locator(".office-object").count(), 8);
    assert.equal(await page.locator(".office-object > img.office-object-art").count(), 8);
    assert.equal(await page.locator(".office-object > img.office-object-art").evaluateAll(
      (images) => images.every((image) => image.complete && image.naturalWidth > 0),
    ), true);
    assert.equal(await page.locator(".office-door-arrow").count(), 0);
    assert.equal(await page.locator(".office-object.door").count(), 0);
    assert.equal(await page.locator(".office-object.desk").count(), 7);
    await page.getByRole("button", { name: "员工管理" }).click();
    const selects = page.locator(".employee-slot select");
    assert.equal(await selects.count(), 7);
    await page.getByRole("button", { name: "返回办公室" }).click();
    assert.equal(await page.locator(".office-character").count(), 7);
    const meCharacter = page.locator('.office-character[data-profile-id="me:qaMe"]');
    const [avatarBodyBox, bossDeskBox] = await Promise.all([
      meCharacter.locator(".office-character-body").boundingBox(),
      page.locator(".office-object.desk.boss").boundingBox(),
    ]);
    const bossDeskVisibleTop = bossDeskBox.y + (bossDeskBox.height * 67 / 480);
    assert.ok(avatarBodyBox.y + avatarBodyBox.height <= bossDeskVisibleTop, "boss avatar remains visible behind the desk art");
    const before = await readCharacterAnchor(meCharacter);
    await page.getByRole("button", { name: "员工桌 6" }).click();
    await page.waitForTimeout(1200);
    const afterManualClick = await readCharacterAnchor(meCharacter);
    assert.notDeepEqual({ x: afterManualClick.x, y: afterManualClick.y }, { x: before.x, y: before.y }, "manual click starts movement before autonomy resumes");
    await page.getByRole("button", { name: "老板桌" }).click();
    await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem("ccatWorkOfficeV1")).simulation.manualMe));
    const firstManualEndsAt = await page.evaluate(() => JSON.parse(localStorage.getItem("ccatWorkOfficeV1")).simulation.manualMe.endsAt);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "员工桌 1" }).click();
    await page.waitForFunction((endsAt) => JSON.parse(localStorage.getItem("ccatWorkOfficeV1")).simulation.manualMe?.endsAt > endsAt, firstManualEndsAt);
    const secondManualEndsAt = await page.evaluate(() => JSON.parse(localStorage.getItem("ccatWorkOfficeV1")).simulation.manualMe.endsAt);
    assert.ok(secondManualEndsAt >= firstManualEndsAt + 900, "latest furniture click resets the full ten-second window");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("ccatWorkOfficeV1")).simulation.manualMe === null, null, { timeout: 15000 });
    assert.doesNotMatch(await meCharacter.locator(".office-character-activity").innerText(), /前往指定位置/);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(50);
    await page.screenshot({ path: `artifacts/work-office-qa/office-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await page.getByRole("button", { name: "项目管理" }).click();
    await page.getByRole("heading", { name: "项目合同", level: 1 }).waitFor();
    assert.equal(await page.locator(".work-project-card").count(), 5);
    await page.getByRole("button", { name: "换一批合同" }).waitFor();
    await page.getByRole("button", { name: "返回工作室" }).click();
    await page.getByRole("button", { name: "项目倒计时" }).click();
    await page.getByRole("heading", { name: "项目倒计时", level: 1 }).waitFor();
    await page.getByText("暂无进行中的项目", { exact: true }).waitFor();
    await page.getByRole("button", { name: "返回办公室" }).click();
    await page.getByRole("button", { name: "工作设置" }).click();
    await page.getByRole("radiogroup", { name: "自主行为模式" }).waitFor();
    const localMode = page.getByRole("radio", { name: /A 本地调度/ });
    assert.equal(await localMode.getAttribute("aria-checked"), "true");
    testedProfileIds = [];
    await page.getByRole("button", { name: "测试 AI 导演" }).click();
    await page.getByRole("status").filter({ hasText: "AI 导演连接成功，可以使用。" }).waitFor();
    assert.deepEqual(testedProfileIds.sort(), ["me:qaMe", ...Array.from({ length: 6 }, (_, index) => `character:qa${index + 1}`)].sort(), "AI test sends every current occupant");
    assert.equal(await localMode.getAttribute("aria-checked"), "true", "AI test does not change the selected behavior mode");
    aiRequestMode = "failure";
    await page.getByRole("radio", { name: /B AI 导演/ }).click();
    await page.getByRole("button", { name: "返回办公室" }).click();
    await page.getByText("AI 导演暂不可用：网络请求失败，请检查接口地址、跨域设置或网络状态。已使用本地调度", { exact: true }).waitFor();
    await page.evaluate(() => {
      const office = JSON.parse(localStorage.getItem("ccatWorkOfficeV1"));
      office.assignments = { boss: "me:qaMe", employee1: null, employee2: null, employee3: null, employee4: null, employee5: null, employee6: null };
      office.simulation = { ...office.simulation, mode: "local", intervalKey: "", plan: null, conversationCache: { participantIds: ["me:qaMe"], turns: [{ speakerId: "me:qaMe", text: "我一个人说话" }] }, manualMe: null };
      localStorage.setItem("ccatWorkOfficeV1", JSON.stringify(office));
      location.href = "about:blank";
    });
    await page.waitForURL("about:blank");
    await page.goto(url);
    await page.getByRole("button", { name: "上划解锁" }).click();
    await page.getByRole("button", { name: "工作" }).click();
    await page.locator(".office-character").first().waitFor();
    assert.equal(await page.locator(".office-character").count(), 1);
    await page.waitForTimeout(7000);
    assert.equal(await page.locator(".office-character-bubble").count(), 0, "one-person office never displays a chat bubble");
    await context.close();
  }
  await browser.close();
  console.log("Work office browser QA passed for 375x812 and 390x844");
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* server already stopped */ }
}
