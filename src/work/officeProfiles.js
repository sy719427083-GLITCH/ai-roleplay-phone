export const OFFICE_ASSIGNMENT_KEY = "ccatOfficeAssignmentsV1";
export const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];

const defaultStorage = typeof window !== "undefined" ? window.localStorage : undefined;

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readObject = (storage, key) => {
  try {
    const parsed = JSON.parse(storage?.getItem?.(key) || "{}");
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const createOfficeProfileSnapshot = (profile = {}, source = "character") => ({
  id: String(profile.id || ""),
  source,
  ...(source === "character" ? { type: String(profile.type || "npc") } : {}),
  name: String(profile.name || "NPC"),
  identity: String(profile.identity || profile.role || "角色"),
  ...(source === "character" ? { worldview: String(profile.worldview || "") } : {}),
  appearance: String(profile.appearance || ""),
  personality: String(profile.personality || "自然"),
  persona: String(profile.persona || ""),
  avatar: String(profile.avatar || ""),
});

export const createNpcProfile = (slotId, kind) => ({
  id: `npc-${slotId}`,
  source: "fallback",
  name: "NPC",
  identity: kind === "boss" ? "临时老板" : "临时员工",
  appearance: "",
  personality: "自然、友好",
  persona: "办公室临时角色",
  avatar: "",
  generated: true,
});

export function readOfficeProfiles(storage = defaultStorage) {
  const meProfiles = readObject(storage, "apiMeProfiles");
  const characters = readObject(storage, "apiCharacters");

  return {
    bossOptions: Object.entries(meProfiles).map(([id, value]) => (
      createOfficeProfileSnapshot({ ...value, id }, "me")
    )),
    employeeOptions: Object.entries(characters).map(([id, value]) => (
      createOfficeProfileSnapshot({ ...value, id }, "character")
    )),
    relations: readObject(storage, "apiRelations"),
  };
}

const resolveProfile = (profileId, profileMap, slotId, kind) => {
  if (profileId && profileMap.has(profileId)) {
    return profileMap.get(profileId);
  }
  return createNpcProfile(slotId, kind);
};

export function normalizeOfficeAssignments(value = {}, profiles = {}) {
  const bossMap = new Map((profiles.bossOptions || []).map((item) => [item.id, item]));
  const employeeMap = new Map((profiles.employeeOptions || []).map((item) => [item.id, item]));

  return Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => {
    const kind = slotId === "boss" ? "boss" : "employee";
    const profileMap = kind === "boss" ? bossMap : employeeMap;
    const profile = resolveProfile(value?.[slotId], profileMap, slotId, kind);
    return [slotId, { profileId: profile.id, profile }];
  }));
}
