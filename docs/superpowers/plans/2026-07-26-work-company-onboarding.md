# 工作 APP 首次创建公司 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为工作 APP 增加仅首次出现的“启动动画 → 创建公司 → 进入公司动画”流程，并在公司创建后永久直接进入现有办公室。

**Architecture:** 使用独立纯逻辑模块保存和恢复 `ccatWorkCompanyV1`，避免污染现有办公室与项目状态。`WorkCompanyOnboarding` 只管理三个视觉阶段；`WorkAppScreen` 负责安全写入 localStorage，并在进入动画结束后切换到现有办公室。

**Tech Stack:** React 19、原生 localStorage、CSS transform/opacity 动画、Lucide React、Node `node:test`。

## Global Constraints

- 阶段顺序必须是“工作 APP 启动动画 → 创建公司 → 进入公司动画 → 办公室”。
- 公司名前缀去除首尾空格后必须为 1–5 个 Unicode 字符，固定后缀必须是“有限公司”。
- 有效公司保存键必须是 `ccatWorkCompanyV1`，不得改变 `ccatWorkOfficeV1` 或项目、钱包存储。
- 保存成功后，即使进入动画中途关闭，下一次打开也必须直接进入办公室。
- 完整启动动画约 1.2 秒，进入动画约 1.4 秒；减少动态效果时约 150 毫秒。
- 所有可点击控件至少 44×44 像素。
- 不修改项目合同、倒计时、员工管理、办公室布局、路径和钱包业务逻辑。

---

## File Map

- Create `src/work/workCompanyState.js`: 公司名称规则、创建、序列化和恢复。
- Create `src/work/workCompanyState.test.js`: 持久化与 Unicode 边界测试。
- Create `src/work/WorkCompanyOnboarding.jsx`: 三阶段首次流程及跳过、错误交互。
- Create `src/work/WorkCompanyOnboarding.test.js`: 组件结构、文案、阶段顺序和可访问性契约。
- Modify `src/work/WorkAppScreen.jsx`: 首次流程入口、安全保存和完成切换。
- Modify `src/work/workScreen.test.js`: 验证有效公司绕过首次流程的集成契约。
- Modify `src/work/office.css`: 启动、创建、进入动画及减少动态效果样式。

---

### Task 1: 公司名称与持久化纯逻辑

**Files:**
- Create: `src/work/workCompanyState.js`
- Create: `src/work/workCompanyState.test.js`

**Interfaces:**
- Consumes: localStorage 返回的原始字符串。
- Produces: `WORK_COMPANY_STORAGE_KEY`, `WORK_COMPANY_SUFFIX`, `WORK_COMPANY_MAX_PREFIX_LENGTH`, `limitWorkCompanyPrefix(value)`, `normalizeWorkCompanyPrefix(value)`, `createWorkCompany(prefix, createdAt?)`, `restoreWorkCompany(raw)`, `serializeWorkCompany(company)`。

- [ ] **Step 1: 写失败测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  WORK_COMPANY_STORAGE_KEY,
  createWorkCompany,
  limitWorkCompanyPrefix,
  normalizeWorkCompanyPrefix,
  restoreWorkCompany,
  serializeWorkCompany,
} from "./workCompanyState.js";

test("uses an isolated company storage key", () => {
  assert.equal(WORK_COMPANY_STORAGE_KEY, "ccatWorkCompanyV1");
});

test("limits company prefixes by Unicode characters", () => {
  assert.equal(limitWorkCompanyPrefix("星河设计事务所"), "星河设计事");
  assert.equal(limitWorkCompanyPrefix("A😀BCDZ"), "A😀BCD");
  assert.equal(normalizeWorkCompanyPrefix("  星河  "), "星河");
});

test("creates and restores a complete company", () => {
  const company = createWorkCompany("星河", "2026-07-26T10:00:00.000Z");
  assert.deepEqual(company, {
    version: 1,
    prefix: "星河",
    fullName: "星河有限公司",
    createdAt: "2026-07-26T10:00:00.000Z",
  });
  assert.deepEqual(restoreWorkCompany(serializeWorkCompany(company)), company);
});

