import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { getSceneAnchor } from "./officeSceneManifest.js";
import { createOfficeState, officeReducer } from "./officeState.js";
import { buildWorldRoute, sampleWorldRoute } from "./officeWorld.js";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

const screenPath = new URL("./WorkAppScreen.jsx", import.meta.url);
const source = existsSync(screenPath) ? readFileSync(screenPath, "utf8") : "";
const sceneSource = readFileSync(new URL("./OfficeScene.jsx", import.meta.url), "utf8");
const assignmentFlowSource = readFileSync(new URL("./OfficeAssignmentFlow.jsx", import.meta.url), "utf8");
const conversationPanelPath = new URL("./OfficeConversationPanel.jsx", import.meta.url);
const conversationPanelSource = existsSync(conversationPanelPath) ? readFileSync(conversationPanelPath, "utf8") : "";
const cssSource = readFileSync(new URL("./office.css", import.meta.url), "utf8");
const vite = await createServer({
  appType: "custom",
  configFile: false,
  logLevel: "silent",
  root: fileURLToPath(new URL("../..", import.meta.url)),
  server: { middlewareMode: true },
});
const screenModule = await vite.ssrLoadModule("/src/work/WorkAppScreen.jsx");
const sceneModule = await vite.ssrLoadModule("/src/work/OfficeScene.jsx");
const assignmentFlowModule = await vite.ssrLoadModule("/src/work/OfficeAssignmentFlow.jsx");
const previousReact = globalThis.React;
globalThis.React = React;

after(async () => {
  globalThis.React = previousReact;
  await vite.close();
});

const assignments = Object.fromEntries([
  ["boss", "老板"],
  ["employee1", "员工一"],
  ["employee2", "员工二"],
  ["employee3", "员工三"],
  ["employee4", "员工四"],
].map(([slotId, name]) => [slotId, {
  profileId: slotId,
  profile: { id: slotId, name, personality: `${name}性格` },
  chibiId: slotId === "boss" ? "boss-f-01" : "employee-f-01",
  customAssetSrc: "",
}]));

const pointAt = (sceneId, anchorId) => {
  const anchor = getSceneAnchor(sceneId, anchorId);
  return { sceneId, x: anchor.x, y: anchor.y };
};

test("keeps the public Work controls and assignment workflow intact", () => {
  assert.match(source, /export default function WorkAppScreen\(\{ onClose \}\)/);
  for (const label of ["工作剩余", "认真干活", "自由行动", "休息一下", "开会", "对话记录"]) {
    assert.ok(`${source}\n${conversationPanelSource}`.includes(label), `missing public control: ${label}`);
  }
  for (const token of ["ArrowLeft", "Ellipsis", "Users", "OfficeAssignmentFlow", "OfficeConversationPanel"]) {
    assert.ok(source.includes(token), `missing Work screen wiring: ${token}`);
  }
  assert.doesNotMatch(source, /OfficeActivityPanel|activityEvents|activeEventBySlot/u);
  assert.doesNotMatch(conversationPanelSource, /本地记录|按角色筛选|按活动筛选/u);
  for (const token of ["onProfileChange", "onChibiChange", "onUpload", "onCustomDraftChange", "OFFICE_CHIBIS"]) {
    assert.ok(assignmentFlowSource.includes(token), `missing assignment behavior: ${token}`);
  }
});

