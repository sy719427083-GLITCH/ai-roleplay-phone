const createNode = (id, x, y, neighbors) => Object.freeze({
  id,
  x,
  y,
  neighbors: Object.freeze([...neighbors]),
});

export const OFFICE_NODES = Object.freeze({
  "boss-home": createNode("boss-home", 48, 18, ["boss-exit"]),
  "boss-exit": createNode("boss-exit", 60, 18, ["boss-home", "aisle-upper"]),
  "employee1-home": createNode("employee1-home", 12, 18, ["employee1-exit"]),
  "employee1-exit": createNode("employee1-exit", 22, 18, ["employee1-home", "aisle-upper"]),
  "employee2-home": createNode("employee2-home", 28, 18, ["employee2-exit"]),
  "employee2-exit": createNode("employee2-exit", 58, 18, ["employee2-home", "aisle-upper"]),
  "employee3-home": createNode("employee3-home", 72, 18, ["employee3-exit"]),
  "employee3-exit": createNode("employee3-exit", 70, 18, ["employee3-home", "aisle-upper"]),
  "employee4-home": createNode("employee4-home", 86, 18, ["employee4-exit"]),
  "employee4-exit": createNode("employee4-exit", 82, 18, ["employee4-home", "aisle-upper"]),
  "aisle-upper": createNode("aisle-upper", 38, 18, [
    "employee1-exit",
    "employee2-exit",
    "employee3-exit",
    "employee4-exit",
    "boss-exit",
    "aisle-lower",
  ]),
  "aisle-lower": createNode("aisle-lower", 38, 34, [
    "aisle-upper",
    "break-1",
    "break-2",
    "chat-1",
    "chat-2",
    "chat-3",
    "chat-4",
    "meeting-1",
  ]),
  "break-1": createNode("break-1", 30, 46, ["aisle-lower"]),
  "break-2": createNode("break-2", 46, 46, ["aisle-lower"]),
  "chat-1": createNode("chat-1", 16, 34, ["aisle-lower"]),
  "chat-2": createNode("chat-2", 26, 34, ["aisle-lower"]),
  "chat-3": createNode("chat-3", 50, 34, ["aisle-lower"]),
  "chat-4": createNode("chat-4", 60, 34, ["aisle-lower"]),
  "meeting-1": createNode("meeting-1", 62, 34, ["aisle-lower"]),
  "storage-closet": createNode("storage-closet", 92, 74, []),
});

const cloneReservation = (reservation) => (reservation && typeof reservation === "object"
  ? { ...reservation }
  : reservation);

const cloneReservations = (reservations = {}) => Object.fromEntries(
  Object.entries(reservations || {}).map(([anchorId, reservation]) => [anchorId, cloneReservation(reservation)]),
);

const getNode = (nodeId) => OFFICE_NODES[nodeId] || null;

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
  if (!fromNode || !toNode) return "right";

  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

export function claimAnchor(reservations, anchorId, ownerId) {
  const current = reservations?.[anchorId];
  if (current && current.ownerId !== ownerId) return null;

  const next = cloneReservations(reservations);
  next[anchorId] = {
    anchorId,
    ownerId,
  };
  return next;
}

export function releaseAnchor(reservations, anchorId, ownerId) {
  const current = reservations?.[anchorId];
  const next = cloneReservations(reservations);

  if (!current) return next;
  if (current.ownerId !== ownerId) return next;

  delete next[anchorId];
  return next;
}
