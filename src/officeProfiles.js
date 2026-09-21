export const OFFICE_AVATARS_KEY = 'ccat-office-avatars-v1';
export const OFFICE_SEATS = ['boss', ...Array.from({ length: 6 }, (_, i) => `employee-${i + 1}`)];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const parse = (storage, key) => { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } };
export function validateAvatarUrl(value) {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value.trim()); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
const imageValue = value => typeof value === 'string' && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || validateAvatarUrl(value)) ? value : '';
export function readOfficeSources(storage) {
  return [['apiMeProfiles','me','我'],['apiCharacters','character','未命名角色']].flatMap(([key,kind,fallback]) => {
    const raw = parse(storage,key);
    return record(raw) ? Object.entries(raw).filter(([,p]) => record(p)).map(([id,p]) => ({ key:`${kind}:${id}`,kind,name:typeof p.name === 'string' && p.name.trim() ? p.name : fallback,avatar:imageValue(p.avatar) })) : [];
  });
}
export function readOfficeAvatars(storage) {
  const raw = parse(storage,OFFICE_AVATARS_KEY);
  if (raw?.version !== 1 || !record(raw.seats)) return {};
  return Object.fromEntries(OFFICE_SEATS.filter(id => record(raw.seats[id])).map(id => [id, { sourceKey:typeof raw.seats[id].sourceKey === 'string' ? raw.seats[id].sourceKey : '',avatar:imageValue(raw.seats[id].avatar) }]));
}
export function resolveSeat(id, seats, sources) {
  const saved = seats[id];
  const source = saved ? sources.find(p => p.key === saved.sourceKey) : null;
  return { name:source?.name || '',sourceKey:source?.key || '',avatar:imageValue(saved?.avatar) || source?.avatar || '' };
}
export function saveOfficeAvatar(storage, seats, id, entry) {
  if (!OFFICE_SEATS.includes(id)) return {ok:false};
  const next = {...seats};
  if (entry === null) delete next[id];
  else next[id] = {sourceKey: typeof entry.sourceKey === 'string' ? entry.sourceKey : '', avatar:imageValue(entry.avatar)};
  try { storage.setItem(OFFICE_AVATARS_KEY,JSON.stringify({version:1,seats:next})); return {ok:true,seats:next}; }
  catch { return {ok:false,error:'保存失败，浏览器存储空间可能已满。请换用图片 URL 或较小的图片。'}; }
}
export async function prepareOfficeAvatar({ sourceKey, avatar, url = '' }, loadImage) {
  if (!url.trim()) return { sourceKey, avatar };
  const next = validateAvatarUrl(url);
  if (!next) throw new Error('请输入有效的 HTTP 或 HTTPS 图片链接。');
  await loadImage(next);
  return {sourceKey,avatar:next};
}
