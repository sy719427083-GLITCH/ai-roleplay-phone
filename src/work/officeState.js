import { normalizeAssignments, OFFICE_SLOT_IDS } from "./officeProfiles.js";
import { OFFICE_NODES } from "./officeNavigation.js";

export const OFFICE_STORAGE_KEY = "ccatWorkOfficeV1";
export const OFFICE_STATE_VERSION = 1;
export const VALID_WAYPOINTS = new Set(Object.keys(OFFICE_NODES));

export const createOfficeState = (profiles = []) => ({
  version: OFFICE_STATE_VERSION,
  assignments: normalizeAssignments({}, profiles),
  avatarOverrides: {},
  meWaypoint: "boss-home",
});

export function restoreOfficeState(raw, profiles) {
  let parsed = {};
  try { parsed = JSON.parse(raw || "{}"); } catch { parsed = {}; }
  return {
    version: OFFICE_STATE_VERSION,
    assignments: normalizeAssignments(parsed.assignments, profiles),
    avatarOverrides: parsed.avatarOverrides && typeof parsed.avatarOverrides === "object" && !Array.isArray(parsed.avatarOverrides) ? parsed.avatarOverrides : {},
    meWaypoint: VALID_WAYPOINTS.has(parsed.meWaypoint) ? parsed.meWaypoint : "boss-home",
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
  return state;
}

export const resolveOfficeAvatar = (profile, overrides) => overrides[profile.id]?.value || profile.avatar || "";
