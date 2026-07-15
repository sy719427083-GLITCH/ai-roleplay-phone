import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const screenPath = new URL("./WorkAppScreen.jsx", import.meta.url);
const screenExists = existsSync(screenPath);
const source = screenExists ? readFileSync(screenPath, "utf8") : "";

test("ships the Work app screen with the required public controls", () => {
  assert.ok(screenExists, "WorkAppScreen.jsx must exist");
  assert.match(source, /export default function WorkAppScreen\(\{ onClose \}\)/);
  for (const label of ["工作剩余", "认真干活", "自由行动", "休息一下", "开会"]) {
    assert.ok(source.includes(label), `missing visible control: ${label}`);
  }
  assert.match(source, /ArrowLeft/);
  assert.match(source, /Users/);
  assert.match(source, /Upload/);
  assert.match(source, /Link/);
  assert.match(source, /X/);
});

test("owns persistent assignment and lifecycle reducer wiring", () => {
  assert.match(source, /OFFICE_ASSIGNMENT_KEY/);
  assert.match(source, /ccatOfficeStateV1/);
  assert.match(source, /normalizeOfficeAssignments/);
  assert.match(source, /useReducer\(officeReducer/);
  assert.match(source, /durationMs:\s*8\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(source, /TICK_INTERVAL_MS\s*=\s*250/);
  assert.match(source, /SCHEDULE_MIN_MS\s*=\s*4_000/);
  assert.match(source, /SCHEDULE_MAX_MS\s*=\s*8_000/);

  for (const action of [
    "ASSIGN_PROFILE",
    "SET_MODE",
    "SET_RESERVATIONS",
    "START_ACTIVITY",
    "ADVANCE_ROUTE",
    "ARRIVE_ACTIVITY",
    "START_RETURN",
    "FINISH_RETURN",
    "OPEN_CONVERSATION",
    "UPDATE_CONVERSATION_IO",
    "APPEND_CONVERSATION",
    "QUEUE_BUBBLE",
    "SHIFT_BUBBLE",
    "CLOSE_CONVERSATION",
  ]) {
    assert.ok(source.includes(`type: "${action}"`), `missing lifecycle action: ${action}`);
  }
});

test("keeps routes, conversation requests, and custom assets isolated", () => {
  assert.match(source, /findOfficeRoute/);
  assert.match(source, /new Map\(\)/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /requestSequence\s*\+\s*1/);
  assert.match(source, /conversationId/);
  assert.match(source, /requestOfficeConversationTurn/);
  assert.match(source, /data:image\//);
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /customAssetSrc:\s*""/);
});
