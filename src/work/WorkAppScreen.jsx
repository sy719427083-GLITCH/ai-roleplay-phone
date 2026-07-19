import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArrowLeft, Ellipsis, Users } from "lucide-react";
import OfficeConversationPanel from "./OfficeConversationPanel.jsx";
import OfficeAssignmentFlow from "./OfficeAssignmentFlow.jsx";
import OfficeScene from "./OfficeScene.jsx";
import { OFFICE_CHIBIS } from "./pixi/officeAssetManifest.js";
import { requestOfficeActivityDetail } from "./officeActivityApi.js";
import { getActivityDefinition } from "./officeActivityManifest.js";
import { requestOfficeConversationTurn } from "./officeConversationApi.js";
import { getSceneAnchor } from "./officeSceneManifest.js";
import { reserveAnchors } from "./officeReservations.js";
import {
  createOfficeProfileSnapshot,
  normalizeOfficeAssignments,
  OFFICE_ASSIGNMENT_KEY,
  OFFICE_SLOT_IDS,
  readOfficeProfiles,
} from "./officeProfiles.js";
import {
  buildConversationSession,
  chooseOfficeEvent,
} from "./officeScheduler.js";
import {
  createOfficeState,
  officeReducer,
  restoreOfficeState,
  serializeOfficeState,
} from "./officeState.js";
import { buildWorldRoute, sampleWorldRoute, separateActors } from "./officeWorld.js";
import "./office.css";

const OFFICE_STATE_KEY = "ccatOfficeStateV1";
const TICK_INTERVAL_MS = 250;
const SCHEDULE_MIN_MS = 4_000;
const SCHEDULE_MAX_MS = 8_000;
const STATE_PERSIST_DEBOUNCE_MS = 1_000;
const MODE_SCHEDULE_NUDGE_MS = 350;
const OFFICE_WALK_SPEED = 180;
export const MAX_CUSTOM_IMAGE_BYTES = 1024 * 1024;

const RADIO_PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);
const RADIO_NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const ASSIGNMENT_STORAGE_ERROR = "安排无法保存，请检查设备存储后重试";
const CUSTOM_ASSET_STORAGE_ERROR = "图片无法保存，请使用更小图片或图片 URL";
const CUSTOM_ASSET_LOAD_ERROR = "图片加载失败，已恢复内置形象";
const DIALOG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "select:not([disabled])",
  "input:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const SLOT_DETAILS = [
  { id: "boss", label: "老板", kind: "boss", defaultChibiId: "boss-f-01" },
  { id: "employee1", label: "员工一", kind: "employee", defaultChibiId: "employee-f-01" },
  { id: "employee2", label: "员工二", kind: "employee", defaultChibiId: "employee-m-01" },
  { id: "employee3", label: "员工三", kind: "employee", defaultChibiId: "employee-f-02" },
  { id: "employee4", label: "员工四", kind: "employee", defaultChibiId: "employee-m-02" },
];

const AVAILABLE_PHASES = new Set(["idle", "working"]);
const CONVERSATION_ACTIVITY_IDS = new Set(["chatting", "diningChat", "sofaChat"]);
const MODE_OPTIONS = [
  { id: "focus", label: "认真干活" },
  { id: "free", label: "自由行动" },
  { id: "rest", label: "休息一下" },
];
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function getNextOfficeRadioIndex(currentIndex, key, itemCount) {
  if (!Number.isInteger(itemCount) || itemCount <= 0) return -1;
  const safeIndex = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < itemCount
    ? currentIndex
    : 0;
  if (RADIO_PREVIOUS_KEYS.has(key)) return (safeIndex - 1 + itemCount) % itemCount;
  if (RADIO_NEXT_KEYS.has(key)) return (safeIndex + 1) % itemCount;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  return -1;
}

export function getOfficeFocusTrapIndex(currentIndex, itemCount, shiftKey) {
  if (!Number.isInteger(itemCount) || itemCount <= 0) return -1;
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= itemCount) {
    return shiftKey ? itemCount - 1 : 0;
  }
  if (shiftKey && currentIndex === 0) return itemCount - 1;
  if (!shiftKey && currentIndex === itemCount - 1) return 0;
  return null;
}

export function validateOfficeImageFile(file) {
  if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
    return { ok: false, reason: "invalid-type" };
  }
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_CUSTOM_IMAGE_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  return { ok: true, reason: "" };
}

const abortReaderSafely = (reader) => {
  try {
    reader?.abort?.();
  } catch {
    // A completed reader may reject abort; it is stale either way.
  }
};

export function createOfficeUploadReaderRegistry() {
  const readers = new Map();

  const abort = (slotId) => {
    const reader = readers.get(slotId);
    if (!reader) return false;
    readers.delete(slotId);
    abortReaderSafely(reader);
    return true;
  };

  return {
    abort,
    start(slotId, reader) {
      abort(slotId);
      readers.set(slotId, reader);
      return reader;
    },
    isCurrent(slotId, reader) {
      return readers.get(slotId) === reader;
    },
    finish(slotId, reader) {
      if (readers.get(slotId) !== reader) return false;
      readers.delete(slotId);
      return true;
    },
    abortAll() {
      const activeReaders = [...readers.values()];
      readers.clear();
      for (const reader of activeReaders) abortReaderSafely(reader);
    },
  };
}

const getStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
};

const safeGetItem = (storage, key) => {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
};

