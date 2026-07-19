import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArrowLeft, Ellipsis, Users } from "lucide-react";
import OfficeActivityPanel from "./OfficeActivityPanel.jsx";
import OfficeAssignmentFlow from "./OfficeAssignmentFlow.jsx";
import OfficeScene from "./OfficeScene.jsx";
import { OFFICE_CHIBIS } from "./pixi/officeAssetManifest.js";
import { createOfficeActivityEvent } from "./officeActivities.js";
import { requestOfficeActivityDetail } from "./officeActivityApi.js";
import { requestOfficeConversationTurn } from "./officeConversationApi.js";
import { claimAnchor, findOfficeRoute } from "./officeNavigation.js";
import { sampleOfficeRoute } from "./officeMotion.js";
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
import "./office.css";

const OFFICE_STATE_KEY = "ccatOfficeStateV1";
const TICK_INTERVAL_MS = 250;
const SCHEDULE_MIN_MS = 4_000;
const SCHEDULE_MAX_MS = 8_000;
const STATE_PERSIST_DEBOUNCE_MS = 1_000;
const MODE_SCHEDULE_NUDGE_MS = 350;
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

const DESK_ACTIVITIES = new Set([
  "working",
  "slacking",
  "gaming",
  "reading",
  "watchingSeries",
  "watchingShortVideo",
]);
const AVAILABLE_PHASES = new Set(["idle", "working"]);
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

