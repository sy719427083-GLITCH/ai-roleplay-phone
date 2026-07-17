const BASE_URL = import.meta.env?.BASE_URL || "/ai-roleplay-phone/";
const ASSET_BASE = `${BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`}work-office-assets/chibi`;

const CHIBI_CATEGORIES = [
  { kind: "boss", gender: "female", prefix: "boss-f", label: "女老板" },
  { kind: "boss", gender: "male", prefix: "boss-m", label: "男老板" },
  { kind: "employee", gender: "female", prefix: "employee-f", label: "女员工" },
  { kind: "employee", gender: "male", prefix: "employee-m", label: "男员工" },
];

export const OFFICE_CHIBIS = CHIBI_CATEGORIES.flatMap(({ kind, gender, prefix, label }) => (
  Array.from({ length: 4 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const id = `${prefix}-${number}`;

    return {
      id,
      name: `${label} ${number}`,
      kind,
      gender,
      src: `${ASSET_BASE}/${id}.webp`,
      columns: 8,
      rows: 8,
    };
  })
));

export function getOfficeChibi(id, kind) {
  const candidates = OFFICE_CHIBIS.filter((item) => !kind || item.kind === kind);
  return candidates.find((item) => item.id === id) || candidates[0] || OFFICE_CHIBIS[0];
}

const WALKING_ROWS = {
  right: 0,
  left: 0,
  front: 1,
  back: 2,
};

const ACTIVITY_BLOCKS = {
  working: { row: 3, offset: 0 },
  slacking: { row: 3, offset: 4 },
  eating: { row: 4, offset: 0 },
  gaming: { row: 4, offset: 4 },
  reading: { row: 5, offset: 0 },
  watchingSeries: { row: 5, offset: 4 },
  watchingShortVideo: { row: 6, offset: 0 },
  chatting: { row: 6, offset: 4 },
  idle: { row: 7, offset: 0 },
  listening: { row: 7, offset: 4 },
};

export function getActivityFrame(activity, phase = 0, facing = "front") {
  const parsedPhase = Math.abs(Number.parseInt(phase, 10) || 0);
  const isWalking = activity === "walking";
  const block = ACTIVITY_BLOCKS[activity] || ACTIVITY_BLOCKS.idle;
  const row = isWalking ? (WALKING_ROWS[facing] ?? WALKING_ROWS.front) : block.row;
  const column = isWalking
    ? parsedPhase % 8
    : block.offset + (ACTIVITY_BLOCKS[activity] ? parsedPhase % 4 : 0);
  const index = (row * 8) + column;

  return {
    index,
    row,
    column,
    backgroundSize: "800% 800%",
    backgroundPosition: `${(column / 7) * 100}% ${(row / 7) * 100}%`,
    "--office-frame-index": index,
    "--office-frame-row": row,
    "--office-frame-column": column,
  };
}