const safeSetItem = (storage, key, value) => {
  try {
    if (typeof storage?.setItem !== "function") return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const readStoredObject = (storage, key) => {
  try {
    const parsed = JSON.parse(safeGetItem(storage, key) || "{}");
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const isAcceptedCustomAssetSource = (value) => {
  const source = cleanText(value);
  if (!source) return true;
  return /^(?:https?:\/\/\S+|data:image\/[a-z0-9.+-]+(?:;[^,]*)?,.+)$/i.test(source);
};

const getStoredProfileId = (value) => {
  if (typeof value === "string") return cleanText(value);
  if (isRecord(value)) return cleanText(value.profileId);
  return "";
};

const normalizeStoredAssignments = (storedValue, profiles) => {
  const seenProfileIds = new Set();
  const profileIds = {};

  for (const slotId of OFFICE_SLOT_IDS) {
    const profileId = getStoredProfileId(storedValue?.[slotId]);
    if (!profileId || seenProfileIds.has(profileId)) {
      profileIds[slotId] = "";
      continue;
    }
    seenProfileIds.add(profileId);
    profileIds[slotId] = profileId;
  }

  const normalized = normalizeOfficeAssignments(profileIds, profiles);

  return Object.fromEntries(SLOT_DETAILS.map((slot) => {
    const stored = isRecord(storedValue?.[slot.id]) ? storedValue[slot.id] : {};
    const compatibleChibis = OFFICE_CHIBIS.filter((chibi) => chibi.kind === slot.kind);
    const requestedChibiId = cleanText(stored.chibiId);
    const chibiId = compatibleChibis.some((chibi) => chibi.id === requestedChibiId)
      ? requestedChibiId
      : slot.defaultChibiId;
    const requestedCustomSource = cleanText(stored.customAssetSrc);

    return [slot.id, {
      ...normalized[slot.id],
      chibiId,
      customAssetSrc: isAcceptedCustomAssetSource(requestedCustomSource)
        ? requestedCustomSource
        : "",
    }];
  }));
};

const serializeAssignments = (assignments) => JSON.stringify(Object.fromEntries(
  OFFICE_SLOT_IDS.map((slotId) => [slotId, {
    profileId: cleanText(assignments[slotId]?.profileId),
    chibiId: cleanText(assignments[slotId]?.chibiId),
    customAssetSrc: cleanText(assignments[slotId]?.customAssetSrc),
  }]),
));

export function commitOfficeAssignments(storage, currentAssignments, nextAssignments) {
  const ok = safeSetItem(storage, OFFICE_ASSIGNMENT_KEY, serializeAssignments(nextAssignments));
  return {
    ok,
    assignments: ok ? nextAssignments : currentAssignments,
  };
}

const createInitialContext = () => {
  const storage = getStorage();
  const profiles = readOfficeProfiles(storage);
  const assignments = normalizeStoredAssignments(
    readStoredObject(storage, OFFICE_ASSIGNMENT_KEY),
    profiles,
  );
  const now = Date.now();
  const storedState = safeGetItem(storage, OFFICE_STATE_KEY);
  let initialState = null;

  if (storedState) {
    try {
      const parsed = JSON.parse(storedState);
      if (isRecord(parsed) && Number.isFinite(parsed.durationMs) && parsed.durationMs >= 0) {
        const elapsedWhileClosed = Number.isFinite(parsed.now)
          ? Math.max(0, now - parsed.now)
          : 0;
        initialState = restoreOfficeState(JSON.stringify({
          ...parsed,
          durationMs: Math.max(0, parsed.durationMs - elapsedWhileClosed),
        }), assignments, now);
      }
    } catch {
      initialState = null;
    }
  }

  if (!initialState) {
    initialState = createOfficeState({
      assignments,
      now,
      durationMs: 8 * 60 * 60 * 1000,
    });
  }

  return {
    assignments,
    initialState,
    now,
    profiles,
    relationships: profiles.relations,
    storage,
  };
};

const formatRemainingTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const getRandomCadence = () => (
  SCHEDULE_MIN_MS + Math.floor(Math.random() * (SCHEDULE_MAX_MS - SCHEDULE_MIN_MS + 1))
);

const getAvailableCharacterIds = (state) => OFFICE_SLOT_IDS.filter((slotId) => {
  const character = state.characters?.[slotId];
  if (!character || character.conversationId) return false;
  if (!AVAILABLE_PHASES.has(character.phase)) return false;
  return character.activity === "idle" || character.activity === "working";
});

const getProfileMap = (assignments) => Object.fromEntries(
  OFFICE_SLOT_IDS.map((slotId) => [slotId, assignments[slotId]]),
);

const getCharacterWorldPoint = (character, sampledActor) => {
  const point = sampledActor && Number.isFinite(sampledActor.x) && Number.isFinite(sampledActor.y)
    ? sampledActor
    : { sceneId: character?.sceneId, ...character?.position };
  return typeof point.sceneId === "string" && Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { sceneId: point.sceneId, x: point.x, y: point.y }
    : null;
};

const getHomeWorldPoint = (slotId) => {
  const anchor = getSceneAnchor("office", `${slotId}:seat-approach`);
  return anchor ? { sceneId: "office", x: anchor.x, y: anchor.y } : null;
};

const isConversationEvent = (event) => CONVERSATION_ACTIVITY_IDS.has(event?.activityId);

const hasExactPhysicalEventContract = (event) => {
  if (!isRecord(event) || !cleanText(event.activityId) || !cleanText(event.sceneId)
    || !cleanText(event.reservationGroupId) || !Array.isArray(event.actorIds) || !event.actorIds.length
    || new Set(event.actorIds).size !== event.actorIds.length || !Array.isArray(event.targetAnchors)
    || !isRecord(event.routesByActor) || !isRecord(event.propState) || !isRecord(event.semanticContext)
    || !Number.isFinite(event.startedAt) || !Number.isFinite(event.endsAt)) return false;
  const routeActorIds = Object.keys(event.routesByActor);
  if (!routeActorIds.length || routeActorIds.some((slotId) => !event.actorIds.includes(slotId)
    || !Array.isArray(event.routesByActor[slotId]) || !event.routesByActor[slotId].length)) return false;
  if (!isConversationEvent(event)) return event.targetAnchors.length === event.actorIds.length && routeActorIds.length === event.actorIds.length;
  return cleanText(event.hostId) && event.actorIds.includes(event.hostId)
    && Array.isArray(event.visitorIds) && event.visitorIds.length
    && event.visitorIds.every((slotId) => event.actorIds.includes(slotId) && slotId !== event.hostId)
    && isRecord(event.anchorByMember) && event.actorIds.every((slotId) => cleanText(event.anchorByMember[slotId]))
    && cleanText(event.locationId)
    && (event.locationId.endsWith(":desk")
      ? routeActorIds.length === event.visitorIds.length && routeActorIds.every((slotId) => event.visitorIds.includes(slotId))
      : routeActorIds.length === event.actorIds.length);
};

export function createPhysicalSchedulerRuntime(event, assignments) {
  if (!hasExactPhysicalEventContract(event) || !isRecord(assignments)) return null;
  const definition = getActivityDefinition(event.activityId);
  if (!definition || (!isConversationEvent(event) && definition.sceneId !== event.sceneId)) return null;
  if (event.actorIds.some((slotId) => !isRecord(assignments[slotId]))) return null;

  const semanticEvent = {
    activityId: event.activityId,
    semanticContext: JSON.parse(JSON.stringify(event.semanticContext)),
    profileSnapshots: event.actorIds.map((slotId) => createOfficeProfileSnapshot(
      assignments[slotId].profile,
      slotId === "boss" ? "me" : "character",
    )),
  };
  const actions = Object.keys(event.routesByActor).map((slotId, index) => ({
    type: "START_WORLD_ROUTE",
    slotId,
    activityId: event.activityId,
    route: event.routesByActor[slotId],
    targetAnchorId: isConversationEvent(event) ? event.anchorByMember[slotId] : event.targetAnchors[index],
    reservationGroupId: event.reservationGroupId,
    propState: event.propState,
    semanticContext: event.semanticContext,
    travelStatus: definition.travelStatus,
    speed: OFFICE_WALK_SPEED,
    now: event.startedAt,
    endsAt: event.endsAt,
  }));
  const participantSnapshots = event.actorIds.map((slotId) => ({
    memberId: slotId,
    profileId: assignments[slotId].profileId || slotId,
    ...createOfficeProfileSnapshot(assignments[slotId].profile, slotId === "boss" ? "me" : "character"),
  }));
  return { event, semanticEvent, participantSnapshots, actions };
}

export function samplePhysicalWorldFrame({ characters = {}, now = 0, previousSamples = {} } = {}) {
  const rawSamples = {};
  const movingActors = [];
  for (const [slotId, character] of Object.entries(characters)) {
    if (!character || !["walkingToActivity", "returning"].includes(character.phase) || !character.route?.length) continue;
    const sample = sampleWorldRoute({
      route: character.route,
      startedAt: character.routeStartedAt,
      now,
      speed: Number.isFinite(character.routeSpeed) && character.routeSpeed > 0
        ? character.routeSpeed
        : OFFICE_WALK_SPEED,
    });
    rawSamples[slotId] = sample;
    const previous = previousSamples[slotId];
    const previousPosition = previous?.sceneId === sample.sceneId
      && Number.isFinite(previous.x) && Number.isFinite(previous.y)
      ? { x: previous.x, y: previous.y }
      : { x: sample.x, y: sample.y };
    movingActors.push({
      ...sample,
      id: slotId,
      moving: true,
      position: { x: sample.x, y: sample.y },
      previousPosition,
      routeStartedAt: character.routeStartedAt,
    });
  }
  const renderSamples = Object.fromEntries(separateActors(movingActors).map((actor) => [actor.id, actor]));
  return { rawSamples, renderSamples };
}

const getDialogFocusableElements = (dialog) => (
  dialog
    ? [...dialog.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR)]
        .filter((element) => element.tabIndex >= 0 && element.getAttribute("aria-hidden") !== "true")
    : []
);

export default function WorkAppScreen({ onClose }) {
  const [initialContext] = useState(createInitialContext);
  const [state, reducerDispatch] = useReducer(officeReducer, initialContext.initialState);
  const [assignments, setAssignments] = useState(initialContext.assignments);
  const [profiles, setProfiles] = useState(initialContext.profiles);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
  const [selectedAssignmentSlotId, setSelectedAssignmentSlotId] = useState("");
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [motionNow, setMotionNow] = useState(initialContext.now);
  const [sampledWorldActors, setSampledWorldActors] = useState({});
  const [assignmentErrors, setAssignmentErrors] = useState({});
  const [, setCustomDrafts] = useState(() => Object.fromEntries(
    OFFICE_SLOT_IDS.map((slotId) => [slotId, initialContext.assignments[slotId].customAssetSrc]),
  ));

  const stateRef = useRef(state);
  const assignmentsRef = useRef(assignments);
  const sessionStartedAtRef = useRef(initialContext.now);
  const nextScheduleAtRef = useRef(initialContext.now + getRandomCadence());
  const statePersistTimerRef = useRef(null);
  const pendingPhysicalEventsRef = useRef(new Map());
  const pendingConversationsRef = useRef(new Map());
  const activityControllersRef = useRef(new Map());
  const conversationControllersRef = useRef(new Map());
  const conversationRuntimeRef = useRef(new Map());
  const completedRouteKeysRef = useRef(new Set());
  const routeTransitionKeysRef = useRef(new Set());
  const sampledWorldActorsRef = useRef({});
  const timestampOriginRef = useRef(Date.now() - (
    typeof performance !== "undefined" ? performance.now() : 0
  ));
  const assignmentDialogRef = useRef(null);
  const assignmentOpenerRef = useRef(null);
  const activityOpenerRef = useRef(null);
  const activityWasOpenRef = useRef(false);
  const isMountedRef = useRef(true);
  const uploadReadersRef = useRef(null);
  if (!uploadReadersRef.current) uploadReadersRef.current = createOfficeUploadReaderRegistry();

  stateRef.current = state;
  assignmentsRef.current = assignments;

  const dispatchOffice = useCallback((action) => {
    stateRef.current = officeReducer(stateRef.current, action);
    reducerDispatch(action);
  }, []);

  const setAssignmentError = useCallback((slotId, message) => {
    if (!isMountedRef.current) return;
    setAssignmentErrors((current) => {
      if ((current[slotId] || "") === message) return current;
      const next = { ...current };
      if (message) next[slotId] = message;
      else delete next[slotId];
      return next;
    });
  }, []);

  const openAssignmentPanel = useCallback((slotId = "") => {
    if (typeof document !== "undefined") assignmentOpenerRef.current = document.activeElement;
    setActivityPanelOpen(false);
    setSelectedAssignmentSlotId(OFFICE_SLOT_IDS.includes(slotId) ? slotId : "");
    setAssignmentPanelOpen(true);
  }, []);

  const closeAssignmentPanel = useCallback(() => {
    setAssignmentPanelOpen(false);
    setSelectedAssignmentSlotId("");
  }, []);

  const openActivityPanel = useCallback(() => {
    setAssignmentPanelOpen(false);
    setSelectedAssignmentSlotId("");
    setActivityPanelOpen(true);
  }, []);

  const handleAssignmentDialogKeyDown = useCallback((event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAssignmentPanel();
      return;
    }
    if (event.key !== "Tab") return;

    const dialog = assignmentDialogRef.current;
    const focusableElements = getDialogFocusableElements(dialog);
    const currentIndex = focusableElements.indexOf(document.activeElement);
    const nextIndex = getOfficeFocusTrapIndex(currentIndex, focusableElements.length, event.shiftKey);
    if (nextIndex === null) return;

    event.preventDefault();
    if (nextIndex < 0) dialog?.focus();
    else focusableElements[nextIndex]?.focus();
  }, [closeAssignmentPanel]);

  useEffect(() => {
    if (!assignmentPanelOpen || !assignmentDialogRef.current || typeof window === "undefined") {
      return undefined;
    }
    const dialog = assignmentDialogRef.current;
    const opener = assignmentOpenerRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      const initialTarget = dialog.querySelector("[data-office-dialog-close]")
        || getDialogFocusableElements(dialog)[0]
        || dialog;
      initialTarget.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
    };
  }, [assignmentPanelOpen]);

  useEffect(() => {
    if (activityPanelOpen) {
      activityWasOpenRef.current = true;
      return;
    }
    if (!activityWasOpenRef.current) return;
    activityWasOpenRef.current = false;
    const opener = activityOpenerRef.current;
    if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
  }, [activityPanelOpen]);

  const getRemainingMs = useCallback((snapshot = stateRef.current, now = Date.now()) => (
    Math.max(0, snapshot.durationMs - Math.max(0, now - sessionStartedAtRef.current))
  ), []);

  const persistOfficeState = useCallback(() => {
    const now = Date.now();
    const snapshot = stateRef.current;
    safeSetItem(initialContext.storage, OFFICE_STATE_KEY, serializeOfficeState({
      ...snapshot,
      now,
      durationMs: getRemainingMs(snapshot, now),
    }));
  }, [getRemainingMs, initialContext.storage]);

  const stopConversationRuntime = useCallback((conversationId) => {
    const controller = conversationControllersRef.current.get(conversationId);
    controller?.abort();
    conversationControllersRef.current.delete(conversationId);

    const runtime = conversationRuntimeRef.current.get(conversationId);
    if (runtime?.nextTurnTimer) clearTimeout(runtime.nextTurnTimer);
    if (runtime?.bubbleTimer) clearTimeout(runtime.bubbleTimer);
    conversationRuntimeRef.current.delete(conversationId);
  }, []);

  const closeConversation = useCallback((conversationId) => {
    const snapshot = stateRef.current;
    const conversation = snapshot.conversations?.[conversationId];
    if (!conversation) return;

    const returnRoutes = {};
    for (const slotId of conversation.memberIds) {
      const character = snapshot.characters?.[slotId];
      const from = getCharacterWorldPoint(character, sampledWorldActorsRef.current[slotId]);
      const to = getHomeWorldPoint(slotId);
      if (slotId === conversation.hostId && from?.sceneId === to?.sceneId && from?.x === to?.x && from?.y === to?.y) continue;
      const route = buildWorldRoute({ from, to });
      if (route.length) returnRoutes[slotId] = route;
    }

    stopConversationRuntime(conversationId);
    dispatchOffice({
      type: "CLOSE_CONVERSATION",
      conversationId,
      returnRoutes,
      now: Date.now(),
    });
  }, [dispatchOffice, stopConversationRuntime]);

  const createActivityRuntime = useCallback((runtime) => {
    const eventId = cleanText(runtime?.semanticEvent?.semanticContext?.eventId);
    if (!eventId) return;
    const previous = activityControllersRef.current.get(eventId);
    previous?.abort();
    const controller = new AbortController();
    activityControllersRef.current.set(eventId, controller);
    requestOfficeActivityDetail({
      event: runtime.semanticEvent,
      signal: controller.signal,
      storage: initialContext.storage,
    }).then((detail) => {
      if (!isMountedRef.current || activityControllersRef.current.get(eventId) !== controller) return;
      dispatchOffice({
        type: "SET_ACTIVITY_SEMANTICS",
        actorIds: runtime.event.actorIds,
        eventId,
        detail,
      });
    }).finally(() => {
      if (activityControllersRef.current.get(eventId) === controller) activityControllersRef.current.delete(eventId);
    });
  }, [dispatchOffice, initialContext.storage]);

  const applyScheduledEvent = useCallback((event, reservations) => {
    const runtime = createPhysicalSchedulerRuntime(event, assignmentsRef.current);
    if (!runtime) return false;
    dispatchOffice({ type: "SET_RESERVATIONS", reservations });
    pendingPhysicalEventsRef.current.set(event.reservationGroupId, event);
    if (!isConversationEvent(event)) createActivityRuntime(runtime);

    if (isConversationEvent(event)) {
      const session = buildConversationSession({
        memberIds: event.actorIds,
        anchorId: event.targetAnchors[0],
        now: event.startedAt,
        random: Math.random,
      });
      if (session) {
        Object.assign(session, {
          workSessionId: stateRef.current.workSessionId,
          hostId: event.hostId,
          visitorIds: [...event.visitorIds],
          sceneId: event.sceneId,
          locationId: event.locationId,
          anchorByMember: { ...event.anchorByMember },
          reservationGroupId: event.reservationGroupId,
          targetAnchorIds: [...event.targetAnchors],
          participantSnapshots: runtime.participantSnapshots,
          activityId: event.activityId,
          activityStatus: event.semanticContext.status,
          endsAt: event.endsAt,
        });
        pendingConversationsRef.current.set(session.id, {
          memberIds: [...event.actorIds],
          travelerIds: runtime.actions.map(({ slotId }) => slotId),
          session,
        });
      }
    }

    for (const action of runtime.actions) dispatchOffice(action);
    return true;
  }, [createActivityRuntime, dispatchOffice]);

  const runScheduleAttempt = useCallback((now) => {
    const snapshot = stateRef.current;
    const schedulerState = {
      ...snapshot,
      reservations: JSON.parse(JSON.stringify(snapshot.reservations || {})),
    };
    const event = chooseOfficeEvent({
      state: schedulerState,
      profiles: getProfileMap(assignmentsRef.current),
      random: Math.random,
      now,
    });
    if (event) applyScheduledEvent(event, schedulerState.reservations);
  }, [applyScheduledEvent]);

  const resolveExpiredActivities = useCallback((now) => {
    const snapshot = stateRef.current;

    for (const conversation of Object.values(snapshot.conversations || {})) {
      if (conversation.endsAt && conversation.endsAt <= now) closeConversation(conversation.id);
    }

    for (const slotId of OFFICE_SLOT_IDS) {
      const character = stateRef.current.characters?.[slotId];
      if (!character?.activityEndsAt || character.activityEndsAt > now) continue;
      if (["walkingToActivity", "returning"].includes(character.phase) || character.conversationId) continue;
      const from = getCharacterWorldPoint(character, sampledWorldActorsRef.current[slotId]);
      const to = getHomeWorldPoint(slotId);
      const route = buildWorldRoute({ from, to });
      if (route.length) dispatchOffice({ type: "START_RETURN", slotId, route, position: from, now });
    }
  }, [closeConversation, dispatchOffice]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      dispatchOffice({ type: "TICK", now });
      resolveExpiredActivities(now);

      if (now >= nextScheduleAtRef.current) {
        runScheduleAttempt(now);
        nextScheduleAtRef.current = now + getRandomCadence();
      }
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dispatchOffice, resolveExpiredActivities, runScheduleAttempt]);

  useEffect(() => {
    let frameId = 0;
    const frame = (timestamp) => {
      const now = timestampOriginRef.current + timestamp;
      const { rawSamples, renderSamples } = samplePhysicalWorldFrame({
        characters: stateRef.current.characters,
        now,
        previousSamples: sampledWorldActorsRef.current,
      });
      const activeRouteKeys = new Set();

      for (const slotId of OFFICE_SLOT_IDS) {
        const character = stateRef.current.characters?.[slotId];
        if (!character || !["walkingToActivity", "returning"].includes(character.phase) || !character.route.length) continue;
        const sample = rawSamples[slotId];
        if (!sample) continue;
        const routeKey = `${slotId}:${character.routeStartedAt}:${character.phase}`;
        activeRouteKeys.add(routeKey);

        if (sample.sceneId && sample.sceneId !== character.sceneId) {
          const transition = character.route.find((entry) => (
            entry?.transition === true
            && entry.from?.sceneId === character.sceneId
            && entry.to?.sceneId === sample.sceneId
          ));
          const transitionKey = `${routeKey}:door:${transition?.from?.sceneId}:${transition?.to?.sceneId}`;
          if (transition && !routeTransitionKeysRef.current.has(transitionKey)) {
            routeTransitionKeysRef.current.add(transitionKey);
            dispatchOffice({
              type: "CROSS_SCENE_DOOR",
              slotId,
              transition,
              position: sample,
              segmentIndex: sample.segmentIndex,
              now,
            });
          }
        } else if (!sample.done && sample.segmentIndex > character.routeSegmentIndex) {
          const segmentKey = `${routeKey}:segment:${sample.segmentIndex}`;
          if (!routeTransitionKeysRef.current.has(segmentKey)) {
            routeTransitionKeysRef.current.add(segmentKey);
            dispatchOffice({
              type: "ADVANCE_WORLD_ROUTE",
              slotId,
              position: sample,
              segmentIndex: sample.segmentIndex,
              now,
            });
          }
        }

        if (!sample.done || completedRouteKeysRef.current.has(routeKey)) continue;
        completedRouteKeysRef.current.add(routeKey);
        const current = stateRef.current.characters?.[slotId];
        if (current?.phase === "returning") {
          dispatchOffice({ type: "FINISH_RETURN", slotId, position: sample, now });
        } else if (current?.phase === "walkingToActivity") {
          dispatchOffice({ type: "ARRIVE_ACTIVITY", slotId, position: sample, now });
        }
      }

      sampledWorldActorsRef.current = renderSamples;
      setSampledWorldActors(renderSamples);
      setMotionNow(now);

      for (const routeKey of completedRouteKeysRef.current) {
        if (!activeRouteKeys.has(routeKey)) completedRouteKeysRef.current.delete(routeKey);
      }
      for (const transitionKey of routeTransitionKeysRef.current) {
        if (![...activeRouteKeys].some((routeKey) => transitionKey.startsWith(routeKey))) {
          routeTransitionKeysRef.current.delete(transitionKey);
        }
      }
      for (const [conversationId, pending] of pendingConversationsRef.current) {
        const allArrived = pending.travelerIds.every((slotId) => {
          const character = stateRef.current.characters?.[slotId];
          return character?.phase === pending.session.activityId && !character.conversationId;
        });
        if (!allArrived) continue;
        dispatchOffice({ type: "OPEN_CONVERSATION", session: pending.session });
        if (stateRef.current.conversations?.[conversationId]) pendingConversationsRef.current.delete(conversationId);
      }
      for (const [groupId, event] of pendingPhysicalEventsRef.current) {
        const allSettled = event.actorIds.every((slotId) => stateRef.current.characters?.[slotId]?.phase !== "walkingToActivity");
        if (allSettled) pendingPhysicalEventsRef.current.delete(groupId);
      }

      frameId = window.requestAnimationFrame(frame);
    };
    frameId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(frameId);
  }, [dispatchOffice]);

  useEffect(() => {
    if (statePersistTimerRef.current) return;
    statePersistTimerRef.current = window.setTimeout(() => {
      statePersistTimerRef.current = null;
      persistOfficeState();
    }, STATE_PERSIST_DEBOUNCE_MS);
  }, [persistOfficeState, state]);

  useEffect(() => {
    const activeIds = new Set(Object.keys(state.conversations || {}));
    for (const conversationId of conversationRuntimeRef.current.keys()) {
      if (!activeIds.has(conversationId)) stopConversationRuntime(conversationId);
    }

    for (const [conversationId, conversation] of Object.entries(state.conversations || {})) {
      let runtime = conversationRuntimeRef.current.get(conversationId);
      if (!runtime) {
        runtime = {
          bubbleTimer: null,
          inFlight: false,
          nextTurnTimer: null,
          pendingEnd: false,
        };
        conversationRuntimeRef.current.set(conversationId, runtime);
      }

      if (conversation.bubbleQueue.length) {
        if (!runtime.bubbleTimer) {
          const textLength = Array.from(conversation.bubbleQueue[0]?.text || "").length;
          const readableDelay = Math.min(4_200, Math.max(2_200, 1_700 + textLength * 90));
          runtime.bubbleTimer = window.setTimeout(() => {
            runtime.bubbleTimer = null;
            const current = stateRef.current.conversations?.[conversationId];
            if (!current?.bubbleQueue.length) return;
            dispatchOffice({ type: "SHIFT_BUBBLE", conversationId });
            if (runtime.pendingEnd && stateRef.current.conversations?.[conversationId]?.bubbleQueue.length === 0) {
              closeConversation(conversationId);
            }
          }, readableDelay);
        }
        continue;
      }

      if (runtime.pendingEnd) {
        closeConversation(conversationId);
        continue;
      }
      if (runtime.inFlight || runtime.nextTurnTimer) continue;

      runtime.nextTurnTimer = window.setTimeout(async () => {
        runtime.nextTurnTimer = null;
        const current = stateRef.current.conversations?.[conversationId];
        if (!current || current.status !== "active" || current.bubbleQueue.length || runtime.inFlight) return;

        const requestSequence = current.requestSequence + 1;
        dispatchOffice({
          type: "UPDATE_CONVERSATION_IO",
          conversationId,
          requestSequence,
          promptContext: {
            ...current.promptContext,
            activity: current.activityId || "chatting",
          },
        });

        const requestSession = {
          ...current,
          requestSequence,
          currentActivity: current.activityId || "chatting",
          promptContext: {
            ...current.promptContext,
            activity: current.activityId || "chatting",
          },
        };
        const controller = new AbortController();
        runtime.inFlight = true;
        conversationControllersRef.current.set(conversationId, controller);

        try {
          const reply = await requestOfficeConversationTurn({
            session: requestSession,
            profileMap: getProfileMap(assignmentsRef.current),
            relationships: profiles.relations,
            signal: controller.signal,
            storage: initialContext.storage,
          });
          const latest = stateRef.current.conversations?.[conversationId];
          const isCurrentController = conversationControllersRef.current.get(conversationId) === controller;
          const isCurrentReply = latest
            && latest.requestSequence === requestSequence
            && reply?.conversationId === conversationId
            && reply.requestSequence === requestSequence
            && latest.memberIds.includes(reply.speakerId);
          if (!isCurrentController || !isCurrentReply) return;

          const entry = {
            conversationId,
            requestSequence,
            speakerId: reply.speakerId,
            text: reply.text,
            end: Boolean(reply.end),
          };
          dispatchOffice({ type: "APPEND_CONVERSATION", conversationId, entry });
          dispatchOffice({ type: "QUEUE_BUBBLE", conversationId, bubble: entry });
          dispatchOffice({
            type: "UPDATE_CONVERSATION_IO",
            conversationId,
            requestSequence,
            turnIndex: latest.turnIndex + 1,
            lastResponse: entry,
          });
          runtime.pendingEnd = Boolean(reply.end);
        } finally {
          if (conversationControllersRef.current.get(conversationId) === controller) {
            conversationControllersRef.current.delete(conversationId);
          }
          if (conversationRuntimeRef.current.get(conversationId) === runtime) {
            runtime.inFlight = false;
          }
        }
      }, 700);
    }
  }, [
    closeConversation,
    dispatchOffice,
    initialContext.storage,
    profiles.relations,
    state.conversations,
    stopConversationRuntime,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      uploadReadersRef.current.abortAll();
      if (statePersistTimerRef.current) clearTimeout(statePersistTimerRef.current);
      persistOfficeState();
      for (const controller of activityControllersRef.current.values()) controller.abort();
      activityControllersRef.current.clear();
      for (const conversationId of [...conversationRuntimeRef.current.keys()]) {
        stopConversationRuntime(conversationId);
      }
    };
  }, [persistOfficeState, stopConversationRuntime]);

  const applyAssignmentInMemory = useCallback((slotId, nextAssignments) => {
    if (!isMountedRef.current) return false;
    const nextAssignment = nextAssignments[slotId];
    assignmentsRef.current = nextAssignments;
    setAssignments(nextAssignments);
    dispatchOffice({
      type: "ASSIGN_PROFILE",
      slotId,
      assignment: {
        profileId: nextAssignment.profileId,
        profile: nextAssignment.profile,
      },
    });
    return true;
  }, [dispatchOffice]);

  const refreshProfiles = useCallback(() => {
    const nextProfiles = readOfficeProfiles(initialContext.storage);
    const currentAssignments = assignmentsRef.current;
    const normalized = normalizeOfficeAssignments(
      Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => [
        slotId,
        currentAssignments[slotId]?.profileId || "",
      ])),
      nextProfiles,
    );
    const nextAssignments = Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => [slotId, {
      ...currentAssignments[slotId],
      profileId: normalized[slotId].profileId,
      profile: normalized[slotId].profile,
    }]));

    setProfiles(nextProfiles);
    assignmentsRef.current = nextAssignments;
    setAssignments(nextAssignments);
    safeSetItem(initialContext.storage, OFFICE_ASSIGNMENT_KEY, serializeAssignments(nextAssignments));
    for (const slotId of OFFICE_SLOT_IDS) {
      dispatchOffice({
        type: "ASSIGN_PROFILE",
        slotId,
        assignment: {
          profileId: nextAssignments[slotId].profileId,
          profile: nextAssignments[slotId].profile,
        },
      });
    }
  }, [dispatchOffice, initialContext.storage]);

  useEffect(() => {
    refreshProfiles();
    const profileStorageKeys = new Set(["apiMeProfiles", "apiCharacters", "apiRelations"]);
    const handleStorage = (event) => {
      if (profileStorageKeys.has(event.key)) refreshProfiles();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshProfiles]);

  const replaceAssignment = useCallback((slotId, nextAssignment, options = {}) => {
    const currentAssignments = assignmentsRef.current;
    const candidateAssignments = {
      ...currentAssignments,
      [slotId]: nextAssignment,
    };
    const committed = commitOfficeAssignments(
      initialContext.storage,
      currentAssignments,
      candidateAssignments,
    );
    if (!committed.ok) {
      setAssignmentError(slotId, options.failureMessage || ASSIGNMENT_STORAGE_ERROR);
      return false;
    }

    applyAssignmentInMemory(slotId, committed.assignments);
    setAssignmentError(slotId, options.successMessage || "");
    return true;
  }, [applyAssignmentInMemory, initialContext.storage, setAssignmentError]);

  const handleProfileChange = useCallback((slotId, profileId) => {
    if (profileId && OFFICE_SLOT_IDS.some((otherSlotId) => (
      otherSlotId !== slotId && assignmentsRef.current[otherSlotId]?.profileId === profileId
    ))) return;

    const normalized = normalizeOfficeAssignments({ [slotId]: profileId }, profiles);
    replaceAssignment(slotId, {
      ...assignmentsRef.current[slotId],
      profileId: normalized[slotId].profileId,
      profile: normalized[slotId].profile,
    });
  }, [profiles, replaceAssignment]);

  const handleChibiChange = useCallback((slotId, chibiId) => {
    replaceAssignment(slotId, {
      ...assignmentsRef.current[slotId],
      chibiId,
    });
  }, [replaceAssignment]);

  const handleCustomDraftChange = useCallback((slotId, value) => {
    if (!isMountedRef.current) return;
    setCustomDrafts((current) => ({ ...current, [slotId]: value }));
    if (!isAcceptedCustomAssetSource(value)) {
      setAssignmentError(slotId, "");
      return;
    }
    replaceAssignment(slotId, {
      ...assignmentsRef.current[slotId],
      customAssetSrc: cleanText(value),
    }, {
      failureMessage: CUSTOM_ASSET_STORAGE_ERROR,
    });
  }, [replaceAssignment, setAssignmentError]);

  const handleUpload = useCallback((slotId, event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    const readers = uploadReadersRef.current;
    readers.abort(slotId);
    if (!file) return;

    const validation = validateOfficeImageFile(file);
    if (!validation.ok) {
      setAssignmentError(
        slotId,
        validation.reason === "too-large"
          ? "图片不能超过 1 MB，请使用更小图片或图片 URL"
          : "请选择图片文件",
      );
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (!isMountedRef.current || !readers.isCurrent(slotId, reader)) return;
      readers.finish(slotId, reader);
      const source = typeof reader.result === "string" ? reader.result : "";
      if (!source.startsWith("data:image/") || !isAcceptedCustomAssetSource(source)) {
        setAssignmentError(slotId, "图片读取失败，请重试或使用图片 URL");
        return;
      }
      const saved = replaceAssignment(slotId, {
        ...assignmentsRef.current[slotId],
        customAssetSrc: source,
      }, {
        failureMessage: CUSTOM_ASSET_STORAGE_ERROR,
      });
      if (saved && isMountedRef.current) {
        setCustomDrafts((current) => ({ ...current, [slotId]: source }));
      }
    }, { once: true });
    reader.addEventListener("error", () => {
      if (!readers.finish(slotId, reader) || !isMountedRef.current) return;
      setAssignmentError(slotId, "图片读取失败，请重试或使用图片 URL");
    }, { once: true });
    reader.addEventListener("abort", () => {
      readers.finish(slotId, reader);
    }, { once: true });
    readers.start(slotId, reader);
    try {
      reader.readAsDataURL(file);
    } catch {
      if (readers.finish(slotId, reader) && isMountedRef.current) {
        setAssignmentError(slotId, "图片读取失败，请重试或使用图片 URL");
      }
    }
  }, [replaceAssignment, setAssignmentError]);

  const onAssetError = useCallback((slotId) => {
    if (!isMountedRef.current) return;
    setCustomDrafts((current) => ({ ...current, [slotId]: "" }));
    const nextAssignment = {
      ...assignmentsRef.current[slotId],
      customAssetSrc: "",
    };
    const saved = replaceAssignment(slotId, nextAssignment, {
      failureMessage: `${CUSTOM_ASSET_LOAD_ERROR}，但清理结果未保存`,
      successMessage: CUSTOM_ASSET_LOAD_ERROR,
    });
    if (saved) return;

    applyAssignmentInMemory(slotId, {
      ...assignmentsRef.current,
      [slotId]: nextAssignment,
    });
    setAssignmentError(slotId, `${CUSTOM_ASSET_LOAD_ERROR}，但清理结果未保存`);
  }, [applyAssignmentInMemory, replaceAssignment, setAssignmentError]);

  const handleModeChange = useCallback((mode) => {
    dispatchOffice({ type: "SET_MODE", mode });
    nextScheduleAtRef.current = Date.now() + MODE_SCHEDULE_NUDGE_MS;
  }, [dispatchOffice]);

  const handleMeeting = useCallback(() => {
    const snapshot = stateRef.current;
    const memberIds = getAvailableCharacterIds(snapshot).slice(0, 3);
    if (memberIds.length < 2) return;

    const now = Date.now();
    const leaderId = memberIds[0];
    const targetAnchors = memberIds.map((_, index) => `whiteboard:${index + 1}`);
    const reservationGroupId = `office-chatting-${now}-${memberIds.join("-")}`;
    const endsAt = now + 45_000;
    const reservations = reserveAnchors(snapshot.reservations, {
      sceneId: "office",
      reservationGroupId,
      slotId: leaderId,
      anchorIds: targetAnchors,
      now,
      expiresAt: endsAt,
    });
    if (!reservations) return;
    const routesByActor = Object.fromEntries(memberIds.map((slotId, index) => {
      const from = getCharacterWorldPoint(snapshot.characters[slotId], sampledWorldActorsRef.current[slotId]);
      const to = getSceneAnchor("office", targetAnchors[index]);
      return [slotId, buildWorldRoute({ from, to: to && { sceneId: "office", x: to.x, y: to.y } })];
    }));
    if (Object.values(routesByActor).some((route) => !route.length)) return;
    const definition = getActivityDefinition("chatting");

    applyScheduledEvent({
      activityId: "chatting",
      actorIds: memberIds,
      sceneId: "office",
      hostId: leaderId,
      visitorIds: memberIds.slice(1),
      locationId: "whiteboard",
      anchorByMember: Object.fromEntries(memberIds.map((slotId, index) => [slotId, targetAnchors[index]])),
      targetAnchors,
      reservationGroupId,
      routesByActor,
      propState: {
        category: definition.propState.category,
        variant: "project",
        actorRoles: Object.fromEntries(memberIds.map((slotId, index) => [slotId, index === 0 ? "host" : "visitor"])),
      },
      semanticContext: {
        eventId: reservationGroupId,
        activityId: "chatting",
        status: definition.status,
        semanticFallback: { ...definition.semanticFallback },
      },
      startedAt: now,
      endsAt,
    }, reservations);
  }, [applyScheduledEvent]);

  const occupiedProfiles = useMemo(() => {
    const occupied = new Map();
    for (const slotId of OFFICE_SLOT_IDS) {
      const assignment = assignments[slotId];
      if (assignment?.profileId && !assignment.profile?.generated) {
        occupied.set(assignment.profileId, slotId);
      }
    }
    return occupied;
  }, [assignments]);

  const remainingMs = getRemainingMs(state, state.now);
  const availableMeetingMembers = getAvailableCharacterIds(state).length;
  const meetingReserved = ["whiteboard:1", "whiteboard:2", "whiteboard:3"]
    .some((anchorId) => Boolean(state.reservations?.[anchorId]));
  const assignmentView = selectedAssignmentSlotId ? "selection" : "overview";
  const panelOpen = assignmentPanelOpen || activityPanelOpen;
  const handleVisibleSceneChange = useCallback(() => {
    dispatchOffice({
      type: "SET_VISIBLE_SCENE",
      sceneId: stateRef.current.visibleSceneId === "office" ? "lounge" : "office",
    });
  }, [dispatchOffice]);

  return (
    <main className="work-app-screen">
      <header
        className="work-app-header"
        aria-hidden={panelOpen || undefined}
        inert={panelOpen}
      >
        <button
          type="button"
          className="work-icon-button"
          aria-label="返回"
          title="返回"
          onClick={onClose}
        >
          <ArrowLeft size={21} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <div className="work-remaining" role="timer" aria-live="off">
          <span>工作剩余</span>
          <strong>{formatRemainingTime(remainingMs)}</strong>
        </div>
        <button
          type="button"
          className="work-icon-button"
          aria-label="员工安排"
          title="员工安排"
          aria-expanded={assignmentPanelOpen}
          onClick={openAssignmentPanel}
        >
          <Users size={21} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="work-icon-button"
          aria-label="对话记录"
          title="对话记录"
          aria-expanded={activityPanelOpen}
          ref={activityOpenerRef}
          onClick={openActivityPanel}
        >
          <Ellipsis size={22} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </header>

      <nav
        className="work-mode-control"
        aria-label="工作模式"
        aria-hidden={panelOpen || undefined}
        inert={panelOpen}
      >
        {MODE_OPTIONS.map((mode) => (
          <button
            key={mode.id}
            type="button"
            data-active={state.mode === mode.id}
            aria-pressed={state.mode === mode.id}
            onClick={() => handleModeChange(mode.id)}
          >
            {mode.label}
          </button>
        ))}
        <button
          type="button"
          className="work-meeting-command"
          disabled={availableMeetingMembers < 2 || meetingReserved}
          aria-label="开会"
          title={availableMeetingMembers < 2 ? "当前可用成员不足" : "开会"}
          onClick={handleMeeting}
        >
          开会
        </button>
      </nav>

      <div
        className="work-office-surface"
        aria-hidden={panelOpen || undefined}
        inert={panelOpen}
      >
        <OfficeScene
          state={state}
          assignments={assignments}
          sampledWorldActors={sampledWorldActors}
          motionNow={motionNow}
          onSlotSelect={openAssignmentPanel}
          onStationSelect={handleVisibleSceneChange}
        />
      </div>

      {assignmentPanelOpen && (
        <aside
          className="office-assignment-panel"
          aria-label="员工安排"
          aria-modal="true"
          role="dialog"
          tabIndex={-1}
          ref={assignmentDialogRef}
          onKeyDown={handleAssignmentDialogKeyDown}
        >
          <OfficeAssignmentFlow
            view={assignmentView}
            selectedSlotId={selectedAssignmentSlotId}
            slots={SLOT_DETAILS}
            assignments={assignments}
            assignmentErrors={assignmentErrors}
            profiles={profiles}
            occupiedProfiles={occupiedProfiles}
            onOpenSlot={setSelectedAssignmentSlotId}
            onBack={() => selectedAssignmentSlotId ? setSelectedAssignmentSlotId("") : closeAssignmentPanel()}
            onProfileChange={handleProfileChange}
            onChibiChange={handleChibiChange}
            onUpload={handleUpload}
            onCustomDraftChange={handleCustomDraftChange}
          />
        </aside>
      )}

      <OfficeConversationPanel
        open={activityPanelOpen}
        activeConversations={state.conversations}
        conversationRecords={state.conversationRecords}
        onClose={() => setActivityPanelOpen(false)}
      />
    </main>
  );
}