const getGraphReturnRoute = (slotId, character) => findOfficeRoute(
  character?.positionNode || character?.reservedAnchorId || `${slotId}-home`,
  `${slotId}-home`,
);

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
  const [assignmentErrors, setAssignmentErrors] = useState({});
  const [, setCustomDrafts] = useState(() => Object.fromEntries(
    OFFICE_SLOT_IDS.map((slotId) => [slotId, initialContext.assignments[slotId].customAssetSrc]),
  ));

  const stateRef = useRef(state);
  const assignmentsRef = useRef(assignments);
  const sessionStartedAtRef = useRef(initialContext.now);
  const nextScheduleAtRef = useRef(initialContext.now + getRandomCadence());
  const statePersistTimerRef = useRef(null);
  const pendingActivitiesRef = useRef(new Map());
  const pendingConversationsRef = useRef(new Map());
  const returningMealPropsRef = useRef(new Map());
  const activityControllersRef = useRef(new Map());
  const activityCounterRef = useRef(initialContext.initialState.activityEvents?.length || 0);
  const conversationControllersRef = useRef(new Map());
  const conversationRuntimeRef = useRef(new Map());
  const completedRouteKeysRef = useRef(new Set());
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

  const completeActivityEvents = useCallback((slotIds, endedAt = Date.now()) => {
    for (const slotId of new Set(slotIds)) {
      const eventId = stateRef.current.activeEventBySlot?.[slotId];
      if (!eventId) continue;
      dispatchOffice({ type: "COMPLETE_ACTIVITY_EVENT", eventId, endedAt });
    }
  }, [dispatchOffice]);

  const createActivityRuntime = useCallback((event) => {
    const actorId = event.slotId || event.leaderId || event.memberIds?.[0];
    if (!actorId || !assignmentsRef.current[actorId]) return null;
    const participantIds = event.memberIds || [actorId];
    const now = Number.isFinite(event.now) ? event.now : Date.now();
    completeActivityEvents(participantIds, now);

    const activityEvent = createOfficeActivityEvent({
      eventId: `activity-${stateRef.current.workSessionId}-${activityCounterRef.current++}`,
      workSessionId: stateRef.current.workSessionId,
      actorId,
      participantIds,
      profileSnapshots: participantIds.map((slotId) => (
        createOfficeProfileSnapshot(
          assignmentsRef.current[slotId]?.profile,
          slotId === "boss" ? "me" : "character",
        )
      )),
      activityType: event.activity,
      propVariant: event.meal || event.propVariant || "",
      startedAt: now,
      requestSequence: 1,
      conversationId: event.session?.id || "",
      conversationTopic: event.session?.topic || "",
    });
    dispatchOffice({ type: "CREATE_ACTIVITY_EVENT", event: activityEvent });

    const controller = new AbortController();
    activityControllersRef.current.set(activityEvent.eventId, controller);
    requestOfficeActivityDetail({
      event: activityEvent,
      signal: controller.signal,
      storage: initialContext.storage,
    }).then((detail) => {
      if (!isMountedRef.current) return;
      if (activityControllersRef.current.get(activityEvent.eventId) !== controller) return;
      dispatchOffice({ type: "ENRICH_ACTIVITY_EVENT", detail });
    }).finally(() => {
      if (activityControllersRef.current.get(activityEvent.eventId) === controller) {
        activityControllersRef.current.delete(activityEvent.eventId);
      }
    });

    return activityEvent;
  }, [completeActivityEvents, dispatchOffice, initialContext.storage]);

  const closeConversation = useCallback((conversationId) => {
    const snapshot = stateRef.current;
    const conversation = snapshot.conversations?.[conversationId];
    if (!conversation) return;

    const returnRoutes = {};
    for (const slotId of conversation.memberIds) {
      const route = getGraphReturnRoute(slotId, snapshot.characters?.[slotId]);
      if (route.length) returnRoutes[slotId] = route;
    }

    completeActivityEvents(conversation.memberIds, Date.now());
    stopConversationRuntime(conversationId);
    dispatchOffice({
      type: "CLOSE_CONVERSATION",
      conversationId,
      returnRoutes,
    });
  }, [completeActivityEvents, dispatchOffice, stopConversationRuntime]);

  const startConversationWalk = useCallback((event) => {
    pendingConversationsRef.current.set(event.session.id, {
      memberIds: [...event.memberIds],
      session: event.session,
    });
    dispatchOffice({ type: "SET_RESERVATIONS", reservations: event.reservations });

    for (const slotId of event.memberIds) {
      dispatchOffice({
        type: "START_ACTIVITY",
        slotId,
        activity: "chatting",
        anchorId: event.anchorId,
        route: event.routesByMember[slotId],
        now: event.now,
      });
    }
  }, [dispatchOffice]);

  const startDeskActivity = useCallback((event) => {
    const snapshot = stateRef.current;
    const character = snapshot.characters?.[event.slotId];
    if (!character) return;
    const duration = event.activity === "working"
      ? 12_000 + Math.floor(Math.random() * 6_000)
      : 9_000 + Math.floor(Math.random() * 5_000);
    const activityProps = {
      ...(event.propVariant ? { propVariant: event.propVariant } : {}),
    };

    dispatchOffice({
      type: "START_ACTIVITY",
      slotId: event.slotId,
      activity: event.activity,
      anchorId: character.homeNode,
      route: [character.homeNode],
      now: event.now,
    });
    dispatchOffice({
      type: "ARRIVE_ACTIVITY",
      slotId: event.slotId,
      now: event.now,
      endsAt: event.now + duration,
      ...activityProps,
    });
  }, [dispatchOffice]);

  const applyScheduledEvent = useCallback((event) => {
    if (!event) return;
    createActivityRuntime(event);
    if (event.activity === "chatting") {
      startConversationWalk(event);
      return;
    }
    if (event.activity === "eating") {
      pendingActivitiesRef.current.set(event.slotId, { meal: event.meal });
      dispatchOffice({ type: "SET_RESERVATIONS", reservations: event.reservations });
      dispatchOffice({
        type: "START_ACTIVITY",
        slotId: event.slotId,
        activity: "eating",
        anchorId: event.anchorId,
        route: event.route,
        now: event.now,
      });
      return;
    }
    if (DESK_ACTIVITIES.has(event.activity)) startDeskActivity(event);
  }, [createActivityRuntime, dispatchOffice, startConversationWalk, startDeskActivity]);

  const runScheduleAttempt = useCallback((now) => {
    const event = chooseOfficeEvent({
      state: stateRef.current,
      profiles: getProfileMap(assignmentsRef.current),
      random: Math.random,
      now,
    });
    applyScheduledEvent(event);
  }, [applyScheduledEvent]);

  const routeSamples = useMemo(() => Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => {
    const character = state.characters?.[slotId];
    if (!character || !["walkingToActivity", "returning"].includes(character.phase)) {
      return [slotId, null];
    }
    return [slotId, sampleOfficeRoute({
      route: character.route,
      startedAt: character.routeStartedAt,
      now: motionNow,
    })];
  })), [motionNow, state.characters]);

  useEffect(() => {
    const activeRouteKeys = new Set();

    for (const slotId of OFFICE_SLOT_IDS) {
      const character = state.characters?.[slotId];
      const sample = routeSamples[slotId];
      if (!character || !sample) continue;
      const routeKey = `${slotId}:${character.routeStartedAt}`;
      activeRouteKeys.add(routeKey);
      if (!sample.done || completedRouteKeysRef.current.has(routeKey)) continue;
      completedRouteKeysRef.current.add(routeKey);

      const completion = { type: "COMPLETE_ROUTE", slotId, now: motionNow };
      if (character.phase === "returning") {
        returningMealPropsRef.current.delete(slotId);
      } else if (character.activity === "eating") {
        const pending = pendingActivitiesRef.current.get(slotId) || {};
        pendingActivitiesRef.current.delete(slotId);
        completion.endsAt = motionNow + 12_000 + Math.floor(Math.random() * 5_000);
        completion.meal = pending.meal || "bento";
      } else if (character.activity === "chatting") {
        const pending = [...pendingConversationsRef.current.values()]
          .find((entry) => entry.memberIds.includes(slotId));
        completion.endsAt = pending?.session.endsAt || motionNow + 45_000;
      }
      dispatchOffice(completion);
    }

    for (const routeKey of completedRouteKeysRef.current) {
      if (!activeRouteKeys.has(routeKey)) completedRouteKeysRef.current.delete(routeKey);
    }

    for (const [conversationId, pending] of pendingConversationsRef.current) {
      const current = stateRef.current;
      const allArrived = pending.memberIds.every((slotId) => {
        const character = current.characters?.[slotId];
        return character
          && character.phase === "chatting"
          && character.positionNode === pending.session.anchorId
          && !character.conversationId;
      });
      if (!allArrived) continue;
      dispatchOffice({ type: "OPEN_CONVERSATION", session: pending.session });
      if (stateRef.current.conversations?.[conversationId]) {
        pendingConversationsRef.current.delete(conversationId);
      }
    }
  }, [dispatchOffice, motionNow, routeSamples, state.characters]);

  const resolveExpiredActivities = useCallback((now) => {
    const snapshot = stateRef.current;

    for (const conversation of Object.values(snapshot.conversations || {})) {
      if (conversation.endsAt && conversation.endsAt <= now) closeConversation(conversation.id);
    }

    for (const slotId of OFFICE_SLOT_IDS) {
      const character = stateRef.current.characters?.[slotId];
      if (!character?.activityEndsAt || character.activityEndsAt > now) continue;

      if (character.phase === "eating" && character.activity === "eating") {
        const route = getGraphReturnRoute(slotId, character);
        if (!route.length) continue;
        completeActivityEvents([slotId], now);
        returningMealPropsRef.current.set(slotId, character.props);
        dispatchOffice({ type: "START_RETURN", slotId, route, now });
        continue;
      }

      if (DESK_ACTIVITIES.has(character.activity)
        && character.positionNode === character.homeNode) {
        completeActivityEvents([slotId], now);
        dispatchOffice({ type: "FINISH_RETURN", slotId });
      }
    }
  }, [closeConversation, completeActivityEvents, dispatchOffice]);

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
      setMotionNow(timestampOriginRef.current + timestamp);
      frameId = window.requestAnimationFrame(frame);
    };
    frameId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

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
            activity: "chatting",
          },
        });

        const requestSession = {
          ...current,
          requestSequence,
          currentActivity: "chatting",
          promptContext: {
            ...current.promptContext,
            activity: "chatting",
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
    const memberIds = getAvailableCharacterIds(snapshot).slice(0, 5);
    if (memberIds.length < 2) return;

    const leaderId = memberIds[0];
    const reservations = claimAnchor(snapshot.reservations, "meeting-1", leaderId);
    if (!reservations) return;
    const routesByMember = Object.fromEntries(memberIds.map((slotId) => [
      slotId,
      findOfficeRoute(snapshot.characters[slotId].positionNode, "meeting-1"),
    ]));
    if (Object.values(routesByMember).some((route) => !route.length)) return;

    const now = Date.now();
    const session = buildConversationSession({
      memberIds,
      anchorId: "meeting-1",
      now,
      random: Math.random,
    });
    if (!session) return;

    applyScheduledEvent({
      activity: "chatting",
      anchorId: "meeting-1",
      leaderId,
      memberIds,
      now,
      reservations,
      routesByMember,
      session,
    });
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
  const assignmentView = selectedAssignmentSlotId ? "selection" : "overview";
  const panelOpen = assignmentPanelOpen || activityPanelOpen;
  const sceneState = useMemo(() => ({
    ...state,
    characters: Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => {
      const character = state.characters[slotId];
      const returningMealProps = returningMealPropsRef.current.get(slotId);
      return [slotId, {
        ...character,
        props: returningMealProps && character.phase === "returning"
          ? returningMealProps
          : character.props,
      }];
    })),
  }), [state]);

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
          aria-label="活动记录"
          title="活动记录"
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
          disabled={availableMeetingMembers < 2 || Boolean(state.reservations?.["meeting-1"])}
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
          state={sceneState}
          assignments={assignments}
          motionNow={motionNow}
          onSlotSelect={openAssignmentPanel}
          onAssetError={onAssetError}
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

      <OfficeActivityPanel
        open={activityPanelOpen}
        events={state.activityEvents}
        workSessionId={state.workSessionId}
        assignments={assignments}
        onClose={() => setActivityPanelOpen(false)}
      />
    </main>
  );
}
