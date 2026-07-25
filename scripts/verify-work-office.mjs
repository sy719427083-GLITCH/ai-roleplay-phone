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

async function readCharacterAnchor(page) {
  return page.locator(".office-character").evaluate((element) => {
    const scene = element.closest(".office-scene").getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      x: scene.left + Number.parseFloat(styles.left),
      y: scene.top + Number.parseFloat(styles.top),
      moving: element.classList.contains("is-moving"),
    };
  });
}

async function walkWithoutCrossingFurniture(page, destination, allowedLabels) {
  const furniture = await readVisibleFurniture(page);
  const startedAt = Date.now();
  let observedSlowMovement = false;
  await page.getByRole("button", { name: destination }).click();
  await page.locator(".office-character.is-moving").waitFor();

  while (Date.now() - startedAt < 25000) {
    const anchor = await readCharacterAnchor(page);
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
      localStorage.setItem("apiCharacters", JSON.stringify({ qaRole: { name: "测试角色", type: "main", avatar: "" } }));
      localStorage.removeItem("ccatWorkOfficeV1");
    });
    await page.goto(url);
    await page.getByRole("button", { name: "上划解锁" }).click();
    await page.getByRole("button", { name: "工作" }).click();
    assert.equal(await page.locator(".work-bottom-nav button").count(), 3);
    assert.equal(await page.locator(".office-character").count(), 0);
    assert.equal(await page.locator(".office-object").count(), 8);
    assert.equal(await page.locator(".office-object > img.office-object-art").count(), 8);
    assert.equal(await page.locator(".office-object > img.office-object-art").evaluateAll(
      (images) => images.every((image) => image.complete && image.naturalWidth > 0),
    ), true);
    assert.equal(await page.locator(".office-door-arrow").count(), 0);
    assert.equal(await page.locator(".office-object.door").count(), 0);
    assert.equal(await page.locator(".office-object.desk").count(), 7);
    await page.getByRole("button", { name: "老板桌" }).click();
    await page.getByRole("status").filter({ hasText: "请先在员工管理中安排" }).waitFor();
    await page.getByRole("button", { name: "员工管理" }).click();
    const selects = page.locator(".employee-slot select");
    assert.equal(await selects.count(), 7);
    await selects.nth(0).selectOption({ label: "我 APP · 测试我" });
    assert.deepEqual(await selects.evaluateAll((items) => items.map((item) => item.options.length)), [3, 2, 2, 2, 2, 2, 2]);
    await page.getByRole("button", { name: "返回办公室" }).click();
    assert.equal(await page.locator(".office-character").count(), 1);
    const [avatarBodyBox, bossDeskBox] = await Promise.all([
      page.locator(".office-character-body").boundingBox(),
      page.locator(".office-object.desk.boss").boundingBox(),
    ]);
    const bossDeskVisibleTop = bossDeskBox.y + (bossDeskBox.height * 67 / 480);
    assert.ok(avatarBodyBox.y + avatarBodyBox.height <= bossDeskVisibleTop, "boss avatar remains visible behind the desk art");
    const before = await readCharacterAnchor(page);
    const atEmployeeSix = await walkWithoutCrossingFurniture(page, "员工桌 6", ["老板桌", "员工桌 6"]);
    assert.notDeepEqual({ x: atEmployeeSix.x, y: atEmployeeSix.y }, { x: before.x, y: before.y });
    const atTea = await walkWithoutCrossingFurniture(page, "茶水吧台", ["员工桌 6", "茶水吧台"]);
    assert.notDeepEqual({ x: atTea.x, y: atTea.y }, { x: atEmployeeSix.x, y: atEmployeeSix.y });
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(50);
    await page.screenshot({ path: `artifacts/work-office-qa/office-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await page.getByRole("button", { name: "项目管理" }).click();
    await page.getByRole("heading", { name: "项目管理", level: 1 }).waitFor();
    assert.equal(await page.locator(".work-project-card").count(), 5);
    await page.getByRole("button", { name: "刷新项目" }).waitFor();
    await page.getByRole("button", { name: "返回工作室" }).click();
    await page.getByRole("button", { name: "工作倒计时" }).click();
    await page.getByRole("heading", { name: "工作倒计时", level: 1 }).waitFor();
    await page.getByText("暂时留空", { exact: true }).waitFor();
    await page.getByRole("button", { name: "返回办公室" }).click();
    await page.getByRole("button", { name: "工作设置" }).click();
    await page.getByText("暂时留空", { exact: true }).waitFor();
    await context.close();
  }
  await browser.close();
  console.log("Work office browser QA passed for 375x812 and 390x844");
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* server already stopped */ }
}
