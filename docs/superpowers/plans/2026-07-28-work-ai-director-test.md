# 工作 APP AI 导演测试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作设置中增加一次真实的主 API AI 导演测试，并让手动测试和自动回退都显示明确的成功或失败原因。

**Architecture:** `officeConversation.js` 负责按办公室真实协议测试当前主 API，并把底层异常规范化为中文错误；`WorkSettings.jsx` 只管理按钮、加载状态和结果展示；`WorkAppScreen.jsx` 负责读取共享 API 配置并注入测试回调。自动 AI 调度复用同一错误格式化函数，不再吞掉异常。

**Tech Stack:** React 19、Vite、Node.js `node:test`、Playwright、GitHub Pages

## Global Constraints

- 只测试当前选中的主 API，不测试或启用副 API。
- 使用 `/chat/completions`、当前模型和 12 秒超时，并校验办公室场景 JSON。
- 测试按钮不切换 A/B 模式、不修改办公室计划、不移动人物。
- 成功文案固定为“AI 导演连接成功，可以使用。”
- 自动回退文案格式固定为“AI 导演暂不可用：具体原因。已使用本地调度”。
- 保留本地调度、项目管理、10 秒恢复自主行动以及至少两人聊天规则。

---

### Task 1: 主 API 真实测试与错误分类

**Files:**
- Modify: `src/work/officeConversation.js`
- Modify: `src/work/officeConversation.test.js`

**Interfaces:**
- Consumes: `generateAiOfficePlan({ apiState, context, fetchImpl })`
- Produces: `testOfficeAiDirector({ apiState, fetchImpl?, now? }): Promise<{ source: "main", model: string }>`
- Produces: `formatOfficeAiError(error): string`

- [ ] **Step 1: 写入失败测试**

在 `src/work/officeConversation.test.js` 导入两个新接口，并添加：

```js
test("tests the selected main endpoint with the real office scene contract", async () => {
  const calls = [];
  const result = await testOfficeAiDirector({
    apiState,
    now: 1_000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        id: "test-plan",
        startsAt: 1_000,
        endsAt: 901_000,
        characters: { "office-api-test": { activity: "working", label: "工作中", destination: "boss-home", startsAt: 1_000, endsAt: 901_000 } },
        conversation: null,
      }) } }] }) };
    },
  });
  assert.deepEqual(result, { source: "main", model: "model" });
  assert.equal(calls[0].url, "https://example.com/v1/chat/completions");
});

test("reports missing main fields before requesting", async () => {
  await assert.rejects(
    testOfficeAiDirector({ apiState: { ...apiState, mainConfigs: [{ ...apiState.mainConfigs[0], model: "" }], mainDraft: {} }, fetchImpl: async () => assert.fail("must not request") }),
    /主 API 未选择模型/,
  );
});

test("formats office API failures for people", () => {
  assert.equal(formatOfficeAiError(new Error("请求失败（401）")), "API Key 无效或没有访问权限");
  assert.equal(formatOfficeAiError(new Error("请求失败（404）")), "接口地址不兼容，请检查 Base URL");
  assert.equal(formatOfficeAiError(new Error("请求失败（429）")), "请求过于频繁或额度不足");
  assert.equal(formatOfficeAiError(new DOMException("timeout", "TimeoutError")), "请求超时，请检查网络或接口速度");
  assert.equal(formatOfficeAiError(new Error("Invalid AI scene plan: plan")), "API 返回的办公室场景格式不正确");
});
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run: `node --test src/work/officeConversation.test.js`

Expected: FAIL，提示 `testOfficeAiDirector` 或 `formatOfficeAiError` 未导出。

- [ ] **Step 3: 实现最小主 API 测试**

在 `src/work/officeConversation.js` 增加主配置解析、字段校验、严格场景提示和测试入口：

```js
function selectedMainEndpoint(apiState) {
  return apiState.mainConfigs?.find((item) => item.id === apiState.selectedMainId) || apiState.mainDraft || null;
}

function requireMainEndpoint(apiState) {
  const endpoint = selectedMainEndpoint(apiState);
  if (!endpoint?.apiKey?.trim()) throw new Error("主 API 未填写 API Key");
  if (!endpoint?.baseUrl?.trim()) throw new Error("主 API 未填写 Base URL");
  if (!(endpoint.model || endpoint.customModel)?.trim()) throw new Error("主 API 未选择模型");
  return endpoint;
}

