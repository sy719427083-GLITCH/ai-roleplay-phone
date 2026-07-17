const BASE_URL = import.meta.env?.BASE_URL || "/ai-roleplay-phone/";
const asset = (folder, name) => `${BASE_URL}work-office-assets/${folder}/${name}.webp`;

export const SEATED_HOME_ACTIVITIES = new Set([
  "idle", "working", "slacking", "gaming", "reading",
  "watchingSeries", "watchingShortVideo",
]);

export const OFFICE_STATION_ASSETS = Object.fromEntries(
  ["boss", "employee1", "employee2", "employee3", "employee4"].map((slotId) => [slotId, {
    empty: { id: `${slotId}-empty`, src: asset("stations", `${slotId}-empty`) },
    "active-shell": { id: `${slotId}-active-shell`, src: asset("stations", `${slotId}-active-shell`) },
  }]),
);

export const OFFICE_BREAK_ASSETS = Object.fromEntries(
  ["both-empty", "left-occupied", "right-occupied", "both-occupied"].map((state) => [state, {
    id: `break-${state}`,
    src: asset("break", state),
  }]),
);

const isAtHome = (slotId, character) => (
  character?.positionNode === (character?.homeNode || `${slotId}-home`)
);

export function resolveStationVisualState(slotId, character = {}, loadedModuleIds = new Set()) {
  const wantsShell = isAtHome(slotId, character)
    && !["walkingToActivity", "returning", "chatting"].includes(character.phase)
    && SEATED_HOME_ACTIVITIES.has(character.activity || "idle");
  const shellId = `${slotId}-active-shell`;
  if (!wantsShell) return { state: "empty", furnitureReady: true };
  return loadedModuleIds.has(shellId)
    ? { state: "active-shell", furnitureReady: true }
    : { state: "empty", furnitureReady: false };
}

export function resolveBreakVisualState(reservations = {}, characters = {}, loadedModuleIds = new Set()) {
  const owns = (anchorId) => {
    const owner = reservations?.[anchorId]?.slotId;
    const actor = owner && characters?.[owner];
    return Boolean(owner && actor?.activity === "eating" && actor?.positionNode === anchorId);
  };
  const left = owns("break-1");
  const right = owns("break-2");
  const state = left && right ? "both-occupied" : left ? "left-occupied" : right ? "right-occupied" : "both-empty";
  const loaded = loadedModuleIds.has(`break-${state}`);
  return {
    state: loaded ? state : "both-empty",
    furnitureReadyBySlot: Object.fromEntries([
      reservations?.["break-1"]?.slotId && [reservations["break-1"].slotId, !left || loaded],
      reservations?.["break-2"]?.slotId && [reservations["break-2"].slotId, !right || loaded],
    ].filter(Boolean)),
  };
}

export function resolveOfficeModuleState({ characters = {}, reservations = {}, loadedModuleIds = new Set() } = {}) {
  const stations = {};
  const characterStates = {};
  for (const slotId of Object.keys(OFFICE_STATION_ASSETS)) {
    stations[slotId] = resolveStationVisualState(slotId, characters[slotId], loadedModuleIds);
    characterStates[slotId] = { furnitureReady: stations[slotId].furnitureReady };
  }
  const breakArea = resolveBreakVisualState(reservations, characters, loadedModuleIds);
  for (const [slotId, ready] of Object.entries(breakArea.furnitureReadyBySlot)) {
    characterStates[slotId] = { furnitureReady: ready };
  }
  return { stations, breakArea, characters: characterStates };
}
