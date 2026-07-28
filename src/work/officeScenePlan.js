import { getOfficePoint } from "./officeGeometry.js";

export const VALID_OFFICE_ACTIVITIES = new Set(["working", "reporting", "printing", "chatting", "resting", "gaming", "scrolling", "slacking", "offDuty"]);

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

export function allocateOfficeActivities(plan, occupants = []) {
  const next = { ...plan, characters: Object.fromEntries(Object.entries(plan?.characters || {}).map(([id, item]) => [id, { ...item }])) };
  let printerTaken = false;
  for (const occupant of occupants) {
    const item = next.characters[occupant.profile.id];
    if (!item) continue;
    if (item.destination === "print-station") {
      if (printerTaken) next.characters[occupant.profile.id] = { ...item, destination: "print-wait", label: "等待打印" };
      printerTaken = true;
    }
  }
  if (next.conversation?.participantIds?.length > 4) next.conversation = { ...next.conversation, participantIds: next.conversation.participantIds.slice(0, 4) };
  return next;
}
