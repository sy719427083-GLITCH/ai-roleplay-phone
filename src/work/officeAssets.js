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
      src: `${ASSET_BASE}/${id}.png`,
    };
  })
));

export function getOfficeChibi(id, kind) {
  const candidates = OFFICE_CHIBIS.filter((item) => !kind || item.kind === kind);
  return candidates.find((item) => item.id === id) || candidates[0] || OFFICE_CHIBIS[0];
}

const STATIC_ACTIVITY_FRAMES = {
  idle: 0,
  slacking: 5,
  eating: 6,
  gaming: 7,
  chatting: 8,
};

export function getActivityFrame(activity, phase = 0) {
  const loopPhase = Math.abs(Number.parseInt(phase, 10) || 0) % 2;
  const index = activity === "walking"
    ? 1 + loopPhase
    : activity === "working"
      ? 3 + loopPhase
      : STATIC_ACTIVITY_FRAMES[activity] ?? STATIC_ACTIVITY_FRAMES.idle;
  const row = Math.floor(index / 3);
  const column = index % 3;

  return {
    index,
    row,
    column,
    backgroundSize: "300% 300%",
    backgroundPosition: `${column * 50}% ${row * 50}%`,
    "--office-frame-index": index,
    "--office-frame-row": row,
    "--office-frame-column": column,
  };
}
