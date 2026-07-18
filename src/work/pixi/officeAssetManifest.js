export const OFFICE_ASSET_MANIFEST = Object.freeze({
  scenes: Object.freeze({
    office: "/ai-roleplay-phone/work-office-v2/scenes/office.webp",
    lounge: "/ai-roleplay-phone/work-office-v2/scenes/lounge.webp",
  }),
  objects: Object.freeze({
    "boss-desk": "/ai-roleplay-phone/work-office-v2/objects/boss-desk.webp",
    "employee-desk": "/ai-roleplay-phone/work-office-v2/objects/employee-desk.webp",
    pantry: "/ai-roleplay-phone/work-office-v2/objects/pantry.webp",
  }),
  characterActionStrips: Object.freeze({
    idle: "/ai-roleplay-phone/work-office-v2/characters/idle.webp",
    walk: "/ai-roleplay-phone/work-office-v2/characters/walk.webp",
    work: "/ai-roleplay-phone/work-office-v2/characters/work.webp",
  }),
});

export const getCharacterActionStripAliases = () => Object.keys(
  OFFICE_ASSET_MANIFEST.characterActionStrips,
);
