export function tryWriteJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}
