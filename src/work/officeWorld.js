import {
  OFFICE_DOOR_PAIRS,
  OFFICE_SCENES,
  OFFICE_WORLD_SIZE,
  getSceneAnchor,
} from "./officeSceneManifest.js";
import {
  NAVIGATION_GRID_SIZE,
  findScenePath,
  isLegalCharacterPosition,
  isLegalCharacterSegment,
} from "./officePathfinding.js";

export const ACTOR_SEPARATION_DISTANCE = 52;
export const WORLD_ROUTE_ANCHOR_EPSILON = 0.001;

const DEFAULT_SPEED = 10;
const WAIT_POSITION_SEARCH_LIMIT = Math.max(OFFICE_WORLD_SIZE.width, OFFICE_WORLD_SIZE.height);
const EMPTY_ROUTE_SAMPLE = Object.freeze({
  sceneId: null,
  x: 0,
  y: 0,
  facing: "front",
  segmentIndex: 0,
  done: true,
});

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

const hasSamePoint = (left, right) => (
  isFinitePoint(left)
  && isFinitePoint(right)
  && Math.abs(left.x - right.x) <= WORLD_ROUTE_ANCHOR_EPSILON
  && Math.abs(left.y - right.y) <= WORLD_ROUTE_ANCHOR_EPSILON
);

export const isValidWorldRoute = (route) => {
  if (
    !Array.isArray(route)
    || !isCoordinateEntry(route[0])
    || !isLegalCharacterPosition(route[0].sceneId, route[0])
  ) return false;

  let current = { ...route[0] };
  for (let index = 1; index < route.length; index += 1) {
    const entry = route[index];
    if (isCoordinateEntry(entry)) {
      if (
        entry.sceneId !== current.sceneId
        || !isLegalCharacterPosition(entry.sceneId, entry)
        || !isLegalCharacterSegment(current.sceneId, current, entry)
      ) return false;
      current = { ...entry };
      continue;
    }
    if (!isTransitionEntry(entry)) return false;

    const expectedDestination = OFFICE_DOOR_PAIRS[`${current.sceneId}:exit`];
    const sourceAnchor = getSceneAnchor(current.sceneId, "exit");
    if (
      !expectedDestination
      || entry.from.sceneId !== current.sceneId
      || entry.from.anchorId !== "exit"
      || entry.to.sceneId !== expectedDestination.sceneId
      || entry.to.anchorId !== expectedDestination.anchorId
      || !hasSamePoint(current, sourceAnchor)
      || !isLegalCharacterPosition(current.sceneId, current)
    ) return false;

    const destination = getTransitionDestination(entry);
    if (!destination || !isLegalCharacterPosition(destination.sceneId, destination)) return false;
    current = destination;
  }

  return true;
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

const findGuaranteedLegalPoint = (sceneId) => {
  const scene = OFFICE_SCENES[sceneId];
  if (!scene) return null;

  const anchorIds = [
    "entry",
    ...Object.keys(scene.anchors).filter((anchorId) => anchorId !== "entry"),
  ];
  for (const anchorId of anchorIds) {
    const anchor = getSceneAnchor(sceneId, anchorId);
    if (isLegalCharacterPosition(sceneId, anchor)) return { x: anchor.x, y: anchor.y };
  }

  for (let y = NAVIGATION_GRID_SIZE / 2; y < OFFICE_WORLD_SIZE.height; y += NAVIGATION_GRID_SIZE) {
    for (let x = NAVIGATION_GRID_SIZE / 2; x < OFFICE_WORLD_SIZE.width; x += NAVIGATION_GRID_SIZE) {
      if (isLegalCharacterPosition(sceneId, { x, y })) return { x, y };
    }
  }

  return null;
};

const getSafeRouteFallback = (start) => {
  if (!isCoordinateEntry(start) || !OFFICE_SCENES[start.sceneId]) return null;
  return findNearestLegalPoint(start.sceneId, start) ?? findGuaranteedLegalPoint(start.sceneId);
};

const findWorldScenePath = ({ sceneId, from, to }) => {
  const path = findScenePath({ sceneId, from, to });
  if (path.length) return path;

  const start = typeof from === "string" ? getSceneAnchor(sceneId, from) : findNearestLegalPoint(sceneId, from);
  const destination = typeof to === "string" ? getSceneAnchor(sceneId, to) : findNearestLegalPoint(sceneId, to);
  if (!isFinitePoint(start) || !isFinitePoint(destination)) return [];
  return findScenePath({ sceneId, from: start, to: destination });
};

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

const hasSeparationFrom = (point, actor, sceneId) => {
  const otherPoint = getActorPoint(actor);
  return actor.sceneId !== sceneId
    || !isMoving(actor)
    || !otherPoint
    || Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y) >= ACTOR_SEPARATION_DISTANCE;
};

