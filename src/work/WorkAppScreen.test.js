import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const screenPath = new URL("./WorkAppScreen.jsx", import.meta.url);
const screenExists = existsSync(screenPath);
const source = screenExists ? readFileSync(screenPath, "utf8") : "";
const assignmentFlowPath = new URL("./OfficeAssignmentFlow.jsx", import.meta.url);
const assignmentFlowSource = existsSync(assignmentFlowPath)
  ? readFileSync(assignmentFlowPath, "utf8")
  : "";
const activityPanelPath = new URL("./OfficeActivityPanel.jsx", import.meta.url);
const activityPanelSource = existsSync(activityPanelPath)
  ? readFileSync(activityPanelPath, "utf8")
  : "";
const screenAndPanelsSource = `${source}\n${assignmentFlowSource}\n${activityPanelSource}`;
const characterSource = readFileSync(new URL("./OfficeCharacter.jsx", import.meta.url), "utf8");
const sceneSource = readFileSync(new URL("./OfficeScene.jsx", import.meta.url), "utf8");
const characterAndSceneSource = `${characterSource}\n${sceneSource}`;
const cssSource = readFileSync(new URL("./office.css", import.meta.url), "utf8");
const vite = await createServer({
  appType: "custom",
  configFile: false,
  logLevel: "silent",
  root: fileURLToPath(new URL("../..", import.meta.url)),
  server: { middlewareMode: true },
});
const screenModule = await vite.ssrLoadModule("/src/work/WorkAppScreen.jsx");
const activityPanelModule = await vite.ssrLoadModule("/src/work/OfficeActivityPanel.jsx");
const characterModule = await vite.ssrLoadModule("/src/work/OfficeCharacter.jsx");
const sceneModule = await vite.ssrLoadModule("/src/work/OfficeScene.jsx");
const previousReact = globalThis.React;
globalThis.React = React;

after(async () => {
  globalThis.React = previousReact;
  await vite.close();
});

test("ships the Work app screen with the required public controls", () => {
  assert.ok(screenExists, "WorkAppScreen.jsx must exist");
  assert.match(source, /export default function WorkAppScreen\(\{ onClose \}\)/);
  for (const label of ["工作剩余", "认真干活", "自由行动", "休息一下", "开会"]) {
    assert.ok(source.includes(label), `missing visible control: ${label}`);
  }
  assert.match(screenAndPanelsSource, /ArrowLeft/);
  assert.match(screenAndPanelsSource, /Users/);
  assert.match(screenAndPanelsSource, /Upload/);
  assert.match(screenAndPanelsSource, /Link/);
  assert.match(screenAndPanelsSource, /X/);
});