test("rejects empty, malformed, mismatched, or oversized companies", () => {
  assert.throws(() => createWorkCompany("   "), /请输入公司名称/);
  assert.equal(restoreWorkCompany("broken"), null);
  assert.equal(restoreWorkCompany(JSON.stringify({ version: 1, prefix: "星河", fullName: "错误公司", createdAt: "2026-07-26T10:00:00.000Z" })), null);
  assert.equal(restoreWorkCompany(JSON.stringify({ version: 1, prefix: "一二三四五六", fullName: "一二三四五六有限公司", createdAt: "2026-07-26T10:00:00.000Z" })), null);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test src/work/workCompanyState.test.js`

Expected: FAIL，提示找不到 `workCompanyState.js`。

- [ ] **Step 3: 实现最小纯逻辑模块**

```js
export const WORK_COMPANY_STORAGE_KEY = "ccatWorkCompanyV1";
export const WORK_COMPANY_STATE_VERSION = 1;
export const WORK_COMPANY_SUFFIX = "有限公司";
export const WORK_COMPANY_MAX_PREFIX_LENGTH = 5;

const toCharacters = (value) => Array.from(String(value ?? ""));

export const limitWorkCompanyPrefix = (value) =>
  toCharacters(value).slice(0, WORK_COMPANY_MAX_PREFIX_LENGTH).join("");

export const normalizeWorkCompanyPrefix = (value) =>
  limitWorkCompanyPrefix(String(value ?? "").trim());

export function createWorkCompany(prefix, createdAt = new Date().toISOString()) {
  const normalized = normalizeWorkCompanyPrefix(prefix);
  if (!normalized) throw new Error("请输入公司名称");
  return {
    version: WORK_COMPANY_STATE_VERSION,
    prefix: normalized,
    fullName: `${normalized}${WORK_COMPANY_SUFFIX}`,
    createdAt,
  };
}

export function restoreWorkCompany(raw) {
  let parsed;
  try { parsed = JSON.parse(raw || "null"); } catch { return null; }
  if (!parsed || parsed.version !== WORK_COMPANY_STATE_VERSION) return null;
  const prefix = String(parsed.prefix ?? "").trim();
  if (!prefix || toCharacters(prefix).length > WORK_COMPANY_MAX_PREFIX_LENGTH) return null;
  if (parsed.fullName !== `${prefix}${WORK_COMPANY_SUFFIX}`) return null;
  if (typeof parsed.createdAt !== "string" || !parsed.createdAt) return null;
  return { version: WORK_COMPANY_STATE_VERSION, prefix, fullName: parsed.fullName, createdAt: parsed.createdAt };
}

export const serializeWorkCompany = (company) => JSON.stringify(company);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test src/work/workCompanyState.test.js`

Expected: 4 tests PASS，0 FAIL。

- [ ] **Step 5: 提交纯逻辑**

```bash
git add src/work/workCompanyState.js src/work/workCompanyState.test.js
git commit -m "feat(work): add persistent company state"
```

---

### Task 2: 三阶段首次创建组件

**Files:**
- Create: `src/work/WorkCompanyOnboarding.jsx`
- Create: `src/work/WorkCompanyOnboarding.test.js`

**Interfaces:**
- Consumes: `onClose()`, `onCreate(prefix): WorkCompany`, `onComplete(company)`。
- Produces: 仅在未创建公司时显示的启动、创建和进入三阶段界面。

- [ ] **Step 1: 写组件契约失败测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/WorkCompanyOnboarding.jsx", "utf8");

test("onboarding preserves launch, create, and enter order", () => {
  assert.match(source, /useState\("launch"\)/);
  assert.match(source, /setPhase\("create"\)/);
  assert.match(source, /setPhase\("enter"\)/);
  assert.match(source, /onComplete\(createdCompany\)/);
});

test("company form exposes fixed suffix, validation, and accessible actions", () => {
  for (const text of ["创建公司", "有限公司", "公司名称最多 5 个字", "公司创建失败，请重试", "跳过动画"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /aria-label="公司名称前缀"/);
  assert.match(source, /disabled=\{[^}]*!normalizedPrefix/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test src/work/WorkCompanyOnboarding.test.js`

Expected: FAIL，提示找不到 `WorkCompanyOnboarding.jsx`。

- [ ] **Step 3: 实现三阶段组件**

实现以下固定行为：

```jsx
import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, ChevronLeft } from "lucide-react";
import {
  WORK_COMPANY_MAX_PREFIX_LENGTH,
  WORK_COMPANY_SUFFIX,
  limitWorkCompanyPrefix,
  normalizeWorkCompanyPrefix,
} from "./workCompanyState.js";

const LAUNCH_DURATION_MS = 1200;
const ENTER_DURATION_MS = 1400;
const REDUCED_DURATION_MS = 150;

export function WorkCompanyOnboarding({ onClose, onCreate, onComplete }) {
  const [phase, setPhase] = useState("launch");
  const [prefix, setPrefix] = useState("");
  const [limitMessage, setLimitMessage] = useState("");
  const [error, setError] = useState("");
  const [createdCompany, setCreatedCompany] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const reducedMotion = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);
  const normalizedPrefix = normalizeWorkCompanyPrefix(prefix);

  useEffect(() => {
    if (phase !== "launch") return undefined;
    const timer = window.setTimeout(() => setPhase("create"), reducedMotion ? REDUCED_DURATION_MS : LAUNCH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "enter" || !createdCompany) return undefined;
    const timer = window.setTimeout(() => onComplete(createdCompany), reducedMotion ? REDUCED_DURATION_MS : ENTER_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase, createdCompany, onComplete, reducedMotion]);

  const updatePrefix = (value) => {
    const oversized = Array.from(value).length > WORK_COMPANY_MAX_PREFIX_LENGTH;
    setPrefix(limitWorkCompanyPrefix(value));
    setLimitMessage(oversized ? "公司名称最多 5 个字" : "");
    setError("");
  };

  const submit = () => {
    if (!normalizedPrefix || submitting) return;
    setSubmitting(true);
    try {
      const company = onCreate(normalizedPrefix);
      setCreatedCompany(company);
      setPhase("enter");
    } catch {
      setError("公司创建失败，请重试");
      setSubmitting(false);
    }
  };

  if (phase === "launch") {
    return (
      <section className="work-company-onboarding is-launch" aria-label="工作 APP 启动">
        <button className="work-company-skip" type="button" onClick={() => setPhase("create")}>跳过动画</button>
        <div className="work-company-launch-center">
          <span className="work-company-launch-icon"><BriefcaseBusiness size={42} /></span>
          <strong>工作中心</strong>
          <span>WORK</span>
        </div>
      </section>
    );
  }

  if (phase === "enter") {
    return (
      <section className="work-company-onboarding is-enter" aria-label="正在进入公司">
        <button className="work-company-skip" type="button" onClick={() => onComplete(createdCompany)}>跳过动画</button>
        <div className="work-company-enter-center">
          <Building2 size={46} />
          <strong className="work-company-plaque">{createdCompany.fullName}</strong>
          <span>正在进入公司</span>
        </div>
      </section>
    );
  }

  return (
    <section className="work-company-onboarding is-create" aria-label="创建公司">
      <button className="work-company-close" type="button" onClick={onClose} aria-label="返回主页"><ChevronLeft size={22} /></button>
      <form className="work-company-create-card" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <span className="work-company-create-icon"><Building2 size={28} /></span>
        <h1>创建公司</h1>
        <p>为你的工作空间取一个名字</p>
        <label className="work-company-name-field">
          <input
            autoFocus
            aria-label="公司名称前缀"
            value={prefix}
            onChange={(event) => updatePrefix(event.target.value)}
            placeholder="最多 5 个字"
          />
          <span>{WORK_COMPANY_SUFFIX}</span>
        </label>
        <div className="work-company-preview" aria-live="polite">
          <small>公司全称</small>
          <strong>{normalizedPrefix ? `${normalizedPrefix}${WORK_COMPANY_SUFFIX}` : WORK_COMPANY_SUFFIX}</strong>
        </div>
        {limitMessage && <p className="work-company-message">{limitMessage}</p>}
        {error && <p className="work-company-error" role="alert">{error}</p>}
        <button className="work-company-create-button" type="submit" disabled={!normalizedPrefix || submitting}>
          {submitting ? "正在创建" : "创建公司"}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test src/work/WorkCompanyOnboarding.test.js`

Expected: 2 tests PASS，0 FAIL。

- [ ] **Step 5: 提交组件**

```bash
git add src/work/WorkCompanyOnboarding.jsx src/work/WorkCompanyOnboarding.test.js
git commit -m "feat(work): add company onboarding flow"
```

---

### Task 3: 接入工作 APP 并添加动画样式

**Files:**
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/workScreen.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: Task 1 的公司状态函数和 Task 2 的 `WorkCompanyOnboarding`。
- Produces: 有效公司直接进入办公室；无公司才显示首次流程。

- [ ] **Step 1: 扩展集成契约测试并确认失败**

在 `src/work/workScreen.test.js` 增加：

```js
test("work app gates the office behind one-time company creation", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(screen, /WORK_COMPANY_STORAGE_KEY/);
  assert.match(screen, /restoreWorkCompany/);
  assert.match(screen, /<WorkCompanyOnboarding/);
  assert.match(screen, /window\.localStorage\.setItem\(WORK_COMPANY_STORAGE_KEY/);
  assert.match(styles, /\.work-company-onboarding/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.work-company-skip[^}]*min-height:\s*44px/s);
});
```

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL，因为入口和样式尚未接入。

- [ ] **Step 2: 在 WorkAppScreen 接入持久化入口**

新增导入：

```jsx
import { WorkCompanyOnboarding } from "./WorkCompanyOnboarding.jsx";
import {
  WORK_COMPANY_STORAGE_KEY,
  createWorkCompany,
  restoreWorkCompany,
  serializeWorkCompany,
} from "./workCompanyState.js";
```

在 `WorkAppScreen` 顶部状态区新增：

```jsx
const [company, setCompany] = useState(() =>
  restoreWorkCompany(window.localStorage.getItem(WORK_COMPANY_STORAGE_KEY))
);

const persistCompany = (prefix) => {
  const nextCompany = createWorkCompany(prefix);
  window.localStorage.setItem(WORK_COMPANY_STORAGE_KEY, serializeWorkCompany(nextCompany));
  return nextCompany;
};
```

在所有项目、倒计时和办公室视图判断之前增加：

```jsx
if (!company) {
  return (
    <WorkCompanyOnboarding
      onClose={onClose}
      onCreate={persistCompany}
      onComplete={setCompany}
    />
  );
}
```

不要在 `persistCompany` 中提前调用 `setCompany`；必须让进入动画先播放完。localStorage 写入发生在动画之前，从而保证中途关闭后不会重复创建。

- [ ] **Step 3: 添加三阶段样式和动画**

在 `src/work/office.css` 添加这些完整规则组，并保持现有工作页面规则不变：

```css
.work-company-onboarding { position: fixed; inset: 0; z-index: 120; display: grid; min-height: 100dvh; overflow: hidden; background: #f7f9fc; color: #24334f; font-family: "Avenir Next","PingFang SC",sans-serif; }
.work-company-skip { min-width: 88px; min-height: 44px; border: 0; border-radius: 999px; background: rgba(255,255,255,.82); color: #61708d; }
.work-company-launch-center,.work-company-enter-center { display: grid; place-content: center; justify-items: center; text-align: center; }
.work-company-launch-icon { display: grid; width: 92px; height: 92px; place-items: center; border-radius: 28px; background: #fff; color: #417ee8; box-shadow: 0 20px 50px rgba(56,87,145,.17); animation: work-company-launch 1.2s cubic-bezier(.22,.8,.24,1) both; }
.work-company-create-card { width: min(100% - 32px,430px); margin: auto; border: 1px solid rgba(91,113,153,.14); border-radius: 28px; background: #fff; padding: 28px 22px; box-shadow: 0 24px 60px rgba(56,79,125,.12); animation: work-company-reveal .35s ease-out both; }
.work-company-name-field { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; min-height: 58px; border: 1px solid #d8e0ef; border-radius: 18px; background: #f8faff; padding: 0 16px; }
.work-company-name-field input { min-width: 0; border: 0; outline: 0; background: transparent; color: #24334f; font-size: 18px; }
.work-company-name-field span { color: #7a879e; font-size: 14px; }
.work-company-create-button { width: 100%; min-height: 52px; border: 0; border-radius: 18px; background: #306fe6; color: #fff; font-weight: 800; }
.work-company-create-button:disabled { background: #d9e0ec; color: #8c97a9; }
.work-company-plaque { padding: 18px 26px; border-radius: 20px; background: #fff; color: #24334f; font-family: Georgia,"Songti SC",serif; font-size: 24px; box-shadow: 0 18px 48px rgba(39,61,105,.18); animation: work-company-enter 1.4s cubic-bezier(.22,.78,.22,1) both; }
@keyframes work-company-launch { 0% { opacity: 0; transform: translateY(18px) scale(.82); } 55% { opacity: 1; transform: translateY(0) scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
@keyframes work-company-reveal { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes work-company-enter { 0% { opacity: 0; transform: translateY(24px) scale(.92); } 60% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-18px) scale(.86); } }
```

扩展已有减少动态效果媒体查询：

```css
@media (prefers-reduced-motion: reduce) {
  .work-company-launch-icon,.work-company-create-card,.work-company-plaque { animation-duration: .15s !important; transform: none !important; }
}
```

- [ ] **Step 4: 运行聚焦测试**

Run: `node --test src/work/workCompanyState.test.js src/work/WorkCompanyOnboarding.test.js src/work/workScreen.test.js`

Expected: 全部 PASS，0 FAIL。

- [ ] **Step 5: 提交集成与样式**

```bash
git add src/work/WorkAppScreen.jsx src/work/workScreen.test.js src/work/office.css
git commit -m "feat(work): gate office behind company creation"
```

---

### Task 4: 完整验证与移动端验收

**Files:**
- Verify only; no source changes expected.

**Interfaces:**
- Consumes: Tasks 1–3 的完整首次流程。
- Produces: 测试、构建和真实浏览器状态证据。

- [ ] **Step 1: 运行完整测试**

Run: `npm test`

Expected: 所有测试 PASS，0 FAIL。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite 输出 `✓ built`，退出码 0。

- [ ] **Step 3: 在 390×844 验证首次流程**

使用本地预览并清除 `ccatWorkCompanyV1`，确认：

1. 点击工作图标先看到启动动画。
2. 启动动画结束后看到创建公司页面。
3. 空输入时“创建公司”禁用。
4. 输入“星河设计事务所”后只保留“星河设计事”，显示长度提示，预览为“星河设计事有限公司”。
5. 点击创建后看到进入公司动画，再进入办公室。
6. `localStorage.ccatWorkCompanyV1` 包含有效 `version`, `prefix`, `fullName`, `createdAt`。

- [ ] **Step 4: 验证刷新、重开和动画跳过**

确认：

1. 刷新页面后打开工作 APP 直接进入办公室。
2. 返回主页再打开工作 APP 直接进入办公室。
3. 删除公司存储后，“跳过动画”只能跳到创建页面。
4. 创建后进入动画阶段关闭工作 APP，再打开时直接进入办公室。
5. 模拟 localStorage 写入失败时停留在创建页并显示“公司创建失败，请重试”。
6. 开启 `prefers-reduced-motion: reduce` 后只出现约 150 毫秒淡入淡出。

- [ ] **Step 5: 核对工作树**

Run: `git status --short && git log -4 --oneline`

Expected: 仅保留用户原有未跟踪设计素材；本功能源文件无未提交改动，最近提交包含三个功能提交和计划提交。
