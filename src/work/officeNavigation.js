export const OFFICE_NODES = {
  "boss-home": { x: 50, y: 18, edges: ["aisle-top"] },
  "employee1-home": { x: 29, y: 43, edges: ["aisle-center"] },
  "employee2-home": { x: 67, y: 43, edges: ["aisle-center"] },
  "employee3-home": { x: 29, y: 66, edges: ["aisle-bottom"] },
  "employee4-home": { x: 67, y: 66, edges: ["aisle-bottom"] },
  "aisle-top": { x: 50, y: 29, edges: ["boss-home", "aisle-center", "door-left", "door-right-top"] },
  "aisle-center": { x: 50, y: 51, edges: ["aisle-top", "aisle-bottom", "employee1-home", "employee2-home", "door-right-mid"] },
  "aisle-bottom": { x: 50, y: 76, edges: ["aisle-center", "employee3-home", "employee4-home", "tea-counter"] },
  "door-left": { x: 8, y: 23, edges: ["aisle-top"] },
  "door-right-top": { x: 92, y: 20, edges: ["aisle-top"] },
  "door-right-mid": { x: 92, y: 40, edges: ["aisle-center"] },
  "tea-counter": { x: 76, y: 74, edges: ["aisle-bottom"] },
};

export const OBJECT_DESTINATIONS = {
  bossDesk: "boss-home",
  employee1Desk: "employee1-home",
  employee2Desk: "employee2-home",
  employee3Desk: "employee3-home",
  employee4Desk: "employee4-home",
  leftDoor: "door-left",
  rightTopDoor: "door-right-top",
  rightMidDoor: "door-right-mid",
  tea: "tea-counter",
};

export function findOfficeRoute(fromId, toId) {
  if (!OFFICE_NODES[fromId] || !OFFICE_NODES[toId]) return [];
  const queue = [[fromId]];
  const seen = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    if (current === toId) return path;
    for (const next of OFFICE_NODES[current].edges) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

export function getRouteFacing(fromId, toId) {
  if (!OFFICE_NODES[fromId] || !OFFICE_NODES[toId]) return "right";
  return OFFICE_NODES[toId].x < OFFICE_NODES[fromId].x ? "left" : "right";
}
