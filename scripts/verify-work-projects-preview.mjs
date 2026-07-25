import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 4175;
const origin = `http://127.0.0.1:${port}`;
const url = `${origin}/ai-roleplay-phone/`;
const server = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
  stdio: "ignore",
  detached: true,
});
server.unref();

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vite server did not start");
}

async function openProjects(page) {
  await page.goto(url);
  await page.getByRole("button", { name: "上划解锁" }).click();
  await page.getByRole("button", { name: "工作" }).click();
  await page.getByRole("button", { name: "项目管理" }).click();
  await page.getByText("WORK BOARD", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "今日项目", level: 1 }).waitFor();
  assert.equal(await page.locator(".work-project-card").count(), 5, "project page shows five project cards");
  assert.equal(await page.locator(".work-project-price").count(), 5, "every project gives amount editorial emphasis");
  assert.equal(await page.locator(".work-project-ticket-meta").count(), 5, "every project renders ticket metadata");
}

try {
  await waitForServer();
  await mkdir("artifacts/work-projects-preview", { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await openProjects(page);

    const refreshButton = page.locator(".work-projects-refresh");
    assert.equal(await refreshButton.isDisabled(), false, "refresh is enabled before starting a project");
    await refreshButton.click();
    const skeletonList = page.locator('.work-projects-list[aria-busy="true"]');
    await skeletonList.waitFor();
    assert.equal(await skeletonList.locator(".work-project-skeleton").count(), 5, "refresh shows five skeleton cards");
    await skeletonList.waitFor({ state: "detached" });
    await page.locator(".work-project-card:not(.work-project-skeleton)").first().waitFor();
    assert.equal(await page.locator(".work-project-card").count(), 5, "refresh returns five project cards");

    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(50);
    await page.screenshot({
      path: `artifacts/work-projects-preview/projects-ready-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });

    const firstStartButton = page.locator(".work-project-start").first();
    await firstStartButton.click();
    await page.getByText("项目进行中，今日列表已锁定", { exact: true }).waitFor();
    assert.equal(await refreshButton.isDisabled(), true, "refresh locks after a project starts");
    assert.equal(await firstStartButton.locator("span").first().textContent(), "项目进行中");
    assert.equal(await page.locator(".work-project-start:disabled").count(), 5, "all start buttons lock after selection");
    assert.equal(await page.locator(".work-project-card.is-muted").count(), 4, "unselected projects de-emphasize after selection");

    await page.screenshot({
      path: `artifacts/work-projects-preview/projects-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    await context.close();
  }

  await browser.close();
  console.log("Work projects preview QA passed for 375x812 and 390x844");
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // Server already stopped.
  }
}
