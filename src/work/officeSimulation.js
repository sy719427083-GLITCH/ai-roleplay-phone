export const OFFICE_ACTIVITIES = Object.freeze({
  working: { id: "working", label: "工作中", minutes: [12, 35] },
  reporting: { id: "reporting", label: "做报表", minutes: [10, 25] },
  printing: { id: "printing", label: "打印中", minutes: [3, 8] },
  chatting: { id: "chatting", label: "聊天中", minutes: [4, 10] },
  resting: { id: "resting", label: "休息中", minutes: [8, 25] },
  gaming: { id: "gaming", label: "打游戏", minutes: [8, 20] },
  scrolling: { id: "scrolling", label: "刷抖音", minutes: [6, 18] },
  slacking: { id: "slacking", label: "摸鱼ing", minutes: [5, 16] },
  offDuty: { id: "offDuty", label: "已下班", minutes: [30, 120] },
});

const PERIOD_WEIGHTS = {
  arrival: { working: 5, printing: 2, chatting: 2, slacking: 1 },
  "focus-am": { working: 8, reporting: 4, printing: 2, chatting: 1, scrolling: .5, slacking: .5 },
  lunch: { resting: 5, chatting: 4, scrolling: 3, gaming: 2, slacking: 2, offDuty: 1 },
  "focus-pm": { working: 8, reporting: 4, printing: 2, chatting: 1, scrolling: .5, slacking: .7 },
  evening: { offDuty: 5, working: 2, resting: 2, gaming: 2, scrolling: 2, slacking: 1 },
  overnight: { offDuty: 10, resting: 2, gaming: 1, scrolling: 1, working: .5 },
  "weekend-day": { offDuty: 4, resting: 4, chatting: 3, gaming: 3, scrolling: 3, slacking: 2, working: 1 },
};

function chinaParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return { ...parts, dateKey: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function getChinaOfficePeriod(date = new Date()) {
  const parts = chinaParts(date);
  const weekend = parts.weekday === "Sat" || parts.weekday === "Sun";
  if (weekend && parts.minutes >= 8 * 60 + 30 && parts.minutes < 20 * 60) return "weekend-day";
  if (parts.minutes < 8 * 60 + 30 || parts.minutes >= 20 * 60) return "overnight";
  if (parts.minutes < 9 * 60 + 30) return "arrival";
  if (parts.minutes < 12 * 60) return "focus-am";
  if (parts.minutes < 14 * 60) return "lunch";
  if (parts.minutes < 18 * 60) return "focus-pm";
  return "evening";
}

export const createOfficeDailySeed = (date = new Date(), companyId = "office") => `${companyId}:${chinaParts(date).dateKey}`;
export const getOfficeIntervalKey = (date = new Date()) => {
  const parts = chinaParts(date);
  return `${parts.dateKey}:${String(Math.floor(parts.minutes / 15)).padStart(2, "0")}`;
};

function hashString(value) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function randomFrom(seed) {
  let value = hashString(seed);
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedActivity(weights, affinities, random) {
  const entries = Object.entries(weights).map(([id, base]) => {
    let weight = base;
    if (["working", "reporting"].includes(id)) weight *= .5 + affinities.focus;
    if (id === "chatting") weight *= .5 + affinities.social;
    if (["gaming", "scrolling"].includes(id)) weight *= .5 + affinities.entertainment;
    if (id === "slacking") weight *= 1.5 - affinities.discipline;
    if (id === "offDuty") weight *= 1.35 - affinities.night * .5;
    return [id, weight];
  });
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = random() * total;
  return entries.find(([, weight]) => (cursor -= weight) <= 0)?.[0] || entries[0][0];
}

const sharedDestination = (activity, index) => ({
  printing: "print-station", chatting: `social-${["left", "center", "right"][index % 3]}`,
  resting: `rest-${index % 2 ? "right" : "left"}`, gaming: `play-${index % 2 ? "right" : "left"}`,
  scrolling: `rest-${index % 2 ? "right" : "left"}`, slacking: `social-${index % 2 ? "right" : "left"}`, offDuty: "off-duty",
}[activity]);

export function createLocalOfficePlan({ occupants = [], now = new Date(), seed = "office", projectContext = "", previousPlan = null } = {}) {
  const date = now instanceof Date ? now : new Date(now);
  const startsAt = date.getTime();
  const intervalKey = getOfficeIntervalKey(date);
  const period = getChinaOfficePeriod(date);
  const random = randomFrom(`${seed}:${intervalKey}:${projectContext}`);
  const characters = {};
  let printerTaken = false;
  occupants.forEach((occupant, index) => {
    const affinities = occupant.profile.officeContext?.affinities || { focus: .5, social: .5, discipline: .5, entertainment: .5, night: .5 };
    let activity = weightedActivity(PERIOD_WEIGHTS[period], affinities, random);
    if (activity === "printing" && printerTaken) activity = "working";
    if (activity === "printing") printerTaken = true;
    if (previousPlan?.characters?.[occupant.profile.id]?.activity === activity && random() < .35) activity = "working";
    const definition = OFFICE_ACTIVITIES[activity];
    const minutes = definition.minutes[0] + Math.floor(random() * (definition.minutes[1] - definition.minutes[0] + 1));
    characters[occupant.profile.id] = {
      activity, label: definition.label, destination: sharedDestination(activity, index) || `${occupant.slotId}-home`,
      startsAt, endsAt: startsAt + minutes * 60_000, priority: "scheduled",
    };
  });
  const chatters = occupants.filter((item) => characters[item.profile.id]?.activity === "chatting").slice(0, 4);
  const conversation = chatters.length >= 2 ? { id: `chat:${intervalKey}`, participantIds: chatters.map((item) => item.profile.id), turns: [], startsAt, endsAt: Math.min(...chatters.map((item) => characters[item.profile.id].endsAt)) } : null;
  return { id: `local:${intervalKey}`, modeUsed: "local", period, startsAt, endsAt: startsAt + 15 * 60_000, characters, conversation };
}
