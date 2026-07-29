# 工作 APP AI 导演真实测试与超时修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“测试 AI 导演”使用当前办公室真实上下文，并将办公室场景生成超时统一调整为 30 秒，消除轻量测试成功但正式调度超时的不一致。

**Architecture:** `officeConversation.js` 提供统一的办公室 AI 场景上下文构造器，并为场景生成和聊天请求设置各自超时；测试入口接收真实上下文但不应用返回计划。`WorkAppScreen.jsx` 和 `useOfficeSimulation.js` 共用同一上下文构造器，保证手动测试与正式调度的请求规模一致。

**Tech Stack:** React 19、Vite、Node.js `node:test`、Playwright、GitHub Pages

## Global Constraints

- 办公室场景生成超时固定为 30,000 毫秒。
- 办公室聊天保持 12,000 毫秒超时。
- 测试使用当前全部在岗人物和当前项目名称。
- 测试不改变 A/B 模式、计划、人物位置、项目状态或缓存。
- 当前办公室没有人物时不发送请求，提示“请先在员工管理中安排至少一名人物”。
- 正式调度超时后继续显示具体原因并回退本地调度。

---

### Task 1: 统一真实场景上下文与场景专用超时

**Files:**
- Modify: `src/work/officeConversation.js`
- Modify: `src/work/officeConversation.test.js`
- Modify: `src/work/useOfficeSimulation.js`
- Modify: `src/work/useOfficeSimulation.test.js`

**Interfaces:**
- Produces: `OFFICE_SCENE_TIMEOUT_MS = 30_000`
- Produces: `OFFICE_CONVERSATION_TIMEOUT_MS = 12_000`
- Produces: `buildOfficeAiContext({ occupants, now, endsAt, projectContext }): OfficeAiContext`
- Changes: `testOfficeAiDirector({ apiState, context, fetchImpl? }): Promise<{ source: "main", model: string }>`

- [ ] **Step 1: 写失败测试**

在 `officeConversation.test.js` 中增加真实三人物上下文、空人物和超时常量测试：

```js
test("builds the same full context for testing and live AI direction", () => {
  const occupants = [
    { slotId: "boss", profile: { id: "me:m1", name: "我" } },
    { slotId: "employee1", profile: { id: "character:c1", name: "甲" } },
    { slotId: "employee2", profile: { id: "character:c2", name: "乙" } },
  ];
  const context = buildOfficeAiContext({ occupants, now: 1_000, endsAt: 901_000, projectContext: "品牌项目" });
  assert.deepEqual(context.occupants, occupants);
  assert.equal(context.projectContext, "品牌项目");
  assert.ok(context.destinations.includes("boss-home"));
  assert.ok(context.destinations.includes("employee1-home"));
  assert.equal(OFFICE_SCENE_TIMEOUT_MS, 30_000);
  assert.equal(OFFICE_CONVERSATION_TIMEOUT_MS, 12_000);
});

test("realistic AI test sends every current occupant and rejects an empty office", async () => {
  const occupants = [
    { slotId: "boss", profile: { id: "character:c1", name: "林序" } },
    { slotId: "employee1", profile: { id: "character:c2", name: "周夏" } },
  ];
  const context = buildOfficeAiContext({ occupants, now: 1_000, endsAt: 901_000, projectContext: "品牌项目" });
  let body;
  await testOfficeAiDirector({ apiState: mainApiState, context, fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      id: "realistic-test",
      startsAt: 1_000,
      endsAt: 901_000,
      characters: {
        "character:c1": { activity: "working", label: "工作中", destination: "boss-home", startsAt: 1_000, endsAt: 901_000 },
        "character:c2": { activity: "reporting", label: "做报表", destination: "employee1-home", startsAt: 1_000, endsAt: 901_000 },
      },
      conversation: null,
    }) } }] }) };
  } });
  assert.deepEqual(JSON.parse(body.messages[1].content).profiles.map((item) => item.id), ["character:c1", "character:c2"]);
  await assert.rejects(testOfficeAiDirector({ apiState: mainApiState, context: buildOfficeAiContext({ occupants: [], now: 1_000, endsAt: 901_000 }) }), /至少一名人物/);
});
```

在 `useOfficeSimulation.test.js` 的源码契约中要求 `buildOfficeAiContext` 被正式调度调用。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test src/work/officeConversation.test.js src/work/useOfficeSimulation.test.js`

Expected: FAIL，缺少超时常量、上下文构造器或新测试签名。

- [ ] **Step 3: 实现独立超时与上下文构造**

在 `officeConversation.js` 中：

```js
export const OFFICE_SCENE_TIMEOUT_MS = 30_000;
export const OFFICE_CONVERSATION_TIMEOUT_MS = 12_000;

