const createNode = (id, x, y, neighbors) => Object.freeze({
  id,
  x,
  y,
  neighbors: Object.freeze([...neighbors]),
});

export const OFFICE_NODES = Object.freeze({
  "boss-home": createNode("boss-home", 50, 22, ["boss-exit"]),
  "boss-exit": createNode("boss-exit", 50, 32, ["boss-home", "aisle-upper"]),
  "employee1-home": createNode("employee1-home", 25, 47, ["employee1-exit"]),
  "employee1-exit": createNode("employee1-exit", 36, 47, ["employee1-home", "aisle-upper"]),
  "employee2-home": createNode("employee2-home", 75, 47, ["employee2-exit"]),
  "employee2-exit": createNode("employee2-exit", 64, 47, ["employee2-home", "aisle-upper"]),
  "employee3-home": createNode("employee3-home", 25, 66, ["employee3-exit"]),
  "employee3-exit": createNode("employee3-exit", 36, 66, ["employee3-home", "aisle-lower"]),
  "employee4-home": createNode("employee4-home", 75, 66, ["employee4-exit"]),
  "employee4-exit": createNode("employee4-exit", 64, 66, ["employee4-home", "aisle-lower"]),
  "aisle-upper": createNode("aisle-upper", 50, 43, [
    "employee1-exit",
    "employee2-exit",
    "boss-exit",
    "aisle-lower",
    "chat-1",
    "chat-2",
  ]),
  "aisle-lower": createNode("aisle-lower", 50, 68, [
    "aisle-upper",
    "employee3-exit",
    "employee4-exit",
    "break-1",
    "break-2",
    "chat-3",
    "chat-4",
    "meeting-1",
  ]),
  "break-1": createNode("break-1", 22, 86, ["aisle-lower"]),
  "break-2": createNode("break-2", 34, 86, ["aisle-lower"]),
  "chat-1": createNode("chat-1", 42, 54, ["aisle-upper"]),
  "chat-2": createNode("chat-2", 58, 54, ["aisle-upper"]),
  "chat-3": createNode("chat-3", 42, 76, ["aisle-lower"]),
  "chat-4": createNode("chat-4", 58, 76, ["aisle-lower"]),
  "meeting-1": createNode("meeting-1", 50, 57, ["aisle-lower"]),
  "storage-closet": createNode("storage-closet", 92, 74, []),
});

const cloneReservation = (reservation) => (reservation && typeof reservation === "object"
  ? { ...reservation }
  : reservation);

const cloneReservations = (reservations = {}) => Object.fromEntries(
  Object.entries(reservations || {}).map(([anchorId, reservation]) => [anchorId, cloneReservation(reservation)]),
);

const getNode = (nodeId) => OFFICE_NODES[nodeId] || null;
const hasReservationForSlot = (reservations, slotId) => Object.values(reservations || {}).some((reservation) => reservation?.slotId === slotId);

export function findOfficeRoute(fromId, toId) {
  if (!getNode(fromId) || !getNode(toId)) return [];
  if (fromId === toId) return [fromId];

  const queue = [fromId];
  const visited = new Set([fromId]);
  const previous = new Map();

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentNode = getNode(currentId);
    if (!currentNode) continue;

    for (const neighborId of currentNode.neighbors) {
      if (visited.has(neighborId) || !getNode(neighborId)) continue;
      visited.add(neighborId);
      previous.set(neighborId, currentId);
      if (neighborId === toId) {
        const route = [toId];
        let cursor = currentId;
        while (cursor) {
          route.unshift(cursor);
          cursor = previous.get(cursor);
        }
        return route;
      }
      queue.push(neighborId);
    }
  }

  return [];
}

export function getFacing(fromId, toId) {
  const fromNode = getNode(fromId);
  const toNode = getNode(toId);
  if (!fromNode || !toNode) return null;

  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

export function claimAnchor(reservations, anchorId, ownerId) {
  if (hasReservationForSlot(reservations, ownerId)) return null;

  const current = reservations?.[anchorId];
  if (current && current.slotId !== ownerId) return null;

  const next = cloneReservations(reservations);
  next[anchorId] = {
    anchorId,
    slotId: ownerId,
  };
  return next;
}

export function releaseAnchor(reservations, anchorId, ownerId) {
  const current = reservations?.[anchorId];
  const next = cloneReservations(reservations);

  if (!current) return next;
  if (current.slotId !== ownerId) return next;

  delete next[anchorId];
  return next;
}
