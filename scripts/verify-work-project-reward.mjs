import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = 4176;
const origin = `http://127.0.0.1:${port}`;
const url = `${origin}/ai-roleplay-phone/`;
const server = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], { stdio: "ignore", detached: true });
server.unref();

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* Vite is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vite server did not start");
}

function apiProjects() {
  return Array.from({ length: 5 }, (_, index) => ({
    name: `新项目 ${index + 1}`,
    durationHours: (index + 2) * 24,
    amountValue: (index + 2) * 900,
    description: `领取报酬后生成的新项目内容 ${index + 1}`,
    difficulty: ["简单", "中等", "困难"][index % 3],
  }));
}

async function unlockAndOpenWork(page) {
  await page.getByRole("button", { name: "上划解锁" }).click();
  await page.getByRole("button", { name: "工作" }).click();
}

try {
  await waitForServer();
  await mkdir("artifacts/work-project-reward", { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    let projectRequests = 0;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.addInitScript(() => {
      if (localStorage.getItem("qaWorkRewardSeeded")) return;
      const startedAt = new Date(Date.now()).toISOString();
      const endsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const projects = Array.from({ length: 5 }, (_, index) => ({
        id: `reward-${index + 1}`,
        name: index === 0 ? "品牌视觉升级" : `候选合同 ${index + 1}`,
        durationHours: index === 0 ? 72 : (index + 3) * 24,
        amountValue: index === 0 ? 2100 : (index + 1) * 1000,
        duration: index === 0 ? "3 天" : `${index + 3} 天`,
        amount: index === 0 ? "¥2,100" : `¥${(index + 1) * 1000}`,
        description: `项目倒计时浏览器测试合同 ${index + 1}`,
        difficulty: ["简单", "中等", "困难"][index % 3],
      }));
      localStorage.setItem("ccatWorkProjectsV1", JSON.stringify({
        projects, startedProjectId: projects[0].id, startedAt, endsAt,
        revision: 1, source: "main", generatedAt: startedAt,
      }));
      localStorage.setItem("roleplayWallet", JSON.stringify({ balance: 100, transactions: [] }));
      localStorage.setItem("ccat-ai-api-configs", JSON.stringify({
        mainConfigs: [{ id: "qa-main", name: "QA 主 API", apiKey: "main-secret", baseUrl: "https://main.qa/v1", model: "main-model", temperature: 0.4 }],
        selectedMainId: "qa-main", secondaryConfigs: [], selectedSecondaryId: "",
        mainDraft: {}, secondaryDraft: {}, secondaryEnabled: false,
      }));
      localStorage.setItem("qaWorkRewardSeeded", "1");
    });
    await page.route("**/v1/chat/completions", async (route) => {
      projectRequests += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ projects: apiProjects() }) } }],
      }) });
    });

    await page.goto(url);
    await unlockAndOpenWork(page);
    const runningClock = page.locator(".work-timer-nav .nav-timer strong");
    await runningClock.filter({ hasText: /^71:59:/ }).waitFor();
    const firstRunningValue = await runningClock.textContent();

    await page.reload();
    await unlockAndOpenWork(page);
    await runningClock.filter({ hasText: /^71:59:/ }).waitFor();
    assert.notEqual(await runningClock.textContent(), "72:00:00", "reload derives remaining time instead of resetting it");
    assert.ok(firstRunningValue >= await runningClock.textContent(), "countdown does not move backwards after reload");

    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("ccatWorkProjectsV1"));
      state.startedAt = new Date(Date.now() - 72 * 60 * 60 * 1000 - 2000).toISOString();
      state.endsAt = new Date(Date.now() - 2000).toISOString();
      localStorage.setItem("ccatWorkProjectsV1", JSON.stringify(state));
    });
    await page.reload();
    await unlockAndOpenWork(page);
    await page.getByText("工作结束", { exact: true }).waitFor();
    assert.equal(await runningClock.textContent(), "00:00:00");
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.screenshot({ path: `artifacts/work-project-reward/reward-finished-${viewport.width}x${viewport.height}.png`, fullPage: true });

    await page.getByRole("button", { name: "项目倒计时" }).click();
    await page.getByRole("heading", { name: "项目倒计时", level: 1 }).waitFor();
    await page.getByText("品牌视觉升级", { exact: true }).waitFor();
    await page.screenshot({ path: `artifacts/work-project-reward/reward-detail-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await page.getByRole("button", { name: "点击领取报酬" }).click();
    await page.getByText("暂无进行中的项目", { exact: true }).waitFor();
    await page.screenshot({ path: `artifacts/work-project-reward/reward-claimed-${viewport.width}x${viewport.height}.png`, fullPage: true });

    const walletAfterClaim = await page.evaluate(() => JSON.parse(localStorage.getItem("roleplayWallet")));
    assert.equal(walletAfterClaim.balance, 2200);
    assert.equal(walletAfterClaim.transactions.length, 1);
    assert.equal(walletAfterClaim.transactions[0].desc, "项目报酬 · 品牌视觉升级");

    await page.getByRole("button", { name: "返回办公室" }).click();
    await page.getByRole("button", { name: "返回主页" }).click();
    await page.getByRole("button", { name: "钱包" }).click();
    await page.locator(".card-balance span").nth(1).filter({ hasText: "2,200.00" }).waitFor();
    assert.equal(await page.locator(".tx-item").count(), 1);
    await page.getByRole("button", { name: "返回" }).click();

    await page.getByRole("button", { name: "工作" }).click();
    await page.getByRole("button", { name: "项目管理" }).click();
    await page.locator(".work-project-card:not(.work-project-skeleton)").first().waitFor();
    assert.equal(projectRequests, 1, "claim clears the batch and next entry generates five new contracts");
    assert.equal(await page.locator(".work-project-card").count(), 5);
    const walletAfterNewBatch = await page.evaluate(() => JSON.parse(localStorage.getItem("roleplayWallet")));
    assert.equal(walletAfterNewBatch.balance, 2200);
    assert.equal(walletAfterNewBatch.transactions.length, 1, "reopening work does not duplicate the reward");
    await context.close();
  }

  await browser.close();
  console.log("Work project countdown reward QA passed for 375x812 and 390x844");
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* Server already stopped. */ }
}
