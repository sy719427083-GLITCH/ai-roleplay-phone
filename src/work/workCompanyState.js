export const WORK_COMPANY_STORAGE_KEY = "ccatWorkCompanyV1";
export const WORK_COMPANY_STATE_VERSION = 1;
export const WORK_COMPANY_SUFFIX = "有限公司";
export const WORK_COMPANY_MAX_PREFIX_LENGTH = 5;

const toCharacters = (value) => Array.from(String(value ?? ""));

export const limitWorkCompanyPrefix = (value) =>
  toCharacters(value).slice(0, WORK_COMPANY_MAX_PREFIX_LENGTH).join("");

export const normalizeWorkCompanyPrefix = (value) =>
  limitWorkCompanyPrefix(String(value ?? "").trim());

export function createWorkCompany(prefix, createdAt = new Date().toISOString()) {
  const normalized = normalizeWorkCompanyPrefix(prefix);
  if (!normalized) throw new Error("请输入公司名称");
  return {
    version: WORK_COMPANY_STATE_VERSION,
    prefix: normalized,
    fullName: `${normalized}${WORK_COMPANY_SUFFIX}`,
    createdAt,
  };
}

export function restoreWorkCompany(raw) {
  let parsed;
  try { parsed = JSON.parse(raw || "null"); } catch { return null; }
  if (!parsed || parsed.version !== WORK_COMPANY_STATE_VERSION) return null;
  const prefix = String(parsed.prefix ?? "").trim();
  if (!prefix || toCharacters(prefix).length > WORK_COMPANY_MAX_PREFIX_LENGTH) return null;
  if (parsed.fullName !== `${prefix}${WORK_COMPANY_SUFFIX}`) return null;
  if (typeof parsed.createdAt !== "string" || !parsed.createdAt) return null;
  return {
    version: WORK_COMPANY_STATE_VERSION,
    prefix,
    fullName: parsed.fullName,
    createdAt: parsed.createdAt,
  };
}

export const serializeWorkCompany = (company) => JSON.stringify(company);