test("consumes the exact physical scheduler contract and render-drives every actor", () => {
  assert.equal(typeof screenModule.createPhysicalSchedulerRuntime, "function");
  const actorIds = ["employee1", "employee2"];
  const targetAnchors = ["dining:seat-1", "dining:seat-2"];
  const event = {
    activityId: "diningChat",
    actorIds,
    sceneId: "lounge",
    hostId: "employee1",
    visitorIds: ["employee2"],
    locationId: "dining",
    anchorByMember: { employee1: "dining:seat-1", employee2: "dining:seat-2" },
    targetAnchors,
    reservationGroupId: "office-diningChat-1000-employee1-employee2",
    routesByActor: Object.fromEntries(actorIds.map((slotId, index) => [slotId, buildWorldRoute({
      from: pointAt("office", `${slotId}:seat-approach`),
      to: pointAt("lounge", targetAnchors[index]),
    })])),
    propState: { category: "conversation", variant: "meal", actorRoles: { employee1: "host", employee2: "visitor" } },
    semanticContext: {
      eventId: "office-diningChat-1000-employee1-employee2",
      activityId: "diningChat",
      status: "餐桌聊天中",
      semanticFallback: { subject: "用餐闲聊", summary: "交换近况", insightOrResult: "彼此了解" },
    },
    startedAt: 1_000,
    endsAt: 61_000,
  };

  const runtime = screenModule.createPhysicalSchedulerRuntime(event, assignments);
  assert.ok(runtime, "a valid forced scheduler event must not be silently ignored");
  assert.deepEqual(runtime.semanticEvent.profileSnapshots.map(({ id }) => id), actorIds);
  assert.equal(runtime.actions.length, 2);
  assert.deepEqual(runtime.actions.map(({ type, slotId, activityId }) => ({ type, slotId, activityId })), [
    { type: "START_WORLD_ROUTE", slotId: "employee1", activityId: "diningChat" },
    { type: "START_WORLD_ROUTE", slotId: "employee2", activityId: "diningChat" },
  ]);

  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  for (const action of runtime.actions) state = officeReducer(state, action);
  for (const slotId of actorIds) {
    const character = state.characters[slotId];
    assert.equal(character.phase, "walkingToActivity");
    assert.equal(character.reservationGroupId, event.reservationGroupId);
    const sample = sampleWorldRoute({ route: character.route, startedAt: character.routeStartedAt, now: 2_000, speed: 100 });
    assert.equal(sample.done, false);
    assert.notDeepEqual({ x: sample.x, y: sample.y }, character.position);
  }
});

test("starts only desk visitors and retains the host at its home anchor", () => {
  const event = {
    activityId: "chatting",
    actorIds: ["employee1", "employee2"],
    hostId: "employee1",
    visitorIds: ["employee2"],
    sceneId: "office",
    locationId: "employee1:desk",
    anchorByMember: { employee1: "employee1:seat-approach", employee2: "employee1:visitor-front" },
    targetAnchors: ["employee1:visitor-front"],
    reservationGroupId: "desk-chat",
    routesByActor: {
      employee2: buildWorldRoute({ from: pointAt("office", "employee2:seat-approach"), to: pointAt("office", "employee1:visitor-front") }),
    },
    propState: { category: "conversation", variant: "project", actorRoles: { employee1: "host", employee2: "visitor" } },
    semanticContext: { eventId: "desk-chat", activityId: "chatting", status: "交流中", semanticFallback: {} },
    startedAt: 1_000,
    endsAt: 61_000,
  };
  const runtime = screenModule.createPhysicalSchedulerRuntime(event, assignments);
  assert.equal(runtime.hostAction.type, "LOCK_CONVERSATION_HOST");
  assert.equal(runtime.hostAction.session.hostId, "employee1");
  assert.equal(runtime.hostAction.session.reservationGroupId, "desk-chat");
  assert.deepEqual(runtime.actions.map(({ slotId, targetAnchorId }) => ({ slotId, targetAnchorId })), [
    { slotId: "employee2", targetAnchorId: "employee1:visitor-front" },
  ]);
});

test("keeps ordinary physical activities independent from conversation location state", () => {
  const event = {
    activityId: "printing",
    actorIds: ["employee1"],
    sceneId: "office",
    targetAnchors: ["printer:front"],
    reservationGroupId: "office-printing-1000-employee1",
    routesByActor: {
      employee1: buildWorldRoute({ from: pointAt("office", "employee1:seat-approach"), to: pointAt("office", "printer:front") }),
    },
    propState: { category: "documents", variant: "printout", actorRoles: { employee1: "actor" } },
    semanticContext: { eventId: "office-printing-1000-employee1", activityId: "printing", status: "打印中", semanticFallback: {} },
    startedAt: 1_000,
    endsAt: 61_000,
  };

  const runtime = screenModule.createPhysicalSchedulerRuntime(event, assignments);
  assert.equal(runtime.hostAction, null);
  assert.deepEqual(runtime.actions.map(({ slotId }) => slotId), ["employee1"]);
});

