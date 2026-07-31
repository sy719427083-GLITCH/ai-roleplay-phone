import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("microchat renders recent history and exposes incremental older messages", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");
  assert.match(app, /useState\(CHAT_HISTORY_PAGE_SIZE\)/);
  assert.match(app, /getVisibleChatHistory\(history, visibleMessageCount\)/);
  assert.match(app, /setVisibleMessageCount\(\(current\) => current \+ CHAT_HISTORY_PAGE_SIZE\)/);
  assert.match(app, /加载更早消息（剩余 \{hiddenCount\} 条）/);
  assert.match(styles, /\.chat-load-earlier\s*\{/);
});
