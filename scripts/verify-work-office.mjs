import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const url = `${origin}/ai-roleplay-phone/`;
const server = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], { stdio: "ignore" });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vite server did not start");
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
    const before = await page.locator(".office-character").evaluate((element) => ({ left: getComputedStyle(element).left, top: getComputedStyle(element).top }));
    await page.getByRole("button", { name: "茶水吧台" }).click();
    await page.waitForTimeout(1800);
    const after = await page.locator(".office-character").evaluate((element) => ({ left: getComputedStyle(element).left, top: getComputedStyle(element).top }));
    assert.notDeepEqual(after, before);
    await page.getByRole("button", { name: "员工桌 6" }).click();
    await page.waitForTimeout(1800);
    const atEmployeeSix = await page.locator(".office-character").evaluate((element) => ({ left: getComputedStyle(element).left, top: getComputedStyle(element).top }));
    assert.notDeepEqual(atEmployeeSix, after);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(50);
    await page.screenshot({ path: `artifacts/work-office-qa/office-${viewport.width}x${viewport.height}.png`, fullPage: true });
    for (const [name, title] of [["项目管理", "项目管理"], ["工作倒计时", "工作倒计时"]]) {
      await page.getByRole("button", { name }).click();
      await page.getByRole("heading", { name: title, level: 1 }).waitFor();
      await page.getByText("暂时留空", { exact: true }).waitFor();
      await page.getByRole("button", { name: "返回办公室" }).click();
    }
    await page.getByRole("button", { name: "工作设置" }).click();
    await page.getByText("暂时留空", { exact: true }).waitFor();
    await context.close();
  }
  await browser.close();
  console.log("Work office browser QA passed for 375x812 and 390x844");
} finally {
  server.kill("SIGTERM");
}
