export const OFFICE_ASSIGNMENT_KEY = "ccatOfficeAssignmentsV1";
export const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];

const readObject = (storage, key) => {
  try {
    return JSON.parse(storage?.getItem?.(key) || "{}");
  } catch {
    return {};
  }
};

const normalizeProfile = (id, value = {}) => ({
  ...value,
  id,
  name: String(value.name || "NPC"),
  identity: String(value.identity || value.role || "角色"),
  personality: String(value.personality || "自然"),
  persona: String(value.persona || ""),
});

export const createNpcProfile = (slotId, kind) => ({
  id: `npc-${slotId}`,
  name: "NPC",
  identity: kind === "boss" ? "临时老板" : "临时员工",
  personality: "自然、友好",
  persona: "办公室临时角色",
  generated: true,
});

export function readOfficeProfiles(storage = window.localStorage) {
  const characters = readObject(storage, "apiCharacters");
  const allProfiles = Object.entries(characters).map(([id, value]) => normalizeProfile(id, value));

  return {
    bossOptions: allProfiles.filter((item) => item.type === "main" || item.type === "主角"),
    employeeOptions: allProfiles.filter((item) => item.type !== "main" && item.type !== "主角"),
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
