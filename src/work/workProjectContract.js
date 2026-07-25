const DIFFICULTIES = new Set(["简单", "中等", "困难"]);

function cleanText(value, limit) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, limit);
}

function parseLegacyDuration(value) {
  if (typeof value !== "string") return NaN;
  const match = value.trim().match(/^(\d+)\s*(天|小时)$/);
  if (!match) return NaN;
  const quantity = Number(match[1]);
  return match[2] === "天" ? quantity * 24 : quantity;
}

function parseLegacyAmount(value) {
  if (typeof value !== "string") return NaN;
  const match = value.match(/-?\d[\d,]*(?:\.\d{1,2})?/);
  return match ? Number(match[0].replaceAll(",", "")) : NaN;
}

export function formatProjectDuration(hours) {
  return hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小时`;
}

export function formatProjectAmount(value) {
  return `¥${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function normalizeWorkProject(project, id = project?.id) {
  if (!project) return null;
  const projectId = typeof id === "string" ? id.trim() : "";
  const name = cleanText(project.name, 24);
  const description = cleanText(project.description, 100);
  const durationHours = Object.hasOwn(project, "durationHours")
    ? project.durationHours
    : parseLegacyDuration(project.duration);
  const rawAmount = Object.hasOwn(project, "amountValue")
    ? project.amountValue
    : parseLegacyAmount(project.amount);
  if (!projectId || !name || !description || !Number.isInteger(durationHours) || durationHours <= 0
    || !Number.isFinite(rawAmount) || rawAmount <= 0 || !DIFFICULTIES.has(project.difficulty)) return null;
  const amountValue = Math.round(rawAmount * 100) / 100;
  return {
    id: projectId,
    name,
    durationHours,
    amountValue,
    duration: formatProjectDuration(durationHours),
    amount: formatProjectAmount(amountValue),
    description,
    difficulty: project.difficulty,
  };
}
