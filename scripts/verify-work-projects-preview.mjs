import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 4175;
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

function generatedPayload(batch) {
  return { projects: Array.from({ length: 5 }, (_, index) => ({
    name: `真实项目 ${batch}-${index + 1}`,
    duration: `${index + 3} 天`,
    amount: `¥${batch}${index + 1}00`,
    description: `由主 API 生成的第 ${batch} 批真实项目内容 ${index + 1}`,
    difficulty: ["简单", "中等", "困难"][index % 3],
  })) };
}

async function enterProjects(page, firstEntry = false) {
  if (firstEntry) {
    await page.goto(url);
    await page.getByRole("button", { name: "上划解锁" }).click();
    await page.getByRole("button", { name: "工作" }).click();
  }
  await page.getByRole("button", { name: "项目管理" }).click();
  await page.getByRole("heading", { name: "项目合同", level: 1 }).waitFor();
  await page.locator(".work-project-card:not(.work-project-skeleton)").first().waitFor();
  assert.equal(await page.locator(".work-project-card").count(), 5);
}

try {
  await waitForServer();
  await mkdir("artifacts/work-projects-preview", { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    let requestCount = 0;
    let successfulBatches = 0;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem("ccatWorkProjectsV1");
      localStorage.setItem("ccat-ai-api-configs", JSON.stringify({
        mainConfigs: [{ id: "qa-main", name: "QA 主 API", apiKey: "main-secret", baseUrl: "https://main.qa/v1", model: "main-model", temperature: 0.4 }],
        selectedMainId: "qa-main",
        secondaryConfigs: [{ id: "qa-secondary", name: "QA 副 API", apiKey: "secondary-secret", baseUrl: "https://secondary.qa/v1", model: "secondary-model", temperature: 0.3 }],
        selectedSecondaryId: "qa-secondary",
        mainDraft: {}, secondaryDraft: {}, secondaryEnabled: true,
      }));
    });
    await page.route("**/v1/chat/completions", async (route) => {
      requestCount += 1;
      if (route.request().url().includes("secondary.qa")) {
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
        return;
      }
      successfulBatches += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify(generatedPayload(successfulBatches)) } }],
      }) });
    });

    await enterProjects(page, true);
    assert.equal(requestCount, 2, "first entry tries secondary then main");
    await page.locator(".work-projects-summary div span").filter({ hasText: "主 API 生成" }).waitFor();
    await page.getByRole("button", { name: "返回工作室" }).click();
    await enterProjects(page);
    assert.equal(requestCount, 2, "re-entry uses cached contracts");

    const refreshButton = page.locator(".work-projects-refresh");
    const previousTitle = await page.locator(".work-contract-heading h2").first().textContent();
    await refreshButton.click();
    assert.equal(await page.locator(".work-project-card:not(.work-project-skeleton)").count(), 5, "old contracts remain visible while refreshing");
    await page.locator(".work-contract-heading h2").first().filter({ hasNotText: previousTitle }).waitFor();
    assert.equal(requestCount, 4, "refresh tries secondary then main again");

    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.screenshot({ path: `artifacts/work-projects-preview/projects-ready-${viewport.width}x${viewport.height}.png`, fullPage: true });

    await page.locator(".work-project-start").first().click();
    await page.getByText("合同已生效，本批合同已锁定", { exact: true }).waitFor();
    assert.equal(await refreshButton.isDisabled(), true);
    assert.equal(await page.locator(".work-project-start:disabled").count(), 5);
    assert.equal(await page.locator(".work-project-card.is-muted").count(), 4);
    assert.equal(await page.locator(".work-contract-seal").count(), 1);
    await page.getByRole("button", { name: "返回工作室" }).click();
    await enterProjects(page);
    assert.equal(requestCount, 4, "signed re-entry remains cached and makes no API call");
    assert.equal(await page.locator(".work-projects-refresh").isDisabled(), true, "signed cache remains locked");
    await page.screenshot({ path: `artifacts/work-projects-preview/projects-signed-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();
  console.log("Real API work contract QA passed for 375x812 and 390x844");
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* Server already stopped. */ }
}
