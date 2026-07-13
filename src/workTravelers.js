const createTraveler = (id, gender, name, asset, hair, headwear, bag, outfit, accent) => ({
  id,
  gender,
  name,
  asset,
  hair,
  headwear,
  bag,
  outfit,
  accent,
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
      ),
    ]),
  },
]);

export const DEFAULT_WORK_TRAVELER_ID = "campus-female";

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