test("ships safe-area tools assignment back navigation and activity history", () => {
  for (const token of [
    "Ellipsis", "活动记录", "OfficeActivityPanel", "OfficeAssignmentFlow",
    "assignmentView", "selectedAssignmentSlotId", "requestOfficeActivityDetail",
    "activityControllersRef", "requestAnimationFrame",
  ]) assert.ok(source.includes(token), `missing Work screen wiring: ${token}`);
  assert.doesNotMatch(source, /ROUTE_STEP_MS/);
  assert.doesNotMatch(source, /setInterval\(advanceRoutes/);
});

test("implements two-level assignments with five slots and eight role-compatible chibis", () => {
  for (const token of [
    "返回办公室", "返回员工安排", "selectedSlotId", "onOpenSlot",
    "onProfileChange", "onChibiChange", "onUpload", "onCustomDraftChange",
    "OFFICE_CHIBIS", "compatibleChibis", "slice(0, 8)",
  ]) assert.ok(assignmentFlowSource.includes(token), `missing assignment flow: ${token}`);
  assert.match(assignmentFlowSource, /slots\.map/);
  assert.match(source, /view=\{assignmentView\}/);
  assert.match(source, /selectedSlotId=\{selectedAssignmentSlotId\}/);
});

test("filters current-session activity history and owns focus restoration", () => {
  for (const token of [
    "filterOfficeActivityEvents", "workSessionId", "全部", "进行中", "本地记录",
    "subject", "summary", "insightOrResult", "activityOpenerRef", "activityPanelOpen",
  ]) assert.ok(`${activityPanelSource}\n${source}`.includes(token), `missing activity panel: ${token}`);
  assert.match(activityPanelSource, /startedAt/);
  assert.match(activityPanelSource, /onKeyDown/);
  assert.match(source, /aria-expanded=\{activityPanelOpen\}/);
});

test("activity history renders stored snapshots without relabeling old events", () => {
  const markup = renderToStaticMarkup(React.createElement(activityPanelModule.default, {
    open: true,
    workSessionId: "session-current",
    assignments: {
      employee1: { profile: { name: "现在的角色" } },
    },
    events: [{
      eventId: "event-current",
      workSessionId: "session-current",
      actorId: "employee1",
      profileSnapshots: [{ name: "活动时的角色", personality: "沉静" }],
      activityType: "reading",
      status: "看书中",
      startedAt: 200,
      endedAt: 300,
      detailStatus: "fallback",
    }, {
      eventId: "event-foreign",
      workSessionId: "session-old",
      actorId: "employee1",
      profileSnapshots: [{ name: "旧会话角色" }],
      activityType: "working",
      startedAt: 400,
      endedAt: 500,
    }],
    onClose() {},
  }));

  assert.match(markup, /<strong>活动时的角色<\/strong>/);
  assert.doesNotMatch(markup, /<strong>现在的角色<\/strong>|旧会话角色/);
  assert.match(markup, /本地记录/);
});

test("creates authoritative events and completes exact route and activity lifecycles", () => {
  for (const token of [
    "createOfficeActivityEvent", "createOfficeProfileSnapshot", "CREATE_ACTIVITY_EVENT",
    "ENRICH_ACTIVITY_EVENT", "COMPLETE_ACTIVITY_EVENT", "sampleOfficeRoute",
    "completedRouteKeysRef", "COMPLETE_ROUTE", "activityCounterRef",
  ]) assert.ok(source.includes(token), `missing office runtime: ${token}`);
  for (const activity of [
    "working", "slacking", "gaming", "reading", "watchingSeries", "watchingShortVideo",
  ]) assert.ok(source.includes(`\"${activity}\"`), `missing desk runtime activity: ${activity}`);
  assert.match(source, /apiMeProfiles/);
  assert.match(source, /apiCharacters/);
  assert.match(source, /apiRelations/);
});

test("keeps safe-area tools as overlays without moving scene geometry", () => {
  assert.match(cssSource, /\.work-app-header\s*\{[^}]*position:\s*absolute[^}]*top:\s*var\(--app-safe-top-clearance\)[^}]*height:\s*52px[^}]*grid-template-columns:\s*48px minmax\(0, 1fr\) 44px 44px/s);
  assert.match(cssSource, /\.work-mode-control\s*\{[^}]*position:\s*absolute[^}]*top:\s*calc\(var\(--app-safe-top-clearance\) \+ 52px\)[^}]*height:\s*48px/s);
  assert.match(cssSource, /\.work-office-surface\s*\{[^}]*position:\s*absolute[^}]*inset:\s*100px 0 0/s);
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
    "COMPLETE_ROUTE",
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
  assert.match(screenAndPanelsSource, /data:image\//);
  assert.match(screenAndPanelsSource, /accept="image\/\*"/);
  assert.match(source, /customAssetSrc:\s*""/);
});

