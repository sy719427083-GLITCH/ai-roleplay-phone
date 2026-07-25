# Work APP 项目管理 UI 预览实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Work APP 中制作一个可交互但不调用真实 API 的项目管理手机 UI 预览，展示五张项目卡、刷新加载态、项目进行中状态和刷新锁定状态。

**Architecture:** 使用独立纯逻辑模块保存五条示例项目与预览状态转换，React 页面组件只负责渲染和短时刷新动画。`WorkAppScreen` 仅负责把“项目管理”入口切换到独立预览页，避免把项目状态混入办公室移动逻辑。

**Tech Stack:** React 19、JavaScript ES modules、Lucide React、CSS、Node test runner、Playwright

## Global Constraints

- 只制作 UI 预览，不调用真实 API、不写入正式项目状态、不发布线上版本。
- 固定展示五个项目；每个项目显示名称、时间、金额、内容、难度和开始按钮。
- 任意项目开始后，右上角刷新按钮禁用并显示锁定状态。
- 延续现有 Work APP 的浅蓝白、蓝、绿、紫、珊瑚色视觉语言。
- 所有按钮点击区域至少 44px，并保留 `prefers-reduced-motion` 降级。

---

### Task 1: 项目预览模型

**Files:**
- Create: `src/work/projectPreviewModel.js`
- Create: `src/work/projectPreviewModel.test.js`

**Interfaces:**
- Produces: `PREVIEW_PROJECTS`（五个规范化项目对象）、`startPreviewProject(state, projectId)`、`refreshPreviewProjects(state)`。
- 项目对象字段固定为 `{ id, name, duration, amount, description, difficulty }`。
- 状态固定为 `{ projects, startedProjectId, revision }`。

- [ ] **Step 1: 写失败测试**

测试必须断言：示例数据恰好五条且字段完整；开始项目后记录 `startedProjectId`；已开始状态调用刷新时返回原状态；未开始状态刷新时 `revision + 1` 且项目顺序轮换。

- [ ] **Step 2: 运行测试确认 RED**

Run: `node --test src/work/projectPreviewModel.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `projectPreviewModel.js` does not exist.

- [ ] **Step 3: 实现最小纯逻辑模块**

定义五个示例项目；`startPreviewProject` 只接受存在的项目 ID；`refreshPreviewProjects` 在未锁定时轮换项目数组并增加 revision，在锁定时返回原对象。

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `node --test src/work/projectPreviewModel.test.js`

Expected: all model tests PASS.

- [ ] **Step 5: 提交模型**

```bash
git add src/work/projectPreviewModel.js src/work/projectPreviewModel.test.js
git commit -m "feat: add Work project preview model"
```

### Task 2: 项目管理预览页面

**Files:**
- Create: `src/work/ProjectManagementPreview.jsx`
- Create: `src/work/ProjectManagementPreview.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `PREVIEW_PROJECTS`, `startPreviewProject`, `refreshPreviewProjects`。
- Produces: `ProjectManagementPreview({ onBack })`，页面自带返回、标题与刷新按钮。

- [ ] **Step 1: 写失败的页面契约测试**

测试源文件必须包含“今日可接 5 个项目”“开始项目”“项目进行中”“列表已锁定”“刷新项目”以及语义化 `button`；CSS 必须包含至少 44px 的顶部按钮和项目按钮、项目卡片、难度标签、骨架加载与 reduced-motion 规则。

- [ ] **Step 2: 运行测试确认 RED**

Run: `node --test src/work/ProjectManagementPreview.test.js`

Expected: FAIL because the component file does not exist.

- [ ] **Step 3: 实现预览页面**

页面使用自己的 `.work-projects-page` 容器和标准 Work 顶部栏。刷新按钮使用 `RefreshCw` 图标；刷新时显示五张骨架卡片，650ms 后轮换示例项目。卡片使用 `Clock3`、`WalletCards` 图标展示时间和金额；点击开始后该卡片按钮变成禁用的“项目进行中”，顶部刷新按钮同步禁用。

- [ ] **Step 4: 实现页面样式**

使用 16px 页面边距、12px 卡片间距、15px 卡片圆角、清晰白色卡面、轻边框与不超过 8px 模糊的短阴影。正文不小于 13px；顶部和底部按钮高度不小于 44px。骨架只使用透明度动画，并在 reduced-motion 下关闭。

- [ ] **Step 5: 运行组件测试确认 GREEN**

Run: `node --test src/work/ProjectManagementPreview.test.js`

Expected: all component contract tests PASS.

- [ ] **Step 6: 提交页面**

```bash
git add src/work/ProjectManagementPreview.jsx src/work/ProjectManagementPreview.test.js src/work/office.css
git commit -m "feat: build Work project UI preview"
```

### Task 3: 接入项目管理入口并视觉验证

**Files:**
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/workScreen.test.js`
- Create: `scripts/verify-work-projects-preview.mjs`
- Update: `artifacts/work-projects-preview/projects-375x812.png`
- Update: `artifacts/work-projects-preview/projects-390x844.png`

**Interfaces:**
- Consumes: `ProjectManagementPreview({ onBack })`。
- Produces: 点击办公室底部“项目管理”后展示预览页，返回后回到办公室。

- [ ] **Step 1: 写失败的入口测试**

更新 `workScreen.test.js`，断言 `WorkAppScreen.jsx` 导入并在 `view === "projects"` 时渲染 `ProjectManagementPreview`，同时项目页不再落入“暂时留空”占位分支。

- [ ] **Step 2: 运行入口测试确认 RED**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL because `ProjectManagementPreview` is not imported or rendered.

- [ ] **Step 3: 接入页面**

在 `WorkAppScreen` 的办公室分支之前增加 `view === "projects"` 返回；把 `onBack` 绑定为 `setView("office")`，其他员工管理、倒计时和设置分支保持不变。

- [ ] **Step 4: 运行入口与完整测试**

Run: `node --test src/work/projectPreviewModel.test.js src/work/ProjectManagementPreview.test.js src/work/workScreen.test.js && npm test`

Expected: focused tests and all existing tests PASS.

- [ ] **Step 5: 编写并运行浏览器验证脚本**

脚本启动 Vite，分别使用 375×812 和 390×844 打开首页、进入 Work APP、点击项目管理，断言五张项目卡、刷新按钮、开始按钮可见；点击第一张开始按钮后断言“项目进行中”和刷新禁用；保存两张截图。

Run: `node scripts/verify-work-projects-preview.mjs`

Expected: `Work project preview QA passed for 375x812 and 390x844`.

- [ ] **Step 6: 检查差异并提交预览**

```bash
git diff --check
git add src/work/WorkAppScreen.jsx src/work/workScreen.test.js scripts/verify-work-projects-preview.mjs artifacts/work-projects-preview
git commit -m "feat: integrate Work project UI preview"
```