test("rejects legacy scheduler aliases instead of reviving compatibility paths", () => {
  assert.equal(screenModule.createPhysicalSchedulerRuntime({
    slotId: "employee1",
    memberIds: ["employee1"],
    activity: "eating",
    route: ["employee1-home", "break-1"],
  }, assignments), null);
  for (const legacy of [
    /event\.slotId/u,
    /event\.memberIds/u,
    /event\.activity(?!Id)/u,
    /routesByMember/u,
    /START_ACTIVITY/u,
    /COMPLETE_ROUTE/u,
    /sampleOfficeRoute/u,
    /findOfficeRoute/u,
    /claimAnchor/u,
  ]) assert.doesNotMatch(source, legacy);
});

test("samples every actor on requestAnimationFrame and dispatches only meaningful transitions", () => {
  for (const token of [
    "requestAnimationFrame", "cancelAnimationFrame", "sampleWorldRoute", "START_WORLD_ROUTE",
    "ADVANCE_WORLD_ROUTE", "CROSS_SCENE_DOOR", "ARRIVE_ACTIVITY", "START_RETURN", "FINISH_RETURN",
    "routeTransitionKeysRef", "sampledWorldActors",
  ]) assert.ok(source.includes(token), `missing world runtime token: ${token}`);
  assert.match(source, /TICK_INTERVAL_MS\s*=\s*250/u);
  assert.match(source, /chooseOfficeEvent/u);
  assert.match(source, /SET_RESERVATIONS/u);
  assert.doesNotMatch(source, /dispatchOffice\([^)]*position[^)]*\)[\s\S]{0,80}requestAnimationFrame/u);
});

test("separates crossing frame samples before they reach Pixi", () => {
  assert.equal(typeof screenModule.samplePhysicalWorldFrame, "function");
  const characters = {
    employee1: {
      slotId: "employee1",
      sceneId: "office",
      position: { x: 500, y: 650 },
      phase: "walkingToActivity",
      route: [{ sceneId: "office", x: 500, y: 650 }, { sceneId: "office", x: 700, y: 650 }],
      routeStartedAt: 0,
      routeSpeed: 100,
    },
    employee2: {
      slotId: "employee2",
      sceneId: "office",
      position: { x: 700, y: 650 },
      phase: "walkingToActivity",
      route: [{ sceneId: "office", x: 700, y: 650 }, { sceneId: "office", x: 500, y: 650 }],
      routeStartedAt: 0,
      routeSpeed: 100,
    },
  };
  const frame = screenModule.samplePhysicalWorldFrame({ characters, now: 1_000 });
  assert.deepEqual({ x: frame.rawSamples.employee1.x, y: frame.rawSamples.employee1.y }, { x: 600, y: 650 });
  assert.deepEqual({ x: frame.rawSamples.employee2.x, y: frame.rawSamples.employee2.y }, { x: 600, y: 650 });
  assert.ok(Math.hypot(
    frame.renderSamples.employee1.x - frame.renderSamples.employee2.x,
    frame.renderSamples.employee1.y - frame.renderSamples.employee2.y,
  ) >= 52);

  const waitingCharacters = {
    employee1: { ...characters.employee1, position: { x: 520, y: 620 }, route: [{ sceneId: "office", x: 520, y: 620 }], routeStartedAt: 1 },
    employee2: { ...characters.employee2, position: { x: 540, y: 620 }, route: [{ sceneId: "office", x: 540, y: 620 }], routeStartedAt: 2 },
  };
  const waiting = screenModule.samplePhysicalWorldFrame({
    characters: waitingCharacters,
    now: 1_000,
    previousSamples: { employee2: { sceneId: "office", x: 600, y: 620 } },
  });
  assert.deepEqual(
    { x: waiting.renderSamples.employee2.x, y: waiting.renderSamples.employee2.y, waiting: waiting.renderSamples.employee2.waiting },
    { x: 600, y: 620, waiting: true },
  );
});

