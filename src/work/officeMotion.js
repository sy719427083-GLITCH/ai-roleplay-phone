import { OFFICE_NODES } from "./officeNavigation.js";

const DEFAULT_POSITION = Object.freeze({ x: 50, y: 50 });
const WALK_FRAME_COUNT = 8;

const isFinitePoint = (point) => (
  point
  && Number.isFinite(point.x)
  && Number.isFinite(point.y)
);

const getFacingFromDelta = (dx, dy) => {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "back" : "front";
};

const getRouteSegments = (route = [], nodes = OFFICE_NODES) => {
  if (!Array.isArray(route) || route.length < 2) return [];

  return route.slice(0, -1).map((fromId, index) => {
    const toId = route[index + 1];
    const from = nodes?.[fromId];
    const to = nodes?.[toId];
    const distance = isFinitePoint(from) && isFinitePoint(to)
      ? Math.hypot(to.x - from.x, to.y - from.y)
      : 0;
    return { fromId, toId, from, to, distance };
  }).filter(({ from, to, distance }) => (
    isFinitePoint(from) && isFinitePoint(to) && distance > 0
  ));
};

const getStableRouteEnd = (route = [], nodes = OFFICE_NODES) => {
  if (!Array.isArray(route)) return DEFAULT_POSITION;

  for (let index = route.length - 1; index >= 0; index -= 1) {
    const node = nodes?.[route[index]];
    if (isFinitePoint(node)) return node;
  }

  return DEFAULT_POSITION;
};

export function getRouteDistance(route = [], nodes = OFFICE_NODES) {
  return getRouteSegments(route, nodes)
    .reduce((total, segment) => total + segment.distance, 0);
}

export function sampleOfficeRoute({
  route = [],
  startedAt = 0,
  now = 0,
  speed = 18,
  nodes = OFFICE_NODES,
} = {}) {
  const segments = getRouteSegments(route, nodes);
  if (!segments.length) {
    const point = getStableRouteEnd(route, nodes);
    return {
      x: point.x,
      y: point.y,
      facing: "front",
      segmentIndex: 0,
      done: true,
    };
  }

  const elapsedMs = Math.max(0, (Number.isFinite(now) ? now : 0) - (Number.isFinite(startedAt) ? startedAt : 0));
  let remaining = (elapsedMs / 1000) * (Number.isFinite(speed) && speed > 0 ? speed : 18);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const dx = segment.to.x - segment.from.x;
    const dy = segment.to.y - segment.from.y;

    if (remaining < segment.distance) {
      const progress = remaining / segment.distance;
      return {
        x: segment.from.x + dx * progress,
        y: segment.from.y + dy * progress,
        facing: getFacingFromDelta(dx, dy),
        segmentIndex: index,
        done: false,
      };
    }

    remaining -= segment.distance;
  }

  const end = segments.at(-1).to;
  return {
    x: end.x,
    y: end.y,
    facing: "front",
    segmentIndex: segments.length,
    done: true,
  };
}

export function getWalkFrame({ startedAt = 0, now = 0, fps = 12 } = {}) {
  const elapsedMs = Math.max(0, (Number.isFinite(now) ? now : 0) - (Number.isFinite(startedAt) ? startedAt : 0));
  const framesPerSecond = Number.isFinite(fps) && fps > 0 ? fps : 12;
  return Math.floor((elapsedMs / 1000) * framesPerSecond) % WALK_FRAME_COUNT;
}
