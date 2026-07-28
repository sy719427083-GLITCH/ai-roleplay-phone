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
    await page.addInitScript(() => {
      localStorage.setItem("apiMeProfiles", JSON.stringify({ qaMe: { name: "测试我", avatar: "" } }));
      localStorage.setItem("apiCharacters", JSON.stringify(Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`qa${index + 1}`, { name: `测试角色${index + 1}`, type: index > 3 ? "npc" : "main", personality: index % 2 ? "开朗健谈，喜欢游戏" : "认真负责，擅长报表", persona: index === 4 ? "喜欢刷抖音" : "办公室同事", avatar: "" }]))));
      localStorage.setItem("ccatWorkCompanyV1", JSON.stringify({ version: 1, prefix: "测试", fullName: "测试有限公司", createdAt: "2026-07-28T00:00:00.000Z" }));
      localStorage.setItem("ccatWorkOfficeV1", JSON.stringify({ version: 2, assignments: { boss: "me:qaMe", employee1: "character:qa1", employee2: "character:qa2", employee3: "character:qa3", employee4: "character:qa4", employee5: "character:qa5", employee6: "character:qa6" }, avatarOverrides: {}, meWaypoint: "boss-home", simulation: { mode: "local", plan: null } }));
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
    const atEmployeeSix = await walkWithoutCrossingFurniture(page, meCharacter, "员工桌 6", ["老板桌", "员工桌 6"]);
    assert.notDeepEqual({ x: atEmployeeSix.x, y: atEmployeeSix.y }, { x: before.x, y: before.y });
    const atTea = await walkWithoutCrossingFurniture(page, meCharacter, "智能打印资料区", ["员工桌 6", "智能打印资料区"]);
    assert.notDeepEqual({ x: atTea.x, y: atTea.y }, { x: atEmployeeSix.x, y: atEmployeeSix.y });
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
    await page.getByRole("radio", { name: /B AI 导演/ }).click();
    await page.getByRole("button", { name: "返回办公室" }).click();
    await page.getByText("AI 导演暂不可用，已使用本地调度", { exact: true }).waitFor();
    await context.close();
  }
  await browser.close();
  console.log("Work office browser QA passed for 375x812 and 390x844");
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* server already stopped */ }
}
