export const OFFICE_CHARACTER_IDS = Object.freeze([
  "employee-f-01", "employee-f-02", "employee-f-03", "employee-f-04",
  "employee-m-01", "employee-m-02", "employee-m-03", "employee-m-04",
  "boss-f-01", "boss-f-02", "boss-f-03", "boss-f-04",
  "boss-m-01", "boss-m-02", "boss-m-03", "boss-m-04",
]);

const FRONT = Object.freeze(["front"]);
const BACK = Object.freeze(["back"]);
const SIDE = Object.freeze(["left", "right"]);
const FOUR_DIRECTIONS = Object.freeze(["front", "left", "right", "back"]);

const action = ({ fps, loop = true, legalFacings = FRONT }) => Object.freeze({
  family: "action",
  bodyOnly: true,
  lazy: true,
  width: 1536,
  height: 384,
  cellSize: 384,
  columns: 4,
  rows: 1,
  frameCount: 4,
  fps,
  loop,
  legalFacings,
});

const LOCOMOTION = Object.freeze({
  family: "locomotion",
  bodyOnly: true,
  lazy: false,
  width: 3072,
  height: 1536,
  cellSize: 384,
  columns: 8,
  rows: 4,
  frameCount: 8,
  fps: 9,
  loop: true,
  legalFacings: FOUR_DIRECTIONS,
  rowByFacing: Object.freeze({ front: 0, left: 1, right: 2, back: 3 }),
});

const ACTION_CLIP_METADATA = Object.freeze({
  "idle-seated": action({ fps: 4 }),
  "idle-standing": action({ fps: 4 }),
  working: action({ fps: 8 }),
  slacking: action({ fps: 6 }),
  reading: action({ fps: 5 }),
  "watching-series": action({ fps: 5 }),
  "watching-short-video": action({ fps: 6 }),
  gaming: action({ fps: 8 }),
  "phone-call": action({ fps: 6, legalFacings: SIDE }),
  "video-meeting": action({ fps: 6 }),
  "online-training": action({ fps: 5 }),
  "sticky-planning": action({ fps: 6 }),
  "tidy-desk": action({ fps: 7 }),
  "desk-rest": action({ fps: 4 }),
  printing: action({ fps: 6, legalFacings: SIDE }),
  filing: action({ fps: 6, legalFacings: SIDE }),
  "whiteboard-writing": action({ fps: 6, legalFacings: BACK }),
  "whiteboard-discussing": action({ fps: 6, legalFacings: BACK }),
  reporting: action({ fps: 6, legalFacings: SIDE }),
  stretching: action({ fps: 6 }),
  "screen-collaboration-host": action({ fps: 6, legalFacings: SIDE }),
  "screen-collaboration-visitor": action({ fps: 6, legalFacings: SIDE }),
  "document-submit": action({ fps: 7, loop: false, legalFacings: SIDE }),
  "document-sign": action({ fps: 6, loop: false }),
  "computer-help-host": action({ fps: 6, legalFacings: SIDE }),
  "computer-help-visitor": action({ fps: 6, legalFacings: SIDE }),
  "parcel-receive": action({ fps: 7, loop: false, legalFacings: SIDE }),
  chatting: action({ fps: 6, legalFacings: SIDE }),
  listening: action({ fps: 5, legalFacings: SIDE }),
  "meal-pickup": action({ fps: 6, loop: false }),
  "tray-carry": action({ fps: 8 }),
  eating: action({ fps: 6 }),
  drinking: action({ fps: 6 }),
  "dining-chat": action({ fps: 6, legalFacings: SIDE }),
  "dining-listen": action({ fps: 5, legalFacings: SIDE }),
  "sofa-rest": action({ fps: 4 }),
  "watching-tv": action({ fps: 5, legalFacings: BACK }),
  "sofa-chat": action({ fps: 6, legalFacings: SIDE }),
  "sofa-listen": action({ fps: 5, legalFacings: SIDE }),
  "quiet-rest": action({ fps: 4 }),
  waiting: action({ fps: 4 }),
});

export const OFFICE_CLIP_METADATA = Object.freeze({
  locomotion: LOCOMOTION,
  ...ACTION_CLIP_METADATA,
});

export const OFFICE_CLIP_IDS = Object.freeze(Object.keys(OFFICE_CLIP_METADATA));

const CHARACTER_ID_SET = new Set(OFFICE_CHARACTER_IDS);
const CLIP_ID_SET = new Set(OFFICE_CLIP_IDS);

export function getCharacterClipSource(characterId, clipId) {
  if (!CHARACTER_ID_SET.has(characterId)) {
    throw new Error(`Unknown office character: ${characterId}`);
  }
  if (!CLIP_ID_SET.has(clipId)) {
    throw new Error(`Unknown office character clip: ${clipId}`);
  }

  return Object.freeze({
    characterId,
    clipId,
    src: `/ai-roleplay-phone/work-office-v2/characters/${characterId}/${clipId}.webp`,
    ...OFFICE_CLIP_METADATA[clipId],
  });
}
