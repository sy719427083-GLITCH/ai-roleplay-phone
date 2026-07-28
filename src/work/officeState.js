import { normalizeAssignments, OFFICE_SLOT_IDS } from "./officeProfiles.js";
import { OFFICE_ACTIVITY_POINTS, OFFICE_HOME_POINTS, OFFICE_INTERACTION_POINTS } from "./officeGeometry.js";

export const OFFICE_STORAGE_KEY = "ccatWorkOfficeV1";
export const OFFICE_STATE_VERSION = 2;
export const VALID_WAYPOINTS = new Set([...Object.keys(OFFICE_HOME_POINTS), ...Object.keys(OFFICE_INTERACTION_POINTS), ...Object.keys(OFFICE_ACTIVITY_POINTS)]);

const createSimulationState = () => ({ mode: "local", dateKey: "", seed: "", intervalKey: "", plan: null, nextTransitionAt: 0, conversationCache: null, manualMe: null });

function sanitizeConversation(value) {
  if (!value || typeof value !== "object") return null;
  return { ...value, turns: (Array.isArray(value.turns) ? value.turns : []).slice(0, 6).map((turn) => ({ speakerId: String(turn?.speakerId || ""), text: String(turn?.text || "").slice(0, 42) })).filter((turn) => turn.speakerId && turn.text) };
}

function restoreSimulation(value = {}) {
  return {
    ...createSimulationState(),
    mode: value.mode === "ai" ? "ai" : "local",
    dateKey: typeof value.dateKey === "string" ? value.dateKey : "",
    seed: typeof value.seed === "string" ? value.seed : "",
    intervalKey: typeof value.intervalKey === "string" ? value.intervalKey : "",
    plan: value.plan && typeof value.plan === "object" ? value.plan : null,
    nextTransitionAt: Number.isFinite(Number(value.nextTransitionAt)) ? Number(value.nextTransitionAt) : 0,
    conversationCache: sanitizeConversation(value.conversationCache),
    manualMe: value.manualMe && Number(value.manualMe.endsAt) > Date.now() ? value.manualMe : null,
  };
}

function restoreWaypoint(waypoint) {
  if (waypoint === "tea-counter") return "print-station";
  return VALID_WAYPOINTS.has(waypoint) ? waypoint : "boss-home";
}

export const createOfficeState = (profiles = []) => ({
  version: OFFICE_STATE_VERSION,
  assignments: normalizeAssignments({}, profiles),
  avatarOverrides: {},
  meWaypoint: "boss-home",
  simulation: createSimulationState(),
});

export function restoreOfficeState(raw, profiles) {
  let parsed = {};
  try { parsed = JSON.parse(raw || "{}"); } catch { parsed = {}; }
  return {
    version: OFFICE_STATE_VERSION,
    assignments: normalizeAssignments(parsed.assignments, profiles),
    avatarOverrides: parsed.avatarOverrides && typeof parsed.avatarOverrides === "object" && !Array.isArray(parsed.avatarOverrides) ? parsed.avatarOverrides : {},
    meWaypoint: restoreWaypoint(parsed.meWaypoint),
    simulation: restoreSimulation(parsed.simulation),
  };
}

export function officeReducer(state, action) {
  if (action.type === "ASSIGN" && OFFICE_SLOT_IDS.includes(action.slotId)) {
    const assignments = Object.fromEntries(Object.entries(state.assignments)
      .map(([slotId, profileId]) => [slotId, profileId === action.profileId ? null : profileId]));
    assignments[action.slotId] = action.profileId || null;
    const isMe = String(action.profileId || "").startsWith("me:");
    return { ...state, assignments, meWaypoint: isMe ? `${action.slotId}-home` : state.meWaypoint };
  }
  if (action.type === "SET_AVATAR_OVERRIDE" && action.profileId && action.value?.value) {
    return { ...state, avatarOverrides: { ...state.avatarOverrides, [action.profileId]: action.value } };
  }
  if (action.type === "CLEAR_AVATAR_OVERRIDE") {
    const avatarOverrides = { ...state.avatarOverrides };
    delete avatarOverrides[action.profileId];
    return { ...state, avatarOverrides };
  }
  if (action.type === "SET_WAYPOINT" && VALID_WAYPOINTS.has(action.waypoint)) return { ...state, meWaypoint: action.waypoint };
  if (action.type === "SET_SIMULATION_MODE" && ["local", "ai"].includes(action.mode)) return { ...state, simulation: { ...state.simulation, mode: action.mode, plan: null, intervalKey: "" } };
  if (action.type === "SET_SCENE_PLAN") return { ...state, simulation: { ...state.simulation, ...action.value, plan: action.value?.plan || null } };
  if (action.type === "CACHE_CONVERSATION") return { ...state, simulation: { ...state.simulation, conversationCache: sanitizeConversation(action.conversation) } };
  if (action.type === "START_MANUAL_ME") return { ...state, simulation: { ...state.simulation, manualMe: action.value || null } };
  if (action.type === "END_MANUAL_ME") return { ...state, simulation: { ...state.simulation, manualMe: null } };
  return state;
}

export const resolveOfficeAvatar = (profile, overrides) => overrides[profile.id]?.value || profile.avatar || "";
