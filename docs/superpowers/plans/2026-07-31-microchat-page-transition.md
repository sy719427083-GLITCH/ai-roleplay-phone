# 微聊会话页面丝滑过渡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为微聊会话列表与聊天页增加约 280ms 的微信式双向页面推进动画，同时保持消息加载、滚动与操作逻辑不变。

**Architecture:** `MessageAppScreen` 不再通过早返回瞬间替换整个页面，而是持续渲染会话列表层，并在选中会话时叠加聊天层。组件用 `list / entering / chat / leaving` 四态控制挂载、点击锁和退场清理；CSS 只动画 `transform`、`opacity` 与阴影，并为减少动态效果提供覆盖。

**Tech Stack:** React 19 hooks、CSS transforms/transitions、Node.js 内置 test runner、Vite 6

## Global Constraints

- 进入和返回都必须有平滑的双层推进动画。
- 动画时长为 `280ms`，缓动为 `cubic-bezier(0.32, 0.72, 0, 1)`。
- 动画不能延迟聊天内容挂载，不改变消息数据、API 对话或最近 120 条历史的分页逻辑。
- 快速连续点击期间不得叠加过渡或切错会话。
- 必须支持 `prefers-reduced-motion: reduce`。
- 不增加第三方动画依赖。

---

### Task 1: 建立双向过渡状态与双层页面结构

**Files:**
- Create: `src/App.message.transition.test.js`
- Modify: `src/App.jsx:3005-3225`
- Modify: `src/App.jsx:3880-4220`

**Interfaces:**
- Consumes: 现有 `chatId`、`openChat(character)`、`closeChat()`、`CHAT_HISTORY_PAGE_SIZE` 和聊天页/列表页 JSX。
- Produces: `chatTransition`（`list | entering | chat | leaving`）、`finishChatTransition(event?)`、`.message-navigation-stage`、`.message-list-layer`、`.message-chat-layer`。

- [ ] **Step 1: 写入失败的结构契约测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("microchat keeps list and chat layers mounted during push and pop transitions", () => {
  const app = readFileSync("src/App.jsx", "utf8");

  assert.match(app, /const CHAT_PAGE_TRANSITION_MS = 280;/);
  assert.match(app, /useState\("list"\)/);
  assert.match(app, /setChatTransition\("entering"\)/);
  assert.match(app, /setChatTransition\("chat"\)/);
  assert.match(app, /setChatTransition\("leaving"\)/);
  assert.match(app, /className={`message-navigation-stage is-\$\{chatTransition\}`}/);
  assert.match(app, /className="full-page message-page wechat-page message-list-layer"/);
  assert.match(app, /className="full-page message-page chat-page message-chat-layer"/);
  assert.match(app, /onTransitionEnd=\{finishChatTransition\}/);
});

test("microchat transition guards repeated navigation and has a cleanup fallback", () => {
  const app = readFileSync("src/App.jsx", "utf8");

  assert.match(app, /if \(chatTransition !== "list"\) return;/);
  assert.match(app, /if \(chatTransition !== "chat"\) return;/);
  assert.match(app, /window\.setTimeout/);
  assert.match(app, /window\.clearTimeout/);
  assert.match(app, /event\.target !== event\.currentTarget/);
});
```

- [ ] **Step 2: 运行聚焦测试并确认失败**

Run: `node --test src/App.message.transition.test.js`

Expected: FAIL，首个缺失项为 `CHAT_PAGE_TRANSITION_MS` 或 `message-navigation-stage`。

- [ ] **Step 3: 在组件中加入过渡常量、状态、计时器和清理逻辑**

在 `MessageAppScreen` 之前加入常量，并在组件状态区加入四态状态与 refs：

```jsx
const CHAT_PAGE_TRANSITION_MS = 280;
const CHAT_PAGE_TRANSITION_FALLBACK_MS = CHAT_PAGE_TRANSITION_MS + 80;

