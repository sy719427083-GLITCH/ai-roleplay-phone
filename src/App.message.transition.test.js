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

test("microchat page transition uses compositor-friendly motion and reduced-motion fallback", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  assert.match(styles, /\.message-chat-layer\s*\{[\s\S]*transform: translate3d\(100%, 0, 0\)/);
  assert.match(styles, /transition: transform 280ms cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
  assert.match(styles, /\.message-navigation-stage\.is-chat \.message-list-layer/);
  assert.match(styles, /pointer-events: none/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.message-chat-layer/);
});

test("microchat exposes only the active navigation layer to assistive technology", () => {
  const app = readFileSync("src/App.jsx", "utf8");

  assert.match(app, /inert=\{chatTransition !== "list"\}/);
  assert.match(app, /inert=\{chatTransition !== "chat"\}/);
});
