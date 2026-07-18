import PF from "pathfinding";
import {
  OFFICE_SCENES,
  OFFICE_WORLD_SIZE,
  getSceneAnchor,
} from "./officeSceneManifest.js";

export const NAVIGATION_GRID_SIZE = 30;
export const CHARACTER_CAPSULE_RADIUS = 26;
export const PATH_SEGMENT_SAMPLE_INTERVAL = 10;

const hasFinitePoint = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y);

const getCapsuleRadius = (capsule) => {
  if (Number.isFinite(capsule)) return Math.max(0, capsule);
  if (Number.isFinite(capsule?.radius)) return Math.max(0, capsule.radius);
  return CHARACTER_CAPSULE_RADIUS;
};

const getColliders = (scene) => (scene?.objects || []).flatMap((sceneObject) => (
  Array.isArray(sceneObject?.colliders) ? sceneObject.colliders : []
)).filter((collider) => (
  Number.isFinite(collider?.x)
  && Number.isFinite(collider?.y)
  && Number.isFinite(collider?.width)
  && Number.isFinite(collider?.height)
));

const getDynamicColliders = (dynamicObstacles) => (Array.isArray(dynamicObstacles) ? dynamicObstacles : [])
  .flatMap((obstacle) => (
    Array.isArray(obstacle?.colliders)
      ? obstacle.colliders
      : [obstacle]
  ))
  .filter((collider) => (
    Number.isFinite(collider?.x)
    && Number.isFinite(collider?.y)
    && Number.isFinite(collider?.width)
    && Number.isFinite(collider?.height)
  ));

const isInsideExpandedCollider = (point, collider, radius) => (
  point.x >= collider.x - radius
  && point.x <= collider.x + collider.width + radius
  && point.y >= collider.y - radius
  && point.y <= collider.y + collider.height + radius
);

const isLegalPoint = (point, colliders, radius) => (
  hasFinitePoint(point)
  && point.x >= radius
  && point.x <= OFFICE_WORLD_SIZE.width - radius
  && point.y >= radius
  && point.y <= OFFICE_WORLD_SIZE.height - radius
  && !colliders.some((collider) => isInsideExpandedCollider(point, collider, radius))
);

const segmentIntersectsExpandedCollider = (from, to, collider, radius) => {
  const bounds = {
    minX: collider.x - radius,
    maxX: collider.x + collider.width + radius,
    minY: collider.y - radius,
    maxY: collider.y + collider.height + radius,
  };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let entry = 0;
  let exit = 1;

  for (const [start, delta, minimum, maximum] of [
    [from.x, dx, bounds.minX, bounds.maxX],
    [from.y, dy, bounds.minY, bounds.maxY],
  ]) {
    if (delta === 0) {
      if (start < minimum || start > maximum) return false;
      continue;
    }

    const first = (minimum - start) / delta;
    const second = (maximum - start) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return false;
  }

  return true;
};

const worldToGridPoint = (point) => ({
  x: Math.floor(point.x / NAVIGATION_GRID_SIZE),
  y: Math.floor(point.y / NAVIGATION_GRID_SIZE),
});

const gridToWorldPoint = ([x, y]) => ({
  x: (x * NAVIGATION_GRID_SIZE) + (NAVIGATION_GRID_SIZE / 2),
  y: (y * NAVIGATION_GRID_SIZE) + (NAVIGATION_GRID_SIZE / 2),
});

const sampleSegment = (from, to, isLegal, colliders, radius) => {
  if (!hasFinitePoint(from) || !hasFinitePoint(to)) return false;
  if (colliders.some((collider) => segmentIntersectsExpandedCollider(from, to, collider, radius))) return false;

  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const sampleCount = Math.max(1, Math.ceil(distance / PATH_SEGMENT_SAMPLE_INTERVAL));

  for (let index = 0; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    if (!isLegal({
      x: from.x + ((to.x - from.x) * progress),
      y: from.y + ((to.y - from.y) * progress),
    })) return false;
  }

  return true;
};

const hasLegalSegments = (path, isLegalSegment) => path.every((point, index) => (
  index === 0 || isLegalSegment(path[index - 1], point)
));

const hasSamePoint = (first, second) => first.x === second.x && first.y === second.y;

const withExactEndpoints = (points, start, destination) => {
  if (points.length === 0) return [];
  if (points.length === 1) return hasSamePoint(start, destination) ? [start] : [start, destination];

  return [start, ...points.slice(1, -1), destination];
};

