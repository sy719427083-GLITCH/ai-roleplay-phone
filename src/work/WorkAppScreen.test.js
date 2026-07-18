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
const assignmentFlowModule = await vite.ssrLoadModule("/src/work/OfficeAssignmentFlow.jsx");
const activitiesModule = await vite.ssrLoadModule("/src/work/officeActivities.js");
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

test("uses a 320ms active atlas cadence", () => {
  assert.match(
    characterSource,
    /const getActiveFrame = \(motionNow\) => Math\.floor\(Math\.max\(0, Number\(motionNow\) \|\| 0\) \/ 320\) % 4;/,
  );
});

test("removes legacy DOM sprite and activity-prop CSS while keeping a pointer-safe overlay", () => {
  for (const legacySelector of [
    "office-character", "office-activity-prop", "office-module-layer", "office-scene-background",
  ]) assert.doesNotMatch(cssSource, new RegExp(legacySelector));
  assert.match(cssSource, /\.office-scene-overlay\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(cssSource, /\.office-actor-overlay\s*\{[^}]*pointer-events:\s*auto/s);
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

test("shares one conversation event with exact participants across rendering and filters", () => {
  assert.equal(typeof sceneModule.resolveOfficeActivityEventForCharacter, "function");
  const sharedEvent = {
    eventId: "event-conversation-a",
    actorId: "employee1",
    participantIds: ["employee1", "employee2"],
    activityType: "chatting",
    conversationId: "conversation-a",
    status: "闲聊中",
    subject: "周末安排",
    startedAt: 200,
  };
  const simultaneousEvent = {
    ...sharedEvent,
    eventId: "event-conversation-b",
    actorId: "employee3",
    participantIds: ["employee3", "employee4"],
    conversationId: "conversation-b",
  };
  const activityEvents = [sharedEvent, simultaneousEvent];
  const activeEventBySlot = {
    employee1: sharedEvent.eventId,
    employee3: simultaneousEvent.eventId,
  };
  const resolve = (slotId, conversationId) => sceneModule.resolveOfficeActivityEventForCharacter({
    slotId,
    character: { slotId, conversationId },
    activityEvents,
    activeEventBySlot,
  });

  assert.strictEqual(resolve("employee1", "conversation-a"), sharedEvent);
  assert.strictEqual(resolve("employee2", "conversation-a"), sharedEvent);
  assert.strictEqual(resolve("employee4", "conversation-b"), simultaneousEvent);
  assert.equal(resolve("employee2", "conversation-b"), null);
  assert.equal(resolve("employee4", "conversation-a"), null);
  const ownerMissingMembership = { ...sharedEvent, participantIds: ["employee2"] };
  assert.equal(sceneModule.resolveOfficeActivityEventForCharacter({
    slotId: "employee1",
    character: { slotId: "employee1", conversationId: "conversation-a" },
    activityEvents: [ownerMissingMembership],
    activeEventBySlot: { employee1: ownerMissingMembership.eventId },
  }), null);

  const conversation = {
    id: "conversation-a",
    memberIds: ["employee1", "employee2"],
    bubbleQueue: [{
      conversationId: "conversation-a",
      speakerId: "employee1",
      text: "周末去看展吗？",
    }],
  };
  const renderChatMember = (slotId, activityEvent = sharedEvent) => renderToStaticMarkup(
    React.createElement(characterModule.OfficeCharacter, {
      character: {
        slotId,
        phase: "chatting",
        activity: "chatting",
        conversationId: "conversation-a",
        positionNode: `${slotId}-home`,
        profile: { name: slotId },
      },
      assignment: { chibiId: "employee-f-01" },
      activityEvent,
      conversation,
      motionNow: 720,
    }),
  );
  const speakerMarkup = renderChatMember("employee1");
  const listenerMarkup = renderChatMember("employee2");
  const unrelatedMarkup = renderChatMember("employee4");
  const malformedOwnerMarkup = renderChatMember("employee1", ownerMissingMembership);
  assert.match(speakerMarkup, /data-activity="chatting"[^>]*data-conversation-role="speaker"/);
  assert.match(speakerMarkup, /office-chat-prop/);
  assert.match(listenerMarkup, /data-activity="chatting"[^>]*data-conversation-role="listener"/);
  assert.match(listenerMarkup, /office-listen-prop/);
  assert.match(listenerMarkup, /--office-frame-row:7/);
  assert.match(unrelatedMarkup, /data-activity="idle"/);
  assert.doesNotMatch(unrelatedMarkup, /office-chat-prop|office-listen-prop/);
  assert.match(malformedOwnerMarkup, /data-activity="idle"/);

  const sceneMarkup = renderToStaticMarkup(React.createElement(sceneModule.OfficeScene, {
    state: {
      now: 720,
      activityEvents,
      activeEventBySlot,
      assignments: {},
      conversations: {
        "conversation-a": conversation,
        "conversation-b": {
          id: "conversation-b",
          memberIds: ["employee3", "employee4"],
          bubbleQueue: [{
            conversationId: "conversation-b",
            speakerId: "employee4",
            text: "第二组正在聊",
          }],
        },
      },
      characters: Object.fromEntries([1, 2, 3, 4].map((number) => {
        const slotId = `employee${number}`;
        const conversationId = number < 3 ? "conversation-a" : "conversation-b";
        return [slotId, {
          slotId,
          phase: "chatting",
          activity: "chatting",
          conversationId,
          positionNode: `${slotId}-home`,
          profile: { name: slotId },
        }];
      })),
    },
    assignments: {},
    motionNow: 720,
  }));
  assert.equal((sceneMarkup.match(/data-office-actor-overlay=/g) || []).length, 4);
  assert.equal((sceneMarkup.match(/data-activity="chatting"/g) || []).length, 4);
  assert.match(sceneMarkup, /周末去看展吗？|第二组正在聊/);
  assert.match(sceneSource, /onClick=\{\(\) => onSelect\?\.\(snapshot\.id\)\}/);

  assert.deepEqual(activitiesModule.filterOfficeActivityEvents(activityEvents, {
    actorId: "employee2",
  }).map(({ eventId }) => eventId), [sharedEvent.eventId]);
  assert.deepEqual(activitiesModule.filterOfficeActivityEvents(activityEvents, {
    actorId: "employee4",
  }).map(({ eventId }) => eventId), [simultaneousEvent.eventId]);
  assert.deepEqual(activitiesModule.filterOfficeActivityEvents(activityEvents, {
    actorId: "boss",
  }), []);
});

test("renders persisted assignment errors while preserving a valid custom draft", () => {
  const renderError = (message) => renderToStaticMarkup(
    React.createElement(assignmentFlowModule.default, {
      view: "selection",
      selectedSlotId: "employee1",
      slots: [{ id: "employee1", label: "员工一", kind: "employee" }],
      assignments: {
        employee1: {
          profileId: "npc-employee1",
          profile: { name: "NPC", generated: true },
          chibiId: "employee-f-01",
          customAssetSrc: "https://example.com/valid.png",
        },
      },
      assignmentErrors: { employee1: message },
      profiles: { bossOptions: [], employeeOptions: [] },
      occupiedProfiles: new Map(),
      onOpenSlot() {},
      onBack() {},
      onProfileChange() {},
      onChibiChange() {},
      onUpload() {},
      onCustomDraftChange() {},
    }),
  );

  for (const message of [
    "图片不能超过 1 MB，请使用更小图片或图片 URL",
    "请选择图片文件",
    "图片读取失败，请重试或使用图片 URL",
    "安排无法保存，请检查设备存储后重试",
    "图片无法保存，请使用更小图片或图片 URL",
    "图片加载失败，已恢复内置形象",
  ]) {
    const markup = renderError(message);
    assert.match(markup, /value="https:\/\/example.com\/valid.png"/);
    assert.ok(markup.includes(message), `missing assignment error: ${message}`);
    assert.match(markup, /role="alert"/);
    assert.match(markup, /aria-describedby="employee1-asset-error"/);
  }
});

test("renders malformed legacy activity timestamps without throwing", () => {
  const render = () => renderToStaticMarkup(React.createElement(activityPanelModule.default, {
    open: true,
    workSessionId: "session-current",
    assignments: { employee1: { profile: { name: "小林" } } },
    events: [{
      eventId: "event-invalid-time",
      workSessionId: "session-current",
      actorId: "employee1",
      participantIds: ["employee1"],
      profileSnapshots: [{ name: "小林" }],
      activityType: "working",
      startedAt: "legacy-not-a-date",
      endedAt: 1,
    }],
    onClose() {},
  }));

  assert.doesNotThrow(render);
  assert.match(render(), /<time>--:--<\/time>/);
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
  assert.match(source, /conversationTopic:\s*event\.session\?\.topic\s*\|\|\s*""/);
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

test("keeps event ownership while modules render concrete furniture", () => {
  for (const token of [
    "activityEvent", "sampleOfficeRoute", "motionNow", "getWalkFrame",
  ]) assert.ok(characterAndSceneSource.includes(token), `missing ${token}`);
  assert.doesNotMatch(characterSource, /function (WorkProps|SlackProps|GameProps|MealProps|BookProps|SeriesProps|ShortVideoProps)/);
  assert.match(characterSource, /ConversationProps/);
});

test("renders only the Pixi bridge and React actor overlays, without legacy DOM scene layers", () => {
  assert.match(sceneSource, /resolveOfficeModuleState/);
  assert.match(sceneSource, /OfficeCanvas/);
  assert.match(sceneSource, /office-actor-overlay/);
  for (const legacyLayer of [
    "OfficeCharacter", "office-module-layer", "office-scene-background", "office-character-layer", "office-furniture-layer",
  ]) assert.doesNotMatch(sceneSource, new RegExp(legacyLayer));
  assert.match(sceneSource, /onError=\{setRendererError\}/);
  assert.doesNotMatch(sceneSource, /onError=\{onAssetError\}/);
});

test("removes hard route-step and bubble-clamp rendering", () => {
  assert.doesNotMatch(characterAndSceneSource, /routeStepDurationMs/);
  assert.match(cssSource, /overflow-wrap:\s*anywhere/);
  assert.match(cssSource, /\.office-actor-bubble/);
  assert.doesNotMatch(cssSource, /-webkit-line-clamp/);
});

test("exposes the rendered motion clock for deterministic movement QA", () => {
  const markup = renderToStaticMarkup(React.createElement(
    characterModule.OfficeCharacter,
    {
      character: {
        slotId: "employee1",
        phase: "walkingToActivity",
        activity: "eating",
        routeStartedAt: 100,
        positionNode: "employee1-home",
        profile: { name: "小林" },
      },
      assignment: { chibiId: "employee-f-01" },
      motionNow: 720,
    },
  ));

  assert.match(markup, /data-motion-now="720"/);
});

test("renders semantic activity data and furniture-safe atlas frames only for an exact owned event", () => {
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
  assert.match(ownedMarkup, /data-prop="hardcover"/);
  assert.doesNotMatch(ownedMarkup, /office-book-prop|正在阅读《沉思录》/);

  const furnitureUnsafeMarkup = renderToStaticMarkup(React.createElement(
    characterModule.OfficeCharacter,
    {
      character,
      assignment,
      activityEvent: {
        eventId: "event-unsafe",
        actorId: "employee1",
        activityType: "reading",
      },
      furnitureReady: false,
      motionNow: 720,
    },
  ));
  assert.match(furnitureUnsafeMarkup, /data-furniture-ready="false"/);
  assert.match(furnitureUnsafeMarkup, /--office-frame-row:7/);
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

  assert.doesNotMatch(cssSource, /data-group-count="5"[^\{]*\.office-speech-bubble/);
});
