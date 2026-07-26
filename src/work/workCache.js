import { OFFICE_STORAGE_KEY } from "./officeState.js";
import { WORK_COMPANY_STORAGE_KEY } from "./workCompanyState.js";
import { WORK_PROJECTS_STORAGE_KEY } from "./workProjectState.js";

export const WORK_CACHE_STORAGE_KEYS = [
  WORK_COMPANY_STORAGE_KEY,
  OFFICE_STORAGE_KEY,
  WORK_PROJECTS_STORAGE_KEY,
];

export function clearWorkCache(storage = window.localStorage) {
  WORK_CACHE_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
}
