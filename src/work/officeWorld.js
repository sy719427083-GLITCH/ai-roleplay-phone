import { OFFICE_DOOR_PAIRS, getSceneAnchor } from "./officeSceneManifest.js";
import { findScenePath, isLegalCharacterPosition } from "./officePathfinding.js";

export const ACTOR_SEPARATION_DISTANCE = 52;

const DEFAULT_SPEED = 10;

const isFinitePoint = (point) => (
  point
  && Number.isFinite(point.x)
  && Number.isFinite(point.y)
);

const isCoordinateEntry = (entry) => (
  entry
  && typeof entry.sceneId === "string"
  && isFinitePoint(entry)
  && !entry.transition
);

const isTransitionEntry = (entry) => (
  entry?.transition === true
  && typeof entry.from?.sceneId === "string"
  && typeof entry.from?.anchorId === "string"
  && typeof entry.to?.sceneId === "string"
  && typeof entry.to?.anchorId === "string"
);

const toScenePoint = (sceneId, point) => ({ sceneId, x: point.x, y: point.y });

const getFacingFromDelta = (dx, dy) => {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "back" : "front";
};

const getSpeed = (speed) => (Number.isFinite(speed) && speed > 0 ? speed : DEFAULT_SPEED);

const getElapsedDistance = ({ startedAt, now, speed }) => {
  const elapsed = Math.max(0, (Number.isFinite(now) ? now : 0) - (Number.isFinite(startedAt) ? startedAt : 0));
  return (elapsed / 1000) * getSpeed(speed);
};

const getTransitionDestination = (entry) => {
  if (!isTransitionEntry(entry)) return null;
  const point = getSceneAnchor(entry.to.sceneId, entry.to.anchorId);
  return isFinitePoint(point) ? toScenePoint(entry.to.sceneId, point) : null;
};

const findNearestLegalPoint = (sceneId, point) => {
  if (!isFinitePoint(point)) return null;
  if (isLegalCharacterPosition(sceneId, point)) return { x: point.x, y: point.y };

  for (let radius = 1; radius <= 120; radius += 1) {
    const candidates = [
      { x: point.x - radius, y: point.y },
      { x: point.x + radius, y: point.y },
      { x: point.x, y: point.y - radius },
      { x: point.x, y: point.y + radius },
    ];
    const legal = candidates.find((candidate) => isLegalCharacterPosition(sceneId, candidate));
    if (legal) return legal;
  }

  return null;
};

const findWorldScenePath = ({ sceneId, from, to }) => {
  const path = findScenePath({ sceneId, from, to });
  if (path.length) return path;

  const start = typeof from === "string" ? getSceneAnchor(sceneId, from) : findNearestLegalPoint(sceneId, from);
  const destination = typeof to === "string" ? getSceneAnchor(sceneId, to) : findNearestLegalPoint(sceneId, to);
  if (!isFinitePoint(start) || !isFinitePoint(destination)) return [];
  return findScenePath({ sceneId, from: start, to: destination });
};

const getRouteStart = (route) => route.find(isCoordinateEntry) ?? null;

const getRouteEnd = (route) => {
  for (let index = route.length - 1; index >= 0; index -= 1) {
    if (isCoordinateEntry(route[index])) return route[index];
    if (isTransitionEntry(route[index])) return getTransitionDestination(route[index]);
  }
  return null;
};

const getActorPoint = (actor) => {
  if (isFinitePoint(actor?.position)) return actor.position;
  return isFinitePoint(actor) ? actor : null;
};

const getPreviousActorPoint = (actor, point) => (
  isFinitePoint(actor?.previousPosition) ? actor.previousPosition : point
);

const isMoving = (actor) => actor?.moving === true;

const withActorPoint = (actor, point, waiting = false) => {
  const next = { ...actor, x: point.x, y: point.y };
  if (isFinitePoint(actor?.position)) next.position = { ...actor.position, x: point.x, y: point.y };
  if (waiting) next.waiting = true;
  else delete next.waiting;
  return next;
};

const getLateralOffset = (left, right) => {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const distance = Math.hypot(dx, dy);
  const needed = Math.sqrt((ACTOR_SEPARATION_DISTANCE ** 2) - (distance ** 2)) / 2;
  if (needed <= 0) return null;

  if (distance > 0) return { x: (-dy / distance) * needed, y: (dx / distance) * needed };

  const facing = left.facing || right.facing;
  if (facing === "left" || facing === "right") return { x: 0, y: needed };
  return { x: needed, y: 0 };
};

const isLegalAdjustedPoint = (sceneId, point) => isLegalCharacterPosition(sceneId, point);