export function formatOfficeAiError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/401|403/.test(message)) return "API Key 无效或没有访问权限";
  if (/404/.test(message)) return "接口地址不兼容，请检查 Base URL";
  if (/429/.test(message)) return "请求过于频繁或额度不足";
  if (error?.name === "TimeoutError" || /timeout|超时/i.test(message)) return "请求超时，请检查网络或接口速度";
  if (/JSON|scene plan|办公室聊天至少需要/.test(message)) return "API 返回的办公室场景格式不正确";
  if (/主 API/.test(message)) return message;
  return "网络请求失败，请检查接口地址、跨域设置或网络状态";
}

export async function testOfficeAiDirector({ apiState, fetchImpl = fetch, now = Date.now() }) {
  const endpoint = requireMainEndpoint(apiState);
  const mainOnlyState = { ...apiState, mainConfigs: [endpoint], selectedMainId: endpoint.id, mainDraft: endpoint, secondaryEnabled: false };
  const occupant = { slotId: "boss", profile: { id: "office-api-test", name: "测试角色", personality: "认真负责" } };
  await generateAiOfficePlan({ apiState: mainOnlyState, context: { occupants: [occupant], now, endsAt: now + 900_000, projectContext: "连接测试", destinations: ["boss-home"] }, fetchImpl });
  return { source: "main", model: (endpoint.model || endpoint.customModel).trim() };
}
```

同步补全 `generateAiOfficePlan` 的 system prompt，明确顶层 `characters` 映射、每个字段、`conversation` 可为 `null`，避免不同模型自行猜测结构。

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test src/work/officeConversation.test.js`

Expected: 所有测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/work/officeConversation.js src/work/officeConversation.test.js
git commit -m "feat(work): test the main AI director endpoint"
```

### Task 2: 工作设置测试按钮与明确结果

**Files:**
- Modify: `src/work/WorkSettings.jsx`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/office.css`
- Modify: `src/work/workScreen.test.js`

**Interfaces:**
- Consumes: `testOfficeAiDirector`, `formatOfficeAiError`, `parseConfigs`, `STORAGE_KEY`
- Produces: `WorkSettings({ onTestAiDirector })`，回调成功时 resolve，失败时 reject

- [ ] **Step 1: 写入失败的界面契约测试**

在 `src/work/workScreen.test.js` 增加：

```js
test("work settings tests the real main AI director endpoint", () => {
  const settings = readFileSync("src/work/WorkSettings.jsx", "utf8");
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(settings, /测试 AI 导演/);
  assert.match(settings, /测试中…/);
  assert.match(settings, /AI 导演连接成功，可以使用。/);
  assert.match(settings, /role="status"/);
  assert.match(settings, /role="alert"/);
  assert.match(screen, /testOfficeAiDirector/);
  assert.match(screen, /formatOfficeAiError/);
  assert.match(screen, /parseConfigs/);
  assert.match(styles, /\.work-ai-test-button\s*\{[^}]*min-height:\s*44px/s);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL，找不到“测试 AI 导演”。

- [ ] **Step 3: 实现测试交互**

`WorkSettings.jsx` 新增独立的 `testingAi` 和 `aiTestResult` 状态。按钮处理函数必须是：

```js
const runAiTest = async () => {
  if (testingAi) return;
  setTestingAi(true);
  setAiTestResult(null);
  try {
    await onTestAiDirector();
    setAiTestResult({ tone: "ok", text: "AI 导演连接成功，可以使用。" });
  } catch (testError) {
    setAiTestResult({ tone: "error", text: testError instanceof Error ? testError.message : "AI 导演测试失败" });
  } finally {
    setTestingAi(false);
  }
};
```

在 A/B 模式下方渲染按钮和结果；结果成功使用 `role="status"`，失败使用 `role="alert"`。按钮 `disabled={testingAi}`，文案为 `testingAi ? "测试中…" : "测试 AI 导演"`。

`WorkAppScreen.jsx` 新增回调：

```js
const testAiDirector = async () => {
  const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
  try {
    return await testOfficeAiDirector({ apiState });
  } catch (testError) {
    throw new Error(formatOfficeAiError(testError));
  }
};
```

并通过 `onTestAiDirector={testAiDirector}` 传给 `WorkSettings`。

在 `office.css` 中为测试区添加白色轻奢卡片、44px 最小触控高度、加载禁用态、成功绿色和失败红色文字；不得改变既有 A/B 卡片布局。

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test src/work/workScreen.test.js`

