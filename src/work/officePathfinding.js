const DEFAULT_GRID_STEP = 2;
const EDGE_MARGIN = 4;
const MAX_ENDPOINT_CONNECTOR_PX = 180;

function pointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function pointsEqual(first, second) {
  return first.x === second.x && first.y === second.y;
}

function pixelDistance(from, to, viewport) {
  return Math.hypot(
    ((to.x - from.x) / 100) * viewport.width,
    ((to.y - from.y) / 100) * viewport.height,
  );
}

export function segmentIntersectsRect(from, to, rect) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const p = [-deltaX, deltaX, -deltaY, deltaY];
  const q = [from.x - rect.left, rect.right - from.x, from.y - rect.top, rect.bottom - from.y];
  let minimum = 0;
  let maximum = 1;

  for (let index = 0; index < 4; index += 1) {
    if (p[index] === 0) {
      if (q[index] < 0) return false;
      continue;
    }
    const ratio = q[index] / p[index];
    if (p[index] < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return false;
  }
  return true;
}

function segmentIsClear(from, to, obstacles) {
  return obstacles.every((obstacle) => !segmentIntersectsRect(from, to, obstacle));
}

function endpointConnectorIsClear(endpoint, gridPoint, obstacles) {
  return obstacles.every((obstacle) => {
    if (!pointInsideRect(endpoint, obstacle)) return !segmentIntersectsRect(endpoint, gridPoint, obstacle);
    if (obstacle.visible && pointInsideRect(endpoint, obstacle.visible)) {
      return gridPoint.y < obstacle.visible.top;
    }
    return !obstacle.visible || !segmentIntersectsRect(endpoint, gridPoint, obstacle.visible);
  });
}

function removeCollinearPoints(path) {
  if (path.length < 3) return path;
  const result = [path[0]];
  for (let index = 1; index < path.length - 1; index += 1) {
    const previous = result.at(-1);
    const current = path[index];
    const next = path[index + 1];
    const cross = (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x);
    if (Math.abs(cross) > 1e-9) result.push(current);
  }
  result.push(path.at(-1));
  return result;
}

export function simplifyOfficePath(path, obstacles) {
  if (path.length < 3) return path;
  const collinear = removeCollinearPoints(path);
  const simplified = [collinear[0]];
  let anchor = 0;
  while (anchor < collinear.length - 1) {
    let candidate = collinear.length - 1;
    while (candidate > anchor + 1 && !segmentIsClear(collinear[anchor], collinear[candidate], obstacles)) candidate -= 1;
    simplified.push(collinear[candidate]);
    anchor = candidate;
  }
  return simplified;
}

function buildGrid(gridStep, obstacles) {
  const points = new Map();
  for (let y = EDGE_MARGIN; y <= 100 - EDGE_MARGIN; y += gridStep) {
    for (let x = EDGE_MARGIN; x <= 100 - EDGE_MARGIN; x += gridStep) {
      const point = { x, y };
      if (!obstacles.some((obstacle) => pointInsideRect(point, obstacle))) points.set(`${x},${y}`, point);
    }
  }
  return points;
}

function getGridNeighbors(point, gridStep, grid) {
  const neighbors = [];
  for (const deltaY of [-gridStep, 0, gridStep]) {
    for (const deltaX of [-gridStep, 0, gridStep]) {
      if (deltaX === 0 && deltaY === 0) continue;
      const key = `${point.x + deltaX},${point.y + deltaY}`;
      const neighbor = grid.get(key);
      if (neighbor) neighbors.push([key, neighbor]);
    }
  }
  return neighbors;
}

function getEndpointConnections(endpoint, grid, obstacles, viewport) {
  const connections = new Map();
  for (const [key, point] of grid) {
    const distance = pixelDistance(endpoint, point, viewport);
    if (distance <= MAX_ENDPOINT_CONNECTOR_PX && endpointConnectorIsClear(endpoint, point, obstacles)) {
      connections.set(key, distance);
    }
  }
  return connections;
}

function reconstructPath(parent, grid, lastKey, start, goal) {
  const reversed = [];
  let key = lastKey;
  while (key) {
    reversed.push(grid.get(key));
    key = parent.get(key) ?? null;
  }
  const path = [start, ...reversed.reverse(), goal];
  return path.filter((point, index) => index === 0 || !pointsEqual(point, path[index - 1]));
}

export function planOfficePath({ start, goal, viewport, obstacles = [], gridStep = DEFAULT_GRID_STEP }) {
  if (!start || !goal || !viewport || viewport.width <= 0 || viewport.height <= 0 || gridStep <= 0) return [];
  if (pointsEqual(start, goal)) return [start];
  if (!obstacles.some((obstacle) => pointInsideRect(start, obstacle) || pointInsideRect(goal, obstacle)) && segmentIsClear(start, goal, obstacles)) {
    return [start, goal];
  }

  const grid = buildGrid(gridStep, obstacles);
  const startConnections = getEndpointConnections(start, grid, obstacles, viewport);
  const goalConnections = getEndpointConnections(goal, grid, obstacles, viewport);
  if (!startConnections.size || !goalConnections.size) return [];

  const open = [];
  const parent = new Map();
  const costs = new Map();
  for (const [key, cost] of startConnections) {
    costs.set(key, cost);
    open.push({ key, score: cost + pixelDistance(grid.get(key), goal, viewport) });
  }

  const closed = new Set();
  while (open.length) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      if (open[index].score < open[bestIndex].score) bestIndex = index;
    }
    const [{ key }] = open.splice(bestIndex, 1);
    if (closed.has(key)) continue;
    closed.add(key);

    if (goalConnections.has(key)) {
      return simplifyOfficePath(reconstructPath(parent, grid, key, start, goal), obstacles);
    }

    const point = grid.get(key);
    for (const [neighborKey, neighbor] of getGridNeighbors(point, gridStep, grid)) {
      if (closed.has(neighborKey) || !segmentIsClear(point, neighbor, obstacles)) continue;
      const tentativeCost = costs.get(key) + pixelDistance(point, neighbor, viewport);
      if (tentativeCost >= (costs.get(neighborKey) ?? Infinity)) continue;
      costs.set(neighborKey, tentativeCost);
      parent.set(neighborKey, key);
      open.push({ key: neighborKey, score: tentativeCost + pixelDistance(neighbor, goal, viewport) });
    }
  }
  return [];
}

export function getSegmentDuration(from, to, viewport) {
  const baseline = viewport.width * 0.12;
  return Math.max(240, Math.round((pixelDistance(from, to, viewport) / baseline) * 700));
}

export function getSegmentFacing(from, to) {
  return to.x < from.x ? "left" : "right";
}