const isSafeAgainstResolvedActors = (point, sceneId, actors) => (
  isLegalAdjustedPoint(sceneId, point)
  && actors.every((actor) => hasSeparationFrom(point, actor, sceneId))
);

const getResolvedActors = (owners, separated, throughIndex, excludedIndex) => (
  owners.slice(0, throughIndex)
    .filter(({ index }) => index !== excludedIndex)
    .map(({ index }) => separated[index])
);

const getWaitingOrigins = (actor) => {
  const current = getActorPoint(actor);
  const previous = getPreviousActorPoint(actor, current);
  return [previous, current].filter((point, index, points) => (
    isFinitePoint(point)
    && points.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y) === index
  ));
};

const getWaitingPosition = (actor, resolvedActors) => {
  const origins = getWaitingOrigins(actor);
  for (const origin of origins) {
    if (isSafeAgainstResolvedActors(origin, actor.sceneId, resolvedActors)) return origin;
  }

  for (let radius = 1; radius <= WAIT_POSITION_SEARCH_LIMIT; radius += 1) {
    for (const origin of origins) {
      for (let x = -radius; x <= radius; x += 1) {
        for (const y of [-radius, radius]) {
          const candidate = { x: origin.x + x, y: origin.y + y };
          if (isSafeAgainstResolvedActors(candidate, actor.sceneId, resolvedActors)) return candidate;
        }
      }
      for (let y = -radius + 1; y < radius; y += 1) {
        for (const x of [-radius, radius]) {
          const candidate = { x: origin.x + x, y: origin.y + y };
          if (isSafeAgainstResolvedActors(candidate, actor.sceneId, resolvedActors)) return candidate;
        }
      }
    }
  }

  return null;
};

const waitAtPreviousPosition = (actor, resolvedActors) => {
  const position = getWaitingPosition(actor, resolvedActors);
  if (!position) throw new Error("Unable to find a safe actor waiting position");
  return withActorPoint(actor, position, true);
};

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

  const start = route[0];
  if (!start) {
    return { ...EMPTY_ROUTE_SAMPLE };
  }
  if (!isCoordinateEntry(start)) {
    return { ...EMPTY_ROUTE_SAMPLE };
  }
  if (!isValidWorldRoute(route)) {
    const safeStart = getSafeRouteFallback(start);
    if (!safeStart) return { ...EMPTY_ROUTE_SAMPLE };
    return { sceneId: start.sceneId, x: safeStart.x, y: safeStart.y, facing: "front", segmentIndex: 0, done: true };
  }

  let current = { ...start };
  let remaining = getElapsedDistance({ startedAt, now, speed });
  let segmentIndex = 0;

  for (let index = 1; index < route.length; index += 1) {
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
      const resolvedActors = getResolvedActors(owners, separated, rightIndex, leftOwner.index);
      if (
        isSafeAgainstResolvedActors(adjustedLeft, left.sceneId, resolvedActors)
        && isSafeAgainstResolvedActors(adjustedRight, right.sceneId, resolvedActors)
      ) {
        separated[leftOwner.index] = withActorPoint(left, adjustedLeft);
        separated[rightOwner.index] = withActorPoint(right, adjustedRight);
        continue;
      }

      separated[rightOwner.index] = waitAtPreviousPosition(right, resolvedActors);
    }
  }

  for (let rightIndex = 1; rightIndex < owners.length; rightIndex += 1) {
    const rightOwner = owners[rightIndex];
    const right = separated[rightOwner.index];
    const earlierActors = getResolvedActors(owners, separated, rightIndex, rightOwner.index);
    const point = getActorPoint(right);
    if (!point || earlierActors.every((actor) => hasSeparationFrom(point, actor, right.sceneId))) continue;
    separated[rightOwner.index] = waitAtPreviousPosition(right, earlierActors);
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