Expected: 所有测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/work/WorkSettings.jsx src/work/WorkAppScreen.jsx src/work/office.css src/work/workScreen.test.js
git commit -m "feat(work): add AI director test feedback"
```

### Task 3: 自动回退显示真实错误并完成浏览器验收

**Files:**
- Modify: `src/work/useOfficeSimulation.js`
- Modify: `src/work/useOfficeSimulation.test.js`
- Modify: `scripts/verify-work-office.mjs`

**Interfaces:**
- Consumes: `formatOfficeAiError(error)`
- Produces: 自动失败提示 `AI 导演暂不可用：${reason}。已使用本地调度`

- [ ] **Step 1: 写入失败测试**

在 `useOfficeSimulation.test.js` 增加源码契约：

```js
test("automatic AI fallback keeps the concrete failure reason", () => {
  const source = readFileSync("src/work/useOfficeSimulation.js", "utf8");
  assert.match(source, /formatOfficeAiError/);
  assert.match(source, /AI 导演暂不可用：\$\{reason\}。已使用本地调度/);
  assert.doesNotMatch(source, /\.catch\(\(\) =>/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test src/work/useOfficeSimulation.test.js`

Expected: FAIL，当前 catch 仍吞掉异常。

- [ ] **Step 3: 最小实现真实错误提示**

导入 `formatOfficeAiError`，将自动调度 catch 改为：

```js
.catch((error) => {
  if (cancelled) return;
  const reason = formatOfficeAiError(error);
  showNotice(`AI 导演暂不可用：${reason}。已使用本地调度`, 4200);
});
```

- [ ] **Step 4: 扩展 Playwright 验收**

在 `scripts/verify-work-office.mjs` 的工作设置流程中：

```js
await page.getByRole("button", { name: "测试 AI 导演" }).click();
await page.getByRole("alert").filter({ hasText: /主 API|网络请求|接口地址/ }).waitFor();
await page.getByRole("radio", { name: /B AI 导演/ }).click();
await page.getByRole("button", { name: "返回办公室" }).click();
await page.getByText(/AI 导演暂不可用：.+已使用本地调度/).waitFor();
```

QA 的初始化配置必须使用缺失 Key 的确定性主 API，避免真实联网；同时确认按钮测试不会改变当前选中的 A/B 模式。

- [ ] **Step 5: 运行针对性和浏览器测试**

Run: `node --test src/work/useOfficeSimulation.test.js src/work/workScreen.test.js && npm run verify:work`

Expected: 单元测试通过；Playwright 输出 `Work office browser QA passed for 375x812 and 390x844`。

- [ ] **Step 6: 提交**

```bash
git add src/work/useOfficeSimulation.js src/work/useOfficeSimulation.test.js scripts/verify-work-office.mjs artifacts/work-office-qa/office-375x812.png artifacts/work-office-qa/office-390x844.png
git commit -m "fix(work): explain AI director fallback failures"
```

### Task 4: 发布 V0.3.20

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`
- Regenerate: `docs/index.html`
- Regenerate: `docs/assets/*`
- Modify: `docs/.deploy-version`

**Interfaces:**
- Produces: GitHub Pages 版本 `Ccat OS V0.3.20`

- [ ] **Step 1: 先把发布测试改为 0.3.20 并确认失败**

修改 `src/App.launcher.test.js` 的版本、JS 资源查询参数和 CSS 资源查询参数断言为 `0.3.20`。

Run: `node --test src/App.launcher.test.js`

Expected: FAIL，当前版本仍为 `0.3.19`。

- [ ] **Step 2: 更新版本标记**

将以下文件中的 `0.3.19` 精确替换为 `0.3.20`：

```text
package.json
package-lock.json
src/App.jsx
src/styles.css
```

- [ ] **Step 3: 运行发布测试和完整发布门禁**

Run:

```bash
node --test src/App.launcher.test.js
npm test
npm run build
npm run verify:work
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: 全部退出码为 0；两种手机视口通过；`docs/` 与 `dist/` 同步。

- [ ] **Step 4: 提交、推送并验证线上资源**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs/.deploy-version docs/index.html docs/assets
git commit -m "chore(release): publish AI director test 0.3.20"
git push origin main
```

等待 Pages 切换后，确认线上 HTML 使用新哈希资源；线上 JS 包含 `Ccat OS V0.3.20`、`测试 AI 导演`、`AI 导演连接成功，可以使用。`，并确认远端 `main` 指向本地发布提交。