test("cycles chibi radios and wraps modal focus with pure keyboard helpers", () => {
  const { getNextOfficeRadioIndex, getOfficeFocusTrapIndex } = screenModule;
  assert.equal(typeof getNextOfficeRadioIndex, "function");
  assert.equal(typeof getOfficeFocusTrapIndex, "function");

  assert.equal(getNextOfficeRadioIndex(0, "ArrowLeft", 4), 3);
  assert.equal(getNextOfficeRadioIndex(3, "ArrowRight", 4), 0);
  assert.equal(getNextOfficeRadioIndex(2, "ArrowUp", 4), 1);
  assert.equal(getNextOfficeRadioIndex(2, "ArrowDown", 4), 3);
  assert.equal(getNextOfficeRadioIndex(2, "Home", 4), 0);
  assert.equal(getNextOfficeRadioIndex(1, "End", 4), 3);
  assert.equal(getNextOfficeRadioIndex(1, "Enter", 4), -1);

  assert.equal(getOfficeFocusTrapIndex(0, 4, true), 3);
  assert.equal(getOfficeFocusTrapIndex(3, 4, false), 0);
  assert.equal(getOfficeFocusTrapIndex(-1, 4, false), 0);
  assert.equal(getOfficeFocusTrapIndex(-1, 4, true), 3);
  assert.equal(getOfficeFocusTrapIndex(1, 4, false), null);
  assert.equal(getOfficeFocusTrapIndex(0, 0, false), -1);
});

test("rejects non-images and oversized files before FileReader work starts", () => {
  const { MAX_CUSTOM_IMAGE_BYTES, validateOfficeImageFile } = screenModule;
  assert.equal(MAX_CUSTOM_IMAGE_BYTES, 1024 * 1024);
  assert.equal(typeof validateOfficeImageFile, "function");

  assert.deepEqual(validateOfficeImageFile({ type: "image/png", size: MAX_CUSTOM_IMAGE_BYTES }), {
    ok: true,
    reason: "",
  });
  assert.deepEqual(validateOfficeImageFile({ type: "text/plain", size: 10 }), {
    ok: false,
    reason: "invalid-type",
  });
  assert.deepEqual(validateOfficeImageFile({ type: "image/jpeg", size: MAX_CUSTOM_IMAGE_BYTES + 1 }), {
    ok: false,
    reason: "too-large",
  });
});

test("keeps the current assignment when localStorage persistence fails", () => {
  const { commitOfficeAssignments } = screenModule;
  assert.equal(typeof commitOfficeAssignments, "function");
  const currentAssignments = { employee1: { profileId: "old", customAssetSrc: "" } };
  const nextAssignments = { employee1: { profileId: "old", customAssetSrc: "data:image/png;base64,new" } };
  const throwingStorage = { setItem: () => { throw new Error("quota"); } };

  const failed = commitOfficeAssignments(throwingStorage, currentAssignments, nextAssignments);
  assert.equal(failed.ok, false);
  assert.strictEqual(failed.assignments, currentAssignments);

  const unavailable = commitOfficeAssignments(undefined, currentAssignments, nextAssignments);
  assert.equal(unavailable.ok, false);
  assert.strictEqual(unavailable.assignments, currentAssignments);

  let persistedKey = "";
  let persistedValue = "";
  const workingStorage = {
    setItem: (key, value) => {
      persistedKey = key;
      persistedValue = value;
    },
  };
  const saved = commitOfficeAssignments(workingStorage, currentAssignments, nextAssignments);
  assert.equal(saved.ok, true);
  assert.strictEqual(saved.assignments, nextAssignments);
  assert.equal(persistedKey, "ccatOfficeAssignmentsV1");
  assert.equal(JSON.parse(persistedValue).employee1.customAssetSrc, "data:image/png;base64,new");
});

test("owns one upload reader per slot and aborts stale or unmounted work", () => {
  const { createOfficeUploadReaderRegistry } = screenModule;
  assert.equal(typeof createOfficeUploadReaderRegistry, "function");
  const registry = createOfficeUploadReaderRegistry();
  const first = { abortCount: 0, abort() { this.abortCount += 1; } };
  const second = { abortCount: 0, abort() { this.abortCount += 1; } };
  const other = { abortCount: 0, abort() { this.abortCount += 1; } };

  registry.start("employee1", first);
  registry.start("employee1", second);
  registry.start("employee2", other);

  assert.equal(first.abortCount, 1);
  assert.equal(registry.isCurrent("employee1", first), false);
  assert.equal(registry.isCurrent("employee1", second), true);
  assert.equal(registry.finish("employee1", first), false);
  assert.equal(registry.isCurrent("employee1", second), true);

  registry.abortAll();
  assert.equal(second.abortCount, 1);
  assert.equal(other.abortCount, 1);
  assert.equal(registry.isCurrent("employee1", second), false);
});

