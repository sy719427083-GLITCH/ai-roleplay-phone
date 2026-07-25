const AVATAR_CLEARANCE_PX = 28;

export const OFFICE_HOME_POINTS = Object.freeze({
  "boss-home": Object.freeze({ x: 50, y: 24 }),
  "employee1-home": Object.freeze({ x: 22, y: 40 }),
  "employee2-home": Object.freeze({ x: 78, y: 40 }),
  "employee3-home": Object.freeze({ x: 22, y: 56 }),
  "employee4-home": Object.freeze({ x: 78, y: 56 }),
  "employee5-home": Object.freeze({ x: 22, y: 72 }),
  "employee6-home": Object.freeze({ x: 78, y: 72 }),
});

export const OFFICE_INTERACTION_POINTS = Object.freeze({
  "tea-counter": Object.freeze({ x: 92, y: 26 }),
});

export const OFFICE_LAYOUT = Object.freeze({
  boss: Object.freeze({
    top: 23,
    left: 50,
    width: Object.freeze({ min: 222, vw: 62, max: 258 }),
    height: Object.freeze({ min: 138, vh: 19, max: 164 }),
    alpha: Object.freeze([41 / 720, 67 / 480, 676 / 720, 405 / 480]),
  }),
  employee: Object.freeze({
    width: Object.freeze({ min: 164, vw: 48, max: 198 }),
    height: Object.freeze({ min: 108, vh: 15, max: 132 }),
    alpha: Object.freeze([55 / 520, 41 / 360, 449 / 520, 303 / 360]),
  }),
  tea: Object.freeze({
    top: 6,
    right: 0,
    width: 58,
    height: 16,
    alpha: Object.freeze([79 / 900, 9 / 520, 820 / 900, 505 / 520]),
  }),
});

const EMPLOYEE_LAYOUTS = Object.freeze([
  { id: "employee1Desk", top: 39, left: -2 },
  { id: "employee2Desk", top: 39, right: -2 },
  { id: "employee3Desk", top: 54, left: -2 },
  { id: "employee4Desk", top: 54, right: -2 },
  { id: "employee5Desk", top: 69, left: -2 },
  { id: "employee6Desk", top: 69, right: -2 },
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampSize(spec, viewportSize, viewportUnit) {
  return clamp((viewportSize * spec[viewportUnit]) / 100, spec.min, spec.max);
}

function visibleRectangle(id, container, alpha) {
  return {
    id,
    left: container.left + container.width * alpha[0],
    top: container.top + container.height * alpha[1],
    right: container.left + container.width * alpha[2],
    bottom: container.top + container.height * alpha[3],
  };
}

function inflateRectangle(visible, viewport, { includeTop = false, includeBottom = false } = {}) {
  const horizontal = (AVATAR_CLEARANCE_PX / viewport.width) * 100;
  const vertical = (AVATAR_CLEARANCE_PX / viewport.height) * 100;
  return {
    id: visible.id,
    left: clamp(visible.left - horizontal, 0, 100),
    top: clamp(visible.top - (includeTop ? vertical : 0), 0, 100),
    right: clamp(visible.right + horizontal, 0, 100),
    bottom: clamp(visible.bottom + (includeBottom ? vertical : 0), 0, 100),
    visible,
  };
}

function getResponsiveFurnitureSize(layout, viewport) {
  return {
    width: (clampSize(layout.width, viewport.width, "vw") / viewport.width) * 100,
    height: (clampSize(layout.height, viewport.height, "vh") / viewport.height) * 100,
  };
}

function getBossObstacle(viewport) {
  const size = getResponsiveFurnitureSize(OFFICE_LAYOUT.boss, viewport);
  const container = {
    left: OFFICE_LAYOUT.boss.left - size.width / 2,
    top: OFFICE_LAYOUT.boss.top,
    ...size,
  };
  return inflateRectangle(visibleRectangle("bossDesk", container, OFFICE_LAYOUT.boss.alpha), viewport);
}

function getEmployeeObstacle(layout, viewport) {
  const size = getResponsiveFurnitureSize(OFFICE_LAYOUT.employee, viewport);
  const container = {
    left: layout.left ?? 100 - layout.right - size.width,
    top: layout.top,
    ...size,
  };
  return inflateRectangle(visibleRectangle(layout.id, container, OFFICE_LAYOUT.employee.alpha), viewport);
}

function getTeaObstacle(viewport) {
  const layout = OFFICE_LAYOUT.tea;
  const container = {
    left: 100 - layout.right - layout.width,
    top: layout.top,
    width: layout.width,
    height: layout.height,
  };
  return inflateRectangle(visibleRectangle("tea", container, layout.alpha), viewport, { includeTop: true, includeBottom: false });
}

export function getOfficePoint(id) {
  return OFFICE_HOME_POINTS[id] ?? OFFICE_INTERACTION_POINTS[id] ?? null;
}

export function getOfficeGeometry(viewport) {
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
    throw new TypeError("A positive office viewport is required");
  }
  return {
    obstacles: [
      getBossObstacle(viewport),
      ...EMPLOYEE_LAYOUTS.map((layout) => getEmployeeObstacle(layout, viewport)),
      getTeaObstacle(viewport),
    ],
    homePoints: OFFICE_HOME_POINTS,
    interactionPoints: OFFICE_INTERACTION_POINTS,
  };
}
