const AVATAR_CLEARANCE_PX = 28;

export const BREAKROOM_ENTRY_POINT = Object.freeze({ x: 12, y: 83 });

export const BREAKROOM_INTERACTION_POINTS = Object.freeze({
  "drink-counter": Object.freeze({ x: 48, y: 31 }),
  "coffee-machine": Object.freeze({ x: 58, y: 31 }),
  fridge: Object.freeze({ x: 43, y: 40 }),
  microwave: Object.freeze({ x: 57, y: 40 }),
  "snack-cabinet": Object.freeze({ x: 57, y: 77 }),
  "dining-table": Object.freeze({ x: 50, y: 53 }),
});

export const BREAKROOM_LAYOUT = Object.freeze({
  drinkCounter: Object.freeze({ left: 0, top: 7, width: 55, height: 18 }),
  coffeeMachine: Object.freeze({ left: 70, top: 9, width: 26, height: 15 }),
  fridge: Object.freeze({ left: 1, top: 26, width: 29, height: 20 }),
  microwave: Object.freeze({ left: 70, top: 28, width: 29, height: 17 }),
  diningTable: Object.freeze({ left: 15, top: 57, width: 70, height: 16 }),
  snackCabinet: Object.freeze({ left: 71, top: 69, width: 28, height: 17 }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function obstacle(id, layout, viewport) {
  const horizontal = (AVATAR_CLEARANCE_PX / viewport.width) * 100;
  const vertical = (AVATAR_CLEARANCE_PX / viewport.height) * 100;
  return {
    id,
    left: clamp(layout.left - horizontal, 0, 100),
    top: clamp(layout.top - vertical, 0, 100),
    right: clamp(layout.left + layout.width + horizontal, 0, 100),
    bottom: clamp(layout.top + layout.height + vertical, 0, 100),
    visible: {
      id,
      left: layout.left,
      top: layout.top,
      right: layout.left + layout.width,
      bottom: layout.top + layout.height,
    },
  };
}

export function getBreakroomPoint(id) {
  if (id === "entry") return BREAKROOM_ENTRY_POINT;
  return BREAKROOM_INTERACTION_POINTS[id] ?? null;
}

export function getBreakroomGeometry(viewport) {
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
    throw new TypeError("A positive breakroom viewport is required");
  }
  return {
    obstacles: Object.entries(BREAKROOM_LAYOUT).map(([id, layout]) => obstacle(id, layout, viewport)),
    entryPoint: BREAKROOM_ENTRY_POINT,
    interactionPoints: BREAKROOM_INTERACTION_POINTS,
  };
}
