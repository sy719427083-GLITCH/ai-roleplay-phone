export const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4", "employee5", "employee6"];

const readObject = (storage, key) => {
  try {
    const value = JSON.parse(storage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

export function readOfficeProfiles(storage = window.localStorage) {
  const relations = readOfficeRelations(storage);
  const me = Object.entries(readObject(storage, "apiMeProfiles")).map(([id, profile]) => ({
    ...profile,
    id: `me:${id}`,
    sourceId: id,
    source: "me",
  }));
  const characters = Object.entries(readObject(storage, "apiCharacters")).map(([id, profile]) => ({
    ...profile,
    id: `character:${id}`,
    sourceId: id,
    source: profile.type === "npc" || profile.type === "NPC" ? "npc" : "character",
  }));
  return [...me, ...characters]
    .filter((profile) => profile.name || profile.avatar)
    .map((profile) => ({ ...profile, officeContext: buildOfficeProfileContext(profile, relations) }));
}

export function normalizeAssignments(value = {}, profiles = []) {
  const validIds = new Set(profiles.map((profile) => profile.id));
  const used = new Set();
  return Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => {
    const candidate = value?.[slotId];
    const profileId = validIds.has(candidate) && !used.has(candidate) ? candidate : null;
    if (profileId) used.add(profileId);
    return [slotId, profileId];
  }));
}

export function getAvailableProfiles(profiles, assignments, slotId) {
  const occupied = new Set(Object.entries(assignments)
    .filter(([id]) => id !== slotId)
    .map(([, value]) => value)
    .filter(Boolean));
  return profiles.filter((profile) => !occupied.has(profile.id));
}
import { buildOfficeProfileContext, readOfficeRelations } from "./officeProfileContext.js";
