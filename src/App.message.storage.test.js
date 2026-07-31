import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("microchat startup storage writes cannot blank the app on quota errors", () => {
  const source = readFileSync("src/App.jsx", "utf8");
  assert.match(source, /tryWriteJson\(window\.localStorage, MESSAGE_STORAGE_KEY, messageState\)/);
  assert.match(source, /tryWriteValue\(window\.localStorage, MESSAGE_CHAT_ME_PROFILE_STORAGE_KEY, selectedChatMeId\)/);
  assert.match(source, /tryWriteJson\(\s*window\.localStorage,\s*PROACTIVE_MESSAGE_SETTINGS_STORAGE_KEY,\s*normalizeProactiveMessageSettings\(proactiveSettings\),?\s*\)/s);
  assert.match(source, /tryWriteJson\(window\.localStorage, MOMENTS_STORAGE_KEY, momentState\)/);
});