test("passes sampled positions directly into the Pixi world for hidden and visible scenes", () => {
  const sampledWorldActors = {
    employee1: { sceneId: "lounge", x: 132, y: 1712, facing: "right", segmentIndex: 8, done: false },
    employee2: { sceneId: "office", x: 790, y: 1000, facing: "left", segmentIndex: 1, done: false },
  };
  const state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  const world = sceneModule.buildOfficeWorld({ state, assignments, sampledWorldActors, motionNow: 1_500 });
  const employee1 = world.actors.find(({ id }) => id === "employee1");
  const employee2 = world.actors.find(({ id }) => id === "employee2");

  assert.deepEqual({ sceneId: employee1.sceneId, x: employee1.x, y: employee1.y, facing: employee1.facing }, {
    sceneId: "lounge", x: 132, y: 1712, facing: "right",
  });
  assert.deepEqual({ sceneId: employee2.sceneId, x: employee2.x, y: employee2.y, facing: employee2.facing }, {
    sceneId: "office", x: 790, y: 1000, facing: "left",
  });
  assert.match(source, /sampledWorldActors=\{sampledWorldActors\}/u);
  assert.match(sceneSource, /sampledWorldActors/u);
});

test("renders exact physical activity anchors and conversation bubbles", () => {
  const state = createOfficeState({ assignments, now: 720, durationMs: 60_000 });
  const readingAnchor = pointAt("office", "employee1:seat-approach");
  const activeState = {
    ...state,
    conversations: {
      chat: {
        id: "chat",
        memberIds: ["employee1", "employee2"],
        bubbleQueue: [{ conversationId: "chat", speakerId: "employee1", text: "只显示一次" }],
      },
    },
    characters: {
      ...state.characters,
      employee1: {
        ...state.characters.employee1,
        sceneId: "office",
        position: { x: readingAnchor.x, y: readingAnchor.y },
        targetAnchorId: "employee1:seat-approach",
        phase: "chatting",
        activity: "chatting",
        status: "交流中",
        conversationId: "chat",
      },
      employee2: {
        ...state.characters.employee2,
        phase: "chatting",
        activity: "chatting",
        status: "交流中",
        conversationId: "chat",
      },
    },
  };
  const world = sceneModule.buildOfficeWorld({ state: activeState, assignments, motionNow: 720 });
  const actor = world.actors.find(({ id }) => id === "employee1");
  assert.equal(actor.clip, "chatting");
  assert.deepEqual({ x: actor.x, y: actor.y }, { x: readingAnchor.x, y: readingAnchor.y });

  const markup = renderToStaticMarkup(React.createElement(sceneModule.OfficeScene, {
    state: activeState,
    assignments,
    motionNow: 720,
  }));
  assert.equal((markup.match(/office-actor-bubble/g) || []).length, 1);
  assert.equal((markup.match(/只显示一次/g) || []).length, 1);
});

test("renders the default two-person desk conversation facing each other with side-only clips", () => {
  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  const session = {
    id: "default-desk-chat",
    hostId: "employee1",
    visitorIds: ["employee2"],
    memberIds: ["employee1", "employee2"],
    sceneId: "office",
    locationId: "employee1:desk",
    activityId: "chatting",
    activityStatus: "交流中",
    reservationGroupId: "default-desk-group",
    anchorByMember: { employee1: "employee1:seat-approach", employee2: "employee1:visitor-right" },
    targetAnchorIds: ["employee1:visitor-right"],
    startedAt: 1_000,
    endsAt: 9_000,
  };
  const actorRoles = { employee1: "host", employee2: "visitor" };
  state = {
    ...state,
    reservations: {
      "employee1:visitor-right": {
        anchorId: "employee1:visitor-right",
        slotId: "employee1",
        reservationGroupId: "default-desk-group",
        sceneId: "office",
        expiresAt: 9_000,
      },
    },
  };
  state = officeReducer(state, { type: "LOCK_CONVERSATION_HOST", session });
  state = {
    ...state,
    characters: {
      ...state.characters,
      employee2: {
        ...state.characters.employee2,
        position: { ...getSceneAnchor("office", "employee1:visitor-right") },
        targetAnchorId: "employee1:visitor-right",
        phase: "chatting",
        activity: "chatting",
        reservationGroupId: "default-desk-group",
        propState: { category: "conversation", variant: "project", actorRoles },
      },
    },
  };
  state = officeReducer(state, { type: "OPEN_CONVERSATION", session });

  const world = sceneModule.buildOfficeWorld({ state, assignments, motionNow: 1_500 });
  const host = world.actors.find(({ id }) => id === "employee1");
  const visitor = world.actors.find(({ id }) => id === "employee2");
  assert.deepEqual({ clip: host.clip, facing: host.facing }, { clip: "chatting", facing: "right" });
  assert.deepEqual({ clip: visitor.clip, facing: visitor.facing }, { clip: "listening", facing: "left" });
});