function MessageAppScreen({ onClose, onUnreadChange }) {
  const [messageTab, setMessageTab] = useState("messages");
  const [messageBackTarget, setMessageBackTarget] = useState("");
  const [chatId, setChatId] = useState("");
  const [chatTransition, setChatTransition] = useState("list");
  // 保留其余现有 state
  const chatTransitionTimerRef = useRef(null);
  const chatTransitionFrameRef = useRef(null);
```

加入统一清理、进入帧切换、返回兜底和卸载清理：

```jsx
  const clearChatTransitionSchedule = () => {
    if (chatTransitionTimerRef.current) {
      window.clearTimeout(chatTransitionTimerRef.current);
      chatTransitionTimerRef.current = null;
    }
    if (chatTransitionFrameRef.current) {
      window.cancelAnimationFrame(chatTransitionFrameRef.current);
      chatTransitionFrameRef.current = null;
    }
  };

  const finishChatTransition = (event) => {
    if (event && event.target !== event.currentTarget) return;
    if (event && event.propertyName !== "transform") return;
    if (chatTransition === "leaving") {
      clearChatTransitionSchedule();
      setVisibleMessageCount(CHAT_HISTORY_PAGE_SIZE);
      setChatId("");
      setChatTransition("list");
    }
  };

  useEffect(() => () => clearChatTransitionSchedule(), []);
```

将 `openChat` 和 `closeChat` 改成下面的受控过程；聊天数据先挂载，下一帧才从初始位置推进，退场结束后才清除 `chatId`：

```jsx
  const openChat = (character) => {
    if (!character?.id || chatTransition !== "list") return;
    setMessageState((current) => markConversationRead(createConversationForCharacter(current, character), character.id));
    setSwipedId("");
    setVisibleMessageCount(CHAT_HISTORY_PAGE_SIZE);
    setChatId(character.id);
    setChatTransition("entering");
    chatTransitionFrameRef.current = window.requestAnimationFrame(() => {
      chatTransitionFrameRef.current = window.requestAnimationFrame(() => {
        chatTransitionFrameRef.current = null;
        setChatTransition("chat");
      });
    });
  };

  const closeChat = () => {
    if (chatTransition !== "chat") return;
    setProactiveSettingsOpen(false);
    setActionPanelOpen(false);
    setChatTransition("leaving");
    clearChatTransitionSchedule();
    chatTransitionTimerRef.current = window.setTimeout(() => {
      chatTransitionTimerRef.current = null;
      setVisibleMessageCount(CHAT_HISTORY_PAGE_SIZE);
      setChatId("");
      setChatTransition("list");
    }, CHAT_PAGE_TRANSITION_FALLBACK_MS);
  };
```

- [ ] **Step 4: 将原来的早返回重构为持续存在的双层舞台**

将 `const activeCharacter ...` 后的 `if (activeCharacter) {` 改为 `const renderChatPage = () => { if (!activeCharacter) return null;`。保留现有 history、visibleHistory、activeTransferMessage 计算及所有聊天子节点，只把聊天页开始标签替换为：

```jsx
  const renderChatPage = () => {
    if (!activeCharacter) return null;
    const history = messageState.histories[chatId] || [];
    const { messages: visibleHistory, hiddenCount } = getVisibleChatHistory(history, visibleMessageCount);
    const activeTransferMessage = history.find((message) => message.id === activeTransferMessageId && message.kind === "transfer");

    return (
      <section
        className="full-page message-page chat-page message-chat-layer"
        onTransitionEnd={finishChatTransition}
        aria-hidden={chatTransition === "entering" || chatTransition === "leaving"}
      >
```

聊天页当前末尾的：

```jsx
      </section>
    );
  };
```

紧接着把列表页的 `return (` 改为 `const renderMessageListPage = () => (`，并把列表页开始标签替换为：

```jsx
  const renderMessageListPage = () => (
    <section className="full-page message-page wechat-page message-list-layer">
```

保留该 section 现有全部子节点。在列表页 section 的 `);` 后追加唯一的最终返回：

```jsx
  return (
    <div className={`message-navigation-stage is-${chatTransition}`}>
      {renderMessageListPage()}
      {renderChatPage()}
    </div>
  );
```

- [ ] **Step 5: 运行聚焦测试并确认通过**

Run: `node --test src/App.message.transition.test.js src/App.message.performance.test.js`

Expected: 3 tests PASS；最近 120 条历史的契约测试仍通过。

- [ ] **Step 6: 提交状态与结构改动**

```bash
git add src/App.jsx src/App.message.transition.test.js
git commit -m "feat(messages): add layered chat navigation state"
```

---

### Task 2: 实现微信式合成层动画与减少动态效果

**Files:**
- Modify: `src/App.message.transition.test.js`
- Modify: `src/styles.css:3362-3383`
- Modify: `src/styles.css:3898-3908`
- Modify: `src/styles.css:7596-末尾媒体查询`

**Interfaces:**
- Consumes: Task 1 产出的 `.message-navigation-stage`、`.message-list-layer`、`.message-chat-layer` 和 `is-*` 状态 class。
- Produces: 进入/返回双向 `280ms` 动画、过渡期点击锁、减少动态效果覆盖。

- [ ] **Step 1: 扩充测试，锁定动画参数和无障碍覆盖**

在 `src/App.message.transition.test.js` 追加：

```js
test("microchat page transition uses compositor-friendly motion and reduced-motion fallback", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  assert.match(styles, /\.message-chat-layer\s*\{[\s\S]*transform: translate3d\(100%, 0, 0\)/);
  assert.match(styles, /transition: transform 280ms cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
  assert.match(styles, /\.message-navigation-stage\.is-chat \.message-list-layer/);
  assert.match(styles, /pointer-events: none/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.message-chat-layer/);
});
```

- [ ] **Step 2: 运行聚焦测试并确认新增断言失败**

Run: `node --test src/App.message.transition.test.js`

Expected: FAIL，缺少 `.message-chat-layer` 的 `translate3d` 或 280ms transition。

- [ ] **Step 3: 添加舞台、列表层和聊天层动画样式**

在微聊样式区域加入：

```css
.message-navigation-stage {
  position: fixed;
  z-index: 30;
  inset: 0;
  overflow: hidden;
  background: #ffffff;
  isolation: isolate;
}

.message-navigation-stage .message-page {
  position: absolute;
  inset: 0;
}

.message-list-layer {
  z-index: 1;
  transform: translate3d(0, 0, 0);
  opacity: 1;
  will-change: transform, opacity;
  transition:
    transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 280ms cubic-bezier(0.32, 0.72, 0, 1);
}

.message-chat-layer {
  z-index: 2;
  transform: translate3d(100%, 0, 0);
  box-shadow: -18px 0 36px rgba(24, 32, 42, 0.12);
  will-change: transform;
  pointer-events: none;
  transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
}

.message-navigation-stage.is-chat .message-list-layer {
  transform: translate3d(-18%, 0, 0);
  opacity: 0.94;
}

.message-navigation-stage.is-chat .message-chat-layer {
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}

.message-navigation-stage.is-entering .message-list-layer,
.message-navigation-stage.is-leaving .message-list-layer,
.message-navigation-stage.is-entering .message-chat-layer,
.message-navigation-stage.is-leaving .message-chat-layer {
  pointer-events: none;
}
```

`entering` 保持聊天页位于右侧；双 `requestAnimationFrame` 切换到 `chat` 后触发进入。`leaving` 恢复初始样式并触发反向退出。

- [ ] **Step 4: 在现有减少动态效果媒体查询中加入微聊覆盖**

```css
@media (prefers-reduced-motion: reduce) {
  .message-list-layer,
  .message-chat-layer {
    transition-duration: 1ms !important;
  }

  .message-navigation-stage.is-chat .message-list-layer {
    transform: none;
    opacity: 1;
  }
}
```

- [ ] **Step 5: 运行聚焦测试并确认通过**

Run: `node --test src/App.message.transition.test.js src/App.message.performance.test.js`

Expected: 4 tests PASS。

- [ ] **Step 6: 提交动画样式**

```bash
git add src/styles.css src/App.message.transition.test.js
git commit -m "feat(messages): animate chat page push and pop"
```

---

### Task 3: 回归验证与手机尺寸视觉检查

**Files:**
- Modify: `src/App.jsx`（仅在验证发现过渡事件目标或状态清理问题时）
- Modify: `src/styles.css`（仅在 390×844 视觉检查发现溢出或层级问题时）
- Modify: `src/App.message.transition.test.js`（仅为复现验证发现的问题添加断言时）

**Interfaces:**
- Consumes: Task 1 和 Task 2 完成的过渡结构与样式。
- Produces: 通过完整测试、生产构建和 390×844 浏览器验证的功能。

- [ ] **Step 1: 运行完整测试**

Run: `npm test`

Expected: 所有测试 PASS，现有测试数量基础上新增 3 个页面过渡测试。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite build 成功，`dist/` 生成新的 JS/CSS bundle，无 error。

- [ ] **Step 3: 在 390×844 视口进行浏览器检查**

Run: `npm run dev`

在浏览器中使用 `390 × 844` 视口依次验证：点击任一会话、动画完成后发送区可用、点击返回、进入另一会话、快速连点、加载更早消息。预期聊天页由右向左推进，列表轻微后退；返回完整反向播放；无横向滚动条、白屏、误触或错误会话。

- [ ] **Step 4: 检查减少动态效果**

在浏览器模拟 `prefers-reduced-motion: reduce`，再次进入和返回会话。预期切换接近即时完成，页面不会停在 `entering` 或 `leaving` 状态。

- [ ] **Step 5: 检查工作树并提交必要修正**

Run: `git status --short`

Expected: 仅保留用户原有的未跟踪 `artifacts/` 与 `designs/` 文件；若步骤 3 或 4 产生了代码修正，则运行聚焦测试、`npm test` 和 `npm run build` 后单独提交：

```bash
git add src/App.jsx src/styles.css src/App.message.transition.test.js
git commit -m "fix(messages): harden chat page transitions"
```

若没有修正，则不创建空提交。