test("renders every concrete office action from the authoritative event", () => {
  for (const token of [
    "BookProps", "SeriesProps", "ShortVideoProps", "MealProps", "GameProps",
    "activityEvent", "sampleOfficeRoute", "motionNow", "getWalkFrame",
  ]) assert.ok(characterAndSceneSource.includes(token), `missing ${token}`);
});

test("removes hard route-step and bubble-clamp rendering", () => {
  assert.doesNotMatch(characterAndSceneSource, /routeStepDurationMs/);
  assert.match(cssSource, /overflow-wrap:\s*anywhere/);
  assert.match(cssSource, /word-break:\s*break-word/);
  assert.doesNotMatch(cssSource, /-webkit-line-clamp/);
});

test("renders active props and atlas frames only for an exact owned activity event", () => {
  const character = {
    slotId: "employee1",
    phase: "reading",
    activity: "reading",
    status: "看书中",
    positionNode: "employee1-home",
    profile: { name: "小林" },
  };
  const assignment = { chibiId: "employee-f-01" };
  const renderCharacter = (activityEvent) => renderToStaticMarkup(React.createElement(
    characterModule.OfficeCharacter,
    { character, assignment, activityEvent, motionNow: 720 },
  ));

  for (const markup of [
    renderCharacter(null),
    renderCharacter({
      eventId: "event-other",
      actorId: "employee2",
      activityType: "reading",
      status: "看书中",
      subject: "不属于小林的书",
      propVariant: "hardcover",
    }),
  ]) {
    assert.match(markup, /data-activity="idle"/);
    assert.match(markup, /--office-frame-row:7/);
    assert.doesNotMatch(markup, /office-book-prop/);
    assert.match(markup, /小林，空闲中/);
    assert.doesNotMatch(markup, /正在阅读|看书中/);
  }

  const ownedMarkup = renderCharacter({
    eventId: "event-owned",
    actorId: "employee1",
    activityType: "reading",
    status: "看书中",
    subject: "《沉思录》",
    propVariant: "hardcover",
  });
  assert.match(ownedMarkup, /data-activity="reading"/);
  assert.match(ownedMarkup, /--office-frame-row:5/);
  assert.match(ownedMarkup, /office-book-prop/);
  assert.match(ownedMarkup, /正在阅读《沉思录》/);
});

test("clamps the final five-member bubble center after every placement offset", () => {
  const { getClampedBubbleLayout } = sceneModule;
  assert.equal(typeof getClampedBubbleLayout, "function");

  const minimumCenter = 12 + 90;
  const maximumCenter = 390 - minimumCenter;
  for (const [groupIndex, x, bubbleOffsetPx, bubbleMemberOffsetPx, boundary] of [
    [0, 12, -62, 19, minimumCenter],
    [4, 88, 62, -19, maximumCenter],
  ]) {
    const layout = getClampedBubbleLayout({
      x,
      y: 50,
      groupCount: 5,
      groupIndex,
      bubbleOffsetPx,
      bubbleMemberOffsetPx,
    });
    const finalCenter = (layout.x * 3.9) + layout.bubbleOffsetPx;
    assert.ok(finalCenter >= minimumCenter, `${groupIndex} crossed the left gutter`);
    assert.ok(finalCenter <= maximumCenter, `${groupIndex} crossed the right gutter`);
    assert.equal(Math.round(finalCenter * 10) / 10, boundary);
    assert.equal(layout.bubbleMemberOffsetPx, 0);
  }

  assert.doesNotMatch(cssSource, /data-group-count="5"/);
});