test("preserves focus, animated upload validation, and assignment persistence helpers", () => {
  assert.equal(screenModule.getNextOfficeRadioIndex(0, "ArrowLeft", 4), 3);
  assert.equal(screenModule.getNextOfficeRadioIndex(3, "ArrowRight", 4), 0);
  assert.equal(screenModule.getOfficeFocusTrapIndex(0, 4, true), 3);
  assert.equal(screenModule.getOfficeFocusTrapIndex(3, 4, false), 0);
  assert.deepEqual(screenModule.validateOfficeAnimationFile({ type: "image/png", size: 20 }), {
    ok: false, reason: "still-image", manifest: null,
  });
  assert.deepEqual(screenModule.validateOfficeAnimationFile({ type: "application/json", size: screenModule.MAX_CUSTOM_ANIMATION_BYTES + 1 }), {
    ok: false, reason: "oversized", manifest: null,
  });

  const current = { employee1: assignments.employee1 };
  const next = { employee1: { ...assignments.employee1, customManifestUrl: "https://cdn.example/manifest.json" } };
  const failed = screenModule.commitOfficeAssignments({ setItem() { throw new Error("quota"); } }, current, next);
  assert.equal(failed.ok, false);
  assert.strictEqual(failed.assignments, current);
});

test("owns one upload reader per slot and aborts stale work", () => {
  const registry = screenModule.createOfficeUploadReaderRegistry();
  const first = { abortCount: 0, abort() { this.abortCount += 1; } };
  const second = { abortCount: 0, abort() { this.abortCount += 1; } };
  registry.start("employee1", first);
  registry.start("employee1", second);
  assert.equal(first.abortCount, 1);
  assert.equal(registry.isCurrent("employee1", second), true);
  registry.abortAll();
  assert.equal(second.abortCount, 1);
});

test("drops legacy still-image assignments instead of migrating image data URLs", () => {
  assert.equal(typeof screenModule.normalizeStoredAssignments, "function");
  const restored = screenModule.normalizeStoredAssignments({
    employee1: {
      chibiId: "employee-f-01",
      customAssetSrc: "data:image/png;base64,legacy",
      customManifestUrl: "https://cdn.example/portrait.webp",
    },
  }, { bossOptions: [], employeeOptions: [] });

  assert.equal(restored.employee1.customManifestUrl, "");
  assert.equal(restored.employee1.customAnimationManifest, null);
  assert.equal("customAssetSrc" in restored.employee1, false);
});

test("keeps safe-area overlays and pointer-safe Pixi actor overlays", () => {
  assert.match(cssSource, /\.work-app-header\s*\{[^}]*position:\s*absolute[^}]*top:\s*var\(--app-safe-top-clearance\)/su);
  assert.match(cssSource, /\.work-office-surface\s*\{[^}]*position:\s*absolute[^}]*inset:\s*100px 0 0/su);
  assert.match(cssSource, /\.office-scene-overlay\s*\{[^}]*pointer-events:\s*none/su);
  assert.match(cssSource, /\.office-actor-overlay\s*\{[^}]*pointer-events:\s*auto/su);
  assert.match(sceneSource, /OfficeCanvas/u);
  assert.match(sceneSource, /OfficeActorOverlay/u);
  assert.match(sceneSource, /onSceneChange/u);
  assert.match(assignmentFlowSource, /application\/json/u);
  assert.doesNotMatch(assignmentFlowSource, /accept="image\/\*"|图片 URL|自定义图片/u);
  assert.match(assignmentFlowSource, /accept="application\/json,application\/zip,\.json,\.zip"/u);
  assert.match(source, /fetchOfficeAnimationManifest/u);
  assert.match(source, /parseOfficeAnimationUpload/u);
  assert.match(source, /readAsArrayBuffer/u);
  assert.doesNotMatch(source, /data:image|validateOfficeImageFile/u);
  assert.doesNotMatch(sceneSource, /OFFICE_NODES|sampleOfficeRoute/u);
});
