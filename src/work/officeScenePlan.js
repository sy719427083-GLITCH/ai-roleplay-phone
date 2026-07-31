import { getOfficePoint } from "./officeGeometry.js";
import { normalizeProjectOfficePlan } from "./officeProjectTasks.js";

export const VALID_OFFICE_ACTIVITIES = new Set(["idle", "working", "reporting", "printing", "chatting", "resting", "gaming", "scrolling", "slacking", "offDuty"]);
export const OFFICE_DESK_ACTIVITIES = new Set(["idle", "working", "reporting", "scrolling", "gaming", "slacking"]);

export function resolveOfficeActivityDestination(activity, occupant, fallbackDestination) {
  if (OFFICE_DESK_ACTIVITIES.has(activity) && occupant?.slotId) return `${occupant.slotId}-home`;
  return fallbackDestination;
}

export function getDistinctConversationIds(ids = [], validIds = null) {
  return [...new Set(ids.filter((id) => typeof id === "string" && id && (!validIds || validIds.has(id))))].slice(0, 4);
}

export function validateOfficeScenePlan(plan, { profileIds = new Set(), now = Date.now() } = {}) {
  const issues = [];
  if (!plan || typeof plan !== "object" || !plan.characters || typeof plan.characters !== "object") issues.push("plan");
  for (const [profileId, activity] of Object.entries(plan?.characters || {})) {
    if (!profileIds.has(profileId)) issues.push(`profile:${profileId}`);
    if (!VALID_OFFICE_ACTIVITIES.has(activity?.activity)) issues.push(`activity:${profileId}`);
    if (!getOfficePoint(activity?.destination)) issues.push(`destination:${profileId}`);
    if (activity?.startsAt != null && !(Number(activity.endsAt) > Math.max(Number(now), Number(activity.startsAt)))) issues.push(`time:${profileId}`);
  }
  const participants = plan?.conversation?.participantIds;
  if (participants && (!Array.isArray(participants) || getDistinctConversationIds(participants, profileIds).length < 2 || participants.length > 4 || participants.some((id) => !profileIds.has(id)))) issues.push("conversation");
  return { valid: issues.length === 0, plan, issues };
}

export function normalizeOfficeConversation(plan, occupants = []) {
  const next = {
    ...plan,
    characters: Object.fromEntries(Object.entries(plan?.characters || {}).map(([id, item]) => [id, { ...item }])),
  };
  const assignedIds = new Set(occupants.map((occupant) => occupant.profile.id));
  const participantIds = getDistinctConversationIds(next.conversation?.participantIds || [], assignedIds);
  const hasConversation = Boolean(next.conversation) && participantIds.length >= 2;
  next.conversation = hasConversation ? { ...next.conversation, participantIds } : null;
  const activeChatters = new Set(hasConversation ? participantIds : []);
  for (const occupant of occupants) {
    const profileId = occupant.profile.id;
    const activity = next.characters[profileId];
    if (activity?.activity === "chatting" && !activeChatters.has(profileId)) {
      next.characters[profileId] = {
        ...activity,
        activity: "working",
        label: "工作中",
        destination: `${occupant.slotId}-home`,
      };
    }
  }
  return next;
}

export function allocateOfficeActivities(plan, occupants = [], options = {}) {
  const next = { ...plan, characters: Object.fromEntries(Object.entries(plan?.characters || {}).map(([id, item]) => [id, { ...item }])) };
  let printerTaken = false;
  for (const occupant of occupants) {
    const item = next.characters[occupant.profile.id];
    if (!item) continue;
    const corrected = {
      ...item,
      destination: resolveOfficeActivityDestination(item.activity, occupant, item.destination),
    };
    next.characters[occupant.profile.id] = corrected;
    if (corrected.destination === "print-station") {
      if (printerTaken) next.characters[occupant.profile.id] = { ...corrected, destination: "print-wait", label: "等待打印" };
      printerTaken = true;
    }
  }
  return normalizeProjectOfficePlan(normalizeOfficeConversation(next, occupants), {
    occupants,
    projectContext: options.projectContext,
    intervalKey: options.intervalKey || plan?.id || "",
    now: options.now,
  });
}
