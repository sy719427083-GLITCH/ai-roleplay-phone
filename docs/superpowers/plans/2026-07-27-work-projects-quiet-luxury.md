# Work APP 项目管理简约轻奢改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目管理页面按选定的白色轻奢方案重做 UI，并保留全部现有内容与交互后发布到 GitHub Pages。

**Architecture:** 继续由 `ProjectManagementPreview.jsx` 管理现有项目状态和交互，只调整合同的语义层级与展示结构；视觉全部集中在 `office.css` 的项目管理选择器中，不改 API、状态或钱包模块。

**Tech Stack:** React 19、Vite 6、Lucide React、Node test、GitHub Pages `docs/` 部署目录。

## Global Constraints

- 页面和合同背景使用纯白 `#ffffff`。
- 保留五份合同、刷新、签署、锁定、加载和错误逻辑及全部现有字段。
- 触控区域至少 `44px`，支持减少动态效果。
- 只修改项目管理页面，不修改其他 Work APP 页面。

---

### Task 1: 锁定白色轻奢结构

**Files:**
- Modify: `src/work/ProjectManagementPreview.test.js`
- Modify: `src/work/ProjectManagementPreview.jsx`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `projectState`、`onProjectStateChange`、`startWorkProject()`。
- Produces: 现有属性签名不变的 `ProjectManagementPreview`。

- [x] **Step 1: 写失败测试**：要求白色表面、香槟金 token、连续台账序号，并禁止旧纸张纹理。
- [ ] **Step 2: 验证测试因新结构尚未实现而失败**：运行 `node --test src/work/ProjectManagementPreview.test.js`。
- [ ] **Step 3: 实现最小 JSX 与 CSS 改版**：添加合同序号层级并替换旧纸质合同样式。
- [ ] **Step 4: 验证聚焦测试通过**：运行 `node --test src/work/ProjectManagementPreview.test.js`。

### Task 2: 浏览器与视觉 QA

**Files:**
- Create: `design-qa.md`

**Interfaces:**
- Consumes: 选定源图和本地 Vite 页面。
- Produces: `final result: passed` 的视觉 QA 报告。

- [ ] **Step 1: 在本地启动 Vite 并准备可重复的项目合同状态。**
- [ ] **Step 2: 在 `375×812` 与 `390×844` 检查布局、滚动、刷新和签署操作。**
- [ ] **Step 3: 将源图与实现截图组成同一比较图，修复全部 P0-P2 差异。**
- [ ] **Step 4: 写入 `design-qa.md` 并确认 `final result: passed`。**

### Task 3: 回归、构建与发布

**Files:**
- Modify: `package.json`
- Modify: `docs/`

**Interfaces:**
- Consumes: 通过视觉 QA 的源代码。
- Produces: 新版本号、生产构建、同步后的 GitHub Pages 文件和线上版本。

- [ ] **Step 1: 运行 `npm test`、`npm run build` 和 `npm run deploy:pages`。**
- [ ] **Step 2: 递增补丁版本并重新生成部署文件。**
- [ ] **Step 3: 提交并推送 `main` 到 `origin`。**
- [ ] **Step 4: 在线验证新版本与项目管理页面。**