const createSafelySmoothedPath = (cells, start, destination, isLegalSegment) => {
  const rawPath = withExactEndpoints(cells.map(gridToWorldPoint), start, destination);
  const path = [rawPath[0]];
  let fromIndex = 0;

  while (fromIndex < rawPath.length - 1) {
    let destinationIndex = rawPath.length - 1;
    while (
      destinationIndex > fromIndex + 1
      && !isLegalSegment(rawPath[fromIndex], rawPath[destinationIndex])
    ) {
      destinationIndex -= 1;
    }
    if (!isLegalSegment(rawPath[fromIndex], rawPath[destinationIndex])) return [];
    path.push(rawPath[destinationIndex]);
    fromIndex = destinationIndex;
  }

  return path;
};

const isGridPointInside = (grid, point) => (
  point.x >= 0
  && point.x < grid.width
  && point.y >= 0
  && point.y < grid.height
);

const resolveScenePoint = (sceneId, point) => {
  if (typeof point === "string") return getSceneAnchor(sceneId, point);
  return hasFinitePoint(point) ? { x: point.x, y: point.y } : null;
};

export function buildNavigationGrid(scene, capsule = CHARACTER_CAPSULE_RADIUS) {
  const radius = getCapsuleRadius(capsule);
  const colliders = getColliders(scene);
  const width = Math.ceil(OFFICE_WORLD_SIZE.width / NAVIGATION_GRID_SIZE);
  const height = Math.ceil(OFFICE_WORLD_SIZE.height / NAVIGATION_GRID_SIZE);
  const matrix = Array.from({ length: height }, (_, y) => (
    Array.from({ length: width }, (_, x) => (
      isLegalPoint(gridToWorldPoint([x, y]), colliders, radius) ? 0 : 1
    ))
  ));

  return new PF.Grid(matrix);
}

export function isLegalCharacterPosition(sceneId, point) {
  const scene = OFFICE_SCENES[sceneId];
  return Boolean(scene) && isLegalPoint(point, getColliders(scene), CHARACTER_CAPSULE_RADIUS);
}

export function isLegalCharacterSegment(sceneId, from, to, dynamicObstacles = []) {
  const scene = OFFICE_SCENES[sceneId];
  if (!scene || !hasFinitePoint(from) || !hasFinitePoint(to)) return false;

  const colliders = [...getColliders(scene), ...getDynamicColliders(dynamicObstacles)];
  return sampleSegment(
    from,
    to,
    (point) => isLegalPoint(point, colliders, CHARACTER_CAPSULE_RADIUS),
    colliders,
    CHARACTER_CAPSULE_RADIUS,
  );
}

export function findScenePath({ sceneId, from, to, dynamicObstacles } = {}) {
  const scene = OFFICE_SCENES[sceneId];
  const start = resolveScenePoint(sceneId, from);
  const destination = resolveScenePoint(sceneId, to);
  if (!scene || !start || !destination) return [];

  const colliders = [...getColliders(scene), ...getDynamicColliders(dynamicObstacles)];
  const isLegal = (point) => isLegalPoint(point, colliders, CHARACTER_CAPSULE_RADIUS);
  const isLegalSegment = (startPoint, endPoint) => isLegalCharacterSegment(
    sceneId,
    startPoint,
    endPoint,
    dynamicObstacles,
  );
  if (!isLegal(start) || !isLegal(destination)) return [];

  const navigationScene = colliders.length === getColliders(scene).length
    ? scene
    : { ...scene, objects: [{ colliders }] };
  const grid = buildNavigationGrid(navigationScene, CHARACTER_CAPSULE_RADIUS);
  const startCell = worldToGridPoint(start);
  const endCell = worldToGridPoint(destination);
  if (
    !isGridPointInside(grid, startCell)
    || !isGridPointInside(grid, endCell)
  ) return [];

  // World-coordinate legality is authoritative for endpoints near a grid-cell edge.
  grid.setWalkableAt(startCell.x, startCell.y, true);
  grid.setWalkableAt(endCell.x, endCell.y, true);

  const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
  const cells = finder.findPath(startCell.x, startCell.y, endCell.x, endCell.y, grid.clone());
  if (cells.length === 0) return [];

  const createLegalPath = (pathCells) => {
    const smoothedPath = withExactEndpoints(
      PF.Util.smoothenPath(grid, pathCells).map(gridToWorldPoint),
      start,
      destination,
    );
    if (hasLegalSegments(smoothedPath, isLegalSegment)) return smoothedPath;

    const safelySmoothedPath = createSafelySmoothedPath(
      pathCells,
      start,
      destination,
      isLegalSegment,
    );
    return hasLegalSegments(safelySmoothedPath, isLegalSegment)
      ? safelySmoothedPath
      : [];
  };

  const path = createLegalPath(cells);
  if (path.length) return path;

  const orthogonalCells = new PF.AStarFinder({ allowDiagonal: false })
    .findPath(startCell.x, startCell.y, endCell.x, endCell.y, grid.clone());
  return orthogonalCells.length ? createLegalPath(orthogonalCells) : [];
}
