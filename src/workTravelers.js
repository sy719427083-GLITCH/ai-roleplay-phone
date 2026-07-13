const createTraveler = (
  id,
  gender,
  name,
  asset,
  hair,
  headwear,
  bag,
  outfit,
  accent,
  shoes,
  silhouette,
) => ({
  id,
  gender,
  name,
  asset,
  hair,
  headwear,
  bag,
  outfit,
  accent,
  shoes,
  silhouette,
});

export const WORK_TRAVELER_GROUPS = Object.freeze([
  {
    id: "campus",
    label: "校园清新",
    travelers: Object.freeze([
      createTraveler(
        "campus-female",
        "female",
        "晴栀",
        "work-map-assets/traveler-campus-female.png",
        "long-straight",
        "mint-ribbon",
        "canvas-tote",
        "pleated-uniform",
        "green-notebook",
        "canvas-sneakers",
        "fitted-top-pleated-skirt",
      ),
      createTraveler(
        "campus-male",
        "male",
        "屿川",
        "work-map-assets/traveler-campus-male.png",
        "soft-fringe",
        "navy-cap",
        "messenger-bag",
        "hoodie-layer",
        "campus-pass",
        "high-top-trainers",
        "relaxed-hoodie-straight-leg",
      ),
    ]),
  },
  {
    id: "trend",
    label: "甜酷潮流",
    travelers: Object.freeze([
      createTraveler(
        "trend-female",
        "female",
        "绯可",
        "work-map-assets/traveler-trend-female.png",
        "long-high-pony",
        "star-clips",
        "chain-crossbody",
        "cropped-jacket",
        "neon-earcuff",
        "platform-boots",
        "cropped-top-wide-leg",
      ),
      createTraveler(
        "trend-male",
        "male",
        "北野",
        "work-map-assets/traveler-trend-male.png",
        "textured-undercut",
        "black-beanie",
        "sling-pack",
        "oversized-streetwear",
        "silver-choker",
        "chunky-sneakers",
        "boxy-layered-cargo",
      ),
    ]),
  },
  {
    id: "literary",
    label: "温柔文艺",
    travelers: Object.freeze([
      createTraveler(
        "literary-female",
        "female",
        "书遥",
        "work-map-assets/traveler-literary-female.png",
        "long-low-braid",
        "linen-beret",
        "book-tote",
        "cardigan-skirt",
        "poetry-book",
        "mary-jane-flats",
        "soft-cardigan-a-line",
      ),
      createTraveler(
        "literary-male",
        "male",
        "言舟",
        "work-map-assets/traveler-literary-male.png",
        "side-part",
        "newsboy-cap",
        "leather-satchel",
        "knit-shirt",
        "fountain-pen",
        "leather-loafers",
        "slim-knit-tapered-trouser",
      ),
    ]),
  },
  {
    id: "luxe",
    label: "轻奢日常",
    travelers: Object.freeze([
      createTraveler(
        "luxe-female",
        "female",
        "明珠",
        "work-map-assets/traveler-luxe-female.png",
        "long-glossy-wave",
        "pearl-headband",
        "quilted-handbag",
        "silk-dress",
        "gold-watch",
        "pointed-heels",
        "cinched-waist-column",
      ),
      createTraveler(
        "luxe-male",
        "male",
        "景珩",
        "work-map-assets/traveler-luxe-male.png",
        "slick-back",
        "amber-sunglasses",
        "leather-briefcase",
        "tailored-coat",
        "signet-ring",
        "oxford-shoes",
        "structured-coat-tailored-trouser",
      ),
    ]),
  },
]);

export const DEFAULT_WORK_TRAVELER_ID = "campus-female";
export const WORK_TRAVELER_STORAGE_KEY = "ccat-work-traveler";

const WORK_TRAVELERS_BY_ID = Object.freeze(
  WORK_TRAVELER_GROUPS.flatMap((group) => group.travelers).reduce((lookup, traveler) => ({
    ...lookup,
    [traveler.id]: traveler,
  }), {}),
);

export const normalizeWorkTravelerId = (travelerId) => {
  const normalized = String(travelerId || "").trim();
  return WORK_TRAVELERS_BY_ID[normalized] ? normalized : DEFAULT_WORK_TRAVELER_ID;
};

export const getWorkTraveler = (travelerId) => WORK_TRAVELERS_BY_ID[normalizeWorkTravelerId(travelerId)];

export const getWorkTravelerFallbackAsset = (travelerId) => {
  const traveler = getWorkTraveler(travelerId);
  const fallbackGroupId = traveler.id.startsWith("campus-") ? "trend" : "campus";
  return WORK_TRAVELERS_BY_ID[`${fallbackGroupId}-${traveler.gender}`].asset;
};

const getStorage = (storage) => storage || globalThis.localStorage;

export const readStoredWorkTravelerId = (storage) => {
  try {
    return normalizeWorkTravelerId(getStorage(storage).getItem(WORK_TRAVELER_STORAGE_KEY));
  } catch {
    return DEFAULT_WORK_TRAVELER_ID;
  }
};

export const persistWorkTravelerId = (travelerId, storage) => {
  const normalized = normalizeWorkTravelerId(travelerId);

  try {
    getStorage(storage).setItem(WORK_TRAVELER_STORAGE_KEY, normalized);
  } catch {
    // Keep in-memory state usable if storage is unavailable.
  }

  return normalized;
};

const formatSegment = (value) => String(value).padStart(2, "0");

export const formatWorkDuration = (milliseconds) => {
  const numericMilliseconds = Number(milliseconds);
  const safeMilliseconds = Number.isFinite(numericMilliseconds) ? numericMilliseconds : 0;
  const totalSeconds = Math.max(0, Math.ceil(safeMilliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map(formatSegment).join(":");
  }

  return [minutes, seconds].map(formatSegment).join(":");
};
