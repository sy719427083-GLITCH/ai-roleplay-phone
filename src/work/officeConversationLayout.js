const CENTER_GUEST_OFFSETS = Object.freeze([
  Object.freeze({ x: 15, y: 1 }),
  Object.freeze({ x: -15, y: 1 }),
  Object.freeze({ x: 0, y: 10 }),
]);

const edgeGuestOffsets = (direction) => Object.freeze([
  Object.freeze({ x: 15 * direction, y: 1 }),
  Object.freeze({ x: 30 * direction, y: 1 }),
  Object.freeze({ x: 15 * direction, y: 10 }),
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createConversationGatherLayout({ participantIds = [], currentNodes = {} } = {}) {
  const ids = [...new Set(participantIds)].slice(0, 4);
  if (ids.length < 2 || !currentNodes[ids[0]]) return { hostId: null, targets: {} };
  const hostId = ids[0];
  const host = currentNodes[hostId];
  const targets = { [hostId]: host };
  const offsets = host.x < 23 ? edgeGuestOffsets(1) : host.x > 77 ? edgeGuestOffsets(-1) : CENTER_GUEST_OFFSETS;
  ids.slice(1).forEach((id, index) => {
    const offset = offsets[index];
    targets[id] = {
      x: clamp(host.x + offset.x, 8, 92),
      y: clamp(host.y + offset.y, 14, 88),
    };
  });
  return { hostId, targets };
}
