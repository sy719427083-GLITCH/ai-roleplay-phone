const GUEST_OFFSETS = Object.freeze([
  Object.freeze({ x: 9, y: 1 }),
  Object.freeze({ x: -9, y: 1 }),
  Object.freeze({ x: 0, y: 7 }),
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createConversationGatherLayout({ participantIds = [], currentNodes = {} } = {}) {
  const ids = [...new Set(participantIds)].slice(0, 4);
  if (ids.length < 2 || !currentNodes[ids[0]]) return { hostId: null, targets: {} };
  const hostId = ids[0];
  const host = currentNodes[hostId];
  const targets = { [hostId]: host };
  ids.slice(1).forEach((id, index) => {
    const offset = GUEST_OFFSETS[index];
    targets[id] = {
      x: clamp(host.x + offset.x, 8, 92),
      y: clamp(host.y + offset.y, 14, 88),
    };
  });
  return { hostId, targets };
}