export function buildWorldRoute({ from, to } = {}) {
  if (!isCoordinateEntry(from) || !isCoordinateEntry(to)) return [];

  if (from.sceneId === to.sceneId) {
    return findWorldScenePath({ sceneId: from.sceneId, from, to }).map((point) => toScenePoint(from.sceneId, point));
  }

  const pairedDoor = OFFICE_DOOR_PAIRS[`${from.sceneId}:exit`];
  if (!pairedDoor || pairedDoor.sceneId !== to.sceneId) return [];

  const sourcePath = findWorldScenePath({ sceneId: from.sceneId, from, to: "exit" });
  const destinationPath = findWorldScenePath({ sceneId: to.sceneId, from: pairedDoor.anchorId, to });
  if (!sourcePath.length || !destinationPath.length) return [];

  return [
    ...sourcePath.map((point) => toScenePoint(from.sceneId, point)),
    {
      transition: true,
      from: { sceneId: from.sceneId, anchorId: "exit" },
      to: { sceneId: pairedDoor.sceneId, anchorId: pairedDoor.anchorId },
    },
    ...destinationPath.map((point) => toScenePoint(to.sceneId, point)),
  ];
}

export function sampleWorldRoute({ route = [], startedAt = 0, now = 0, speed = DEFAULT_SPEED } = {}) {
  if (!Array.isArray(route)) route = [];

  const start = getRouteStart(route);
  if (!start) {
    return { sceneId: null, x: 0, y: 0, facing: "front", segmentIndex: 0, done: true };
  }

  let current = { ...start };
  let remaining = getElapsedDistance({ startedAt, now, speed });
  let segmentIndex = 0;

  for (let index = route.indexOf(start) + 1; index < route.length; index += 1) {
    const entry = route[index];
    if (isTransitionEntry(entry)) {
      const destination = getTransitionDestination(entry);
      if (destination) current = destination;
      continue;
    }
    if (!isCoordinateEntry(entry) || entry.sceneId !== current.sceneId) continue;

    const dx = entry.x - current.x;
    const dy = entry.y - current.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    if (remaining < distance) {
      const progress = remaining / distance;
      return {
        sceneId: current.sceneId,
        x: current.x + dx * progress,
        y: current.y + dy * progress,
        facing: getFacingFromDelta(dx, dy),
        segmentIndex,
        done: false,
      };
    }

    remaining -= distance;
    current = { ...entry };
    segmentIndex += 1;
  }

  const end = getRouteEnd(route) ?? current;
  return {
    sceneId: end.sceneId,
    x: end.x,
    y: end.y,
    facing: "front",
    segmentIndex,
    done: true,
  };
}

export function separateActors(actors = []) {
  if (!Array.isArray(actors)) return [];

  const separated = actors.map((actor) => {
    const point = getActorPoint(actor);
    return point ? withActorPoint(actor, point) : { ...actor };
  });
  const owners = separated
    .map((actor, index) => ({ actor, index, startedAt: Number.isFinite(actor.routeStartedAt) ? actor.routeStartedAt : 0 }))
    .sort((left, right) => left.startedAt - right.startedAt || left.index - right.index);

  for (let leftIndex = 0; leftIndex < owners.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < owners.length; rightIndex += 1) {
      const leftOwner = owners[leftIndex];
      const rightOwner = owners[rightIndex];
      const left = separated[leftOwner.index];
      const right = separated[rightOwner.index];
      const leftPoint = getActorPoint(left);
      const rightPoint = getActorPoint(right);
      if (
        !isMoving(left)
        || !isMoving(right)
        || left.sceneId !== right.sceneId
        || !leftPoint
        || !rightPoint
        || Math.hypot(rightPoint.x - leftPoint.x, rightPoint.y - leftPoint.y) >= ACTOR_SEPARATION_DISTANCE
      ) continue;

      const offset = getLateralOffset(left, right);
      if (!offset) continue;
      const adjustedLeft = { x: leftPoint.x - offset.x, y: leftPoint.y - offset.y };
      const adjustedRight = { x: rightPoint.x + offset.x, y: rightPoint.y + offset.y };
      if (isLegalAdjustedPoint(left.sceneId, adjustedLeft) && isLegalAdjustedPoint(right.sceneId, adjustedRight)) {
        separated[leftOwner.index] = withActorPoint(left, adjustedLeft);
        separated[rightOwner.index] = withActorPoint(right, adjustedRight);
        continue;
      }

      separated[rightOwner.index] = withActorPoint(right, getPreviousActorPoint(right, rightPoint), true);
    }
  }

  return separated;
}

export function createOverlaySnapshot(world = {}, visibleSceneId) {
  const actors = Array.isArray(world?.actors)
    ? world.actors
    : Object.entries(world?.actors || {}).map(([id, actor]) => ({ id, ...actor }));

  return {
    sceneId: visibleSceneId,
    actors: actors.flatMap((actor) => {
      const point = getActorPoint(actor);
      if (actor?.sceneId !== visibleSceneId || !point || typeof actor.id !== "string") return [];
      return [{ id: actor.id, x: point.x, y: point.y, facing: actor.facing || "front" }];
    }),
  };
}
