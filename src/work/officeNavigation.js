export const OFFICE_NODES = {
  "boss-home": { x: 50, y: 29, edges: ["aisle-top"] },
  "employee1-home": { x: 25, y: 45, edges: ["aisle-center"] },
  "employee2-home": { x: 75, y: 45, edges: ["aisle-center"] },
  "employee3-home": { x: 25, y: 61, edges: ["aisle-bottom"] },
  "employee4-home": { x: 75, y: 61, edges: ["aisle-bottom"] },
  "employee5-home": { x: 25, y: 77, edges: ["aisle-lower"] },
  "employee6-home": { x: 75, y: 77, edges: ["aisle-lower"] },
  "aisle-top": { x: 50, y: 36, edges: ["boss-home", "aisle-center", "door-left", "door-right-top", "tea-counter"] },
  "aisle-center": { x: 50, y: 52, edges: ["aisle-top", "aisle-bottom", "employee1-home", "employee2-home", "door-right-mid"] },
  "aisle-bottom": { x: 50, y: 68, edges: ["aisle-center", "aisle-lower", "employee3-home", "employee4-home"] },
  "aisle-lower": { x: 50, y: 82, edges: ["aisle-bottom", "employee5-home", "employee6-home"] },
  "door-left": { x: 7, y: 20, edges: ["aisle-top"] },
  "door-right-top": { x: 93, y: 20, edges: ["aisle-top"] },
  "door-right-mid": { x: 93, y: 44, edges: ["aisle-center"] },
  "tea-counter": { x: 76, y: 20, edges: ["aisle-top"] },
};

export const OBJECT_DESTINATIONS = {
  bossDesk: "boss-home",
  employee1Desk: "employee1-home",
  employee2Desk: "employee2-home",
  employee3Desk: "employee3-home",
  employee4Desk: "employee4-home",
  employee5Desk: "employee5-home",
  employee6Desk: "employee6-home",
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