export function buildOfficeAiContext({ occupants = [], now = Date.now(), endsAt = now + 900_000, projectContext = "" } = {}) {
  return {
    occupants,
    now,
    endsAt,
    projectContext,
    destinations: [
      ...Object.keys(OFFICE_ACTIVITY_POINTS),
      ...occupants.map((item) => `${item.slotId}-home`),
      "print-station",
    ],
  };
}
```

让 `requestJson(candidate, messages, fetchImpl, timeoutMs)` 使用 `AbortSignal.timeout(timeoutMs)`；`generateOfficeConversation` 传 `OFFICE_CONVERSATION_TIMEOUT_MS`，`generateAiOfficePlan` 传 `OFFICE_SCENE_TIMEOUT_MS`。

将测试入口改为：

```js
export async function testOfficeAiDirector({ apiState, context, fetchImpl = fetch }) {
  if (!context?.occupants?.length) throw new Error("请先在员工管理中安排至少一名人物");
  const endpoint = requireMainEndpoint(apiState);
  const mainOnlyState = { ...apiState, mainConfigs: [endpoint], selectedMainId: endpoint.id, mainDraft: endpoint, secondaryEnabled: false };
  await generateAiOfficePlan({ apiState: mainOnlyState, context, fetchImpl });
  return { source: "main", model: (endpoint.model || endpoint.customModel).trim() };
}
```

`useOfficeSimulation.js` 使用 `buildOfficeAiContext({ occupants, now, endsAt: localPlan.endsAt, projectContext })`，删除内联 destinations 构造。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test src/work/officeConversation.test.js src/work/useOfficeSimulation.test.js`

Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/work/officeConversation.js src/work/officeConversation.test.js src/work/useOfficeSimulation.js src/work/useOfficeSimulation.test.js
git commit -m "fix(work): align AI director testing with live scenes"
```

### Task 2: 将当前办公室上下文传给测试按钮

**Files:**
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/workScreen.test.js`
- Modify: `scripts/verify-work-office.mjs`

**Interfaces:**
- Consumes: `buildOfficeAiContext`
- Consumes: `testOfficeAiDirector({ apiState, context })`

- [ ] **Step 1: 写失败的界面数据流测试**

在 `workScreen.test.js` 的 AI 测试用例中增加：

```js
assert.match(screen, /buildOfficeAiContext/);
assert.match(screen, /occupants/);
assert.match(screen, /projectTimer\.project\?\.name/);
assert.match(screen, /testOfficeAiDirector\(\{ apiState, context \}\)/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL，`WorkAppScreen` 尚未构造真实测试上下文。

- [ ] **Step 3: 传入真实上下文**

在 `WorkAppScreen.jsx` 的 `testAiDirector` 中：

```js
const context = buildOfficeAiContext({
  occupants,
  now: Date.now(),
  endsAt: Date.now() + 15 * 60_000,
  projectContext: projectTimer.project?.name || "",
});
return await testOfficeAiDirector({ apiState, context });
```

保留现有 `formatOfficeAiError` 包装，不将返回计划写入 state 或 localStorage。

- [ ] **Step 4: 扩展 Playwright 验收**

在 `verify-work-office.mjs` 初始化脚本中写入只用于本地拦截的完整主 API（Base URL 为 `https://qa.example/v1`，包含 Key 和模型）。在页面打开前拦截 `https://qa.example/v1/chat/completions`，解析请求体并断言 `profiles` 包含当前 7 个在岗人物；返回有效 7 人场景 JSON，断言界面出现“AI 导演连接成功，可以使用。”且 A 模式仍保持选中。

随后把拦截改为超时/失败响应，确认失败提示正常且不改变模式。不得调用真实外部 API。

- [ ] **Step 5: 运行单元与浏览器验收**

Run: `node --test src/work/workScreen.test.js && npm run verify:work`

Expected: 单元测试通过；Playwright 输出 `Work office browser QA passed for 375x812 and 390x844`。

- [ ] **Step 6: 提交**

```bash
git add src/work/WorkAppScreen.jsx src/work/workScreen.test.js scripts/verify-work-office.mjs artifacts/work-office-qa/office-375x812.png artifacts/work-office-qa/office-390x844.png
git commit -m "test(work): verify realistic AI director checks"
```

### Task 3: 发布 V0.3.21

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
- Produces: GitHub Pages 版本 `Ccat OS V0.3.21`

- [ ] **Step 1: 先把发布测试更新为 0.3.21 并确认失败**

将 `App.launcher.test.js` 中的 package 版本、可见版本、JS 查询参数和 CSS 查询参数断言全部改为 `0.3.21`。

Run: `node --test src/App.launcher.test.js`

Expected: FAIL，当前版本仍为 `0.3.20`。

- [ ] **Step 2: 更新版本标记**

将 `package.json`、`package-lock.json`、`src/App.jsx` 和 `src/styles.css` 中的发布版本精确更新为 `0.3.21`。

- [ ] **Step 3: 运行完整发布门禁**

```bash
node --test src/App.launcher.test.js
npm test
npm run build
npm run verify:work
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: 所有命令退出码为 0；全量测试无失败；两个手机视口通过；`docs/` 与 `dist/` 同步。

- [ ] **Step 4: 提交、推送并核验线上资源**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs/.deploy-version docs/index.html docs/assets
git commit -m "chore(release): publish realistic AI director test 0.3.21"
git push origin main
```

等待 Pages 切换后，确认线上 HTML 使用新资源哈希；线上 JS 包含 `Ccat OS V0.3.21`、`请先在员工管理中安排至少一名人物` 和成功提示文案，并确认远端 `main` 指向本地发布提交。30 秒超时由单元测试和源代码契约验证，不依赖压缩产物的数字表现形式。
