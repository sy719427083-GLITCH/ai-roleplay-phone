export const WORK_APP_CACHE_KEYS = Object.freeze([
  "ccatWorkCompanyV1",
  "ccatWorkOfficeV1",
  "ccatWorkProjectsV1",
]);

export function clearWorkAppCache(storage) {
  const failedKeys = [];
  for (const key of WORK_APP_CACHE_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      failedKeys.push(key);
    }
  }
  return failedKeys;
}
