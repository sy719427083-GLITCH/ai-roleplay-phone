import { useMemo, useRef } from "react";
import { DoorOpen } from "lucide-react";
import { OFFICE_SCENES } from "./officeSceneManifest.js";

const DEFAULT_SCENE_WIDTH = 390;
const DEFAULT_SCENE_HEIGHT = 712;
const LABEL_WIDTH = 64;
const STATUS_WIDTH = 50;
const BUBBLE_WIDTH = 138;
const BUBBLE_STACK_WIDTH = BUBBLE_WIDTH;
const BUBBLE_MIN_HEIGHT = 30;
const NAME_MIN_HEIGHT = 16;
const STATUS_MIN_HEIGHT = 13;
const STACK_GAP = 3;
const EDGE_GUTTER = 6;
const COLLISION_STEP = 2;
const MAX_HEAD_STACK_DRIFT = 24;
const MAX_NAME_DRIFT = 16;
const MAX_BUBBLE_DRIFT = 112;
const MAX_BUBBLE_VERTICAL_DRIFT = 64;
const MAX_STATUS_HEAD_GAP = 30;
const IDLE_STATUS = "空闲中";
const MAX_BUBBLE_CHARACTERS = 80;
const ACTOR_HEAD_OFFSET_WORLD = 330;
const HEAD_GAP = 6;

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const round = (value) => Math.round(value * 10) / 10;

const textUnits = (value) => Array.from(cleanText(value)).reduce((total, character) => {
  if (character === "\n") return total;
  if (/^[\x00-\x7F]$/u.test(character)) return total + (character === " " ? 0.35 : 0.62);
  return total + 1;
}, 0);

const measureTextBox = (value, {
  lineUnits,
  lineHeight,
  minimumHeight,
  verticalChrome,
}) => {
  const lines = cleanText(value).split("\n").reduce((total, line) => (
    total + Math.max(1, Math.ceil(textUnits(line) / lineUnits))
  ), 0);
  return Math.max(minimumHeight, Math.ceil((lines * lineHeight) + verticalChrome));
};

export function measureOfficeOverlayText(snapshot = {}) {
  const bubble = cleanText(snapshot.bubble).slice(0, MAX_BUBBLE_CHARACTERS);
  const nameHeight = measureTextBox(snapshot.name || "NPC", {
    lineUnits: 12,
    lineHeight: 9,
    minimumHeight: NAME_MIN_HEIGHT,
    verticalChrome: 3,
  });
  const statusHeight = measureTextBox(snapshot.status || IDLE_STATUS, {
    lineUnits: 9,
    lineHeight: 8,
    minimumHeight: STATUS_MIN_HEIGHT,
    verticalChrome: 3,
  });
  const bubbleHeight = bubble ? measureTextBox(bubble, {
    lineUnits: 12,
    lineHeight: 11.5,
    minimumHeight: BUBBLE_MIN_HEIGHT,
    verticalChrome: 6,
  }) : 0;
  const labelHeight = nameHeight;
  return Object.freeze({
    bubbleHeight,
    labelHeight,
    nameHeight,
    statusHeight,
    stackHeight: labelHeight + (bubble ? bubbleHeight + STACK_GAP : 0),
  });
}

const fallbackScreenPoint = (actor) => ({
  x: (Number(actor?.x) || 0) * (DEFAULT_SCENE_WIDTH / 1080),
  y: (Number(actor?.y) || 0) * (DEFAULT_SCENE_HEIGHT / 1920),
});

export function buildOfficeActorSnapshots({ state = {}, world = {}, renderer = null } = {}) {
  const characters = isRecord(state.characters) ? state.characters : {};
  const conversations = isRecord(state.conversations) ? state.conversations : {};
  const visibleSceneId = cleanText(world.visibleSceneId) || cleanText(state.visibleSceneId) || "office";

  return (Array.isArray(world.actors) ? world.actors : []).map((actor) => {
    const slotId = cleanText(actor?.id);
    const character = isRecord(characters[slotId]) ? characters[slotId] : {};
    const conversation = conversations[cleanText(character.conversationId)];
    const activeBubble = Array.isArray(conversation?.bubbleQueue) ? conversation.bubbleQueue[0] : null;
    const point = renderer?.worldToScreen?.(actor) || fallbackScreenPoint(actor);
    const headPoint = renderer?.worldToScreen?.({ ...actor, y: (Number(actor?.y) || 0) - ACTOR_HEAD_OFFSET_WORLD })
      || fallbackScreenPoint({ ...actor, y: (Number(actor?.y) || 0) - ACTOR_HEAD_OFFSET_WORLD });
    return {
      slotId,
      visible: cleanText(actor?.sceneId) === visibleSceneId,
      screenX: round(Number(point?.x) || 0),
      screenY: round(Number(point?.y) || 0),
      headScreenY: round(Number(headPoint?.y) || 0),
      worldX: round(Number(actor?.x) || 0),
      worldY: round(Number(actor?.y) || 0),
      name: cleanText(actor?.profile?.name) || cleanText(character.profile?.name) || "NPC",
      status: cleanText(actor?.status) || cleanText(character.status) || IDLE_STATUS,
      bubble: cleanText(activeBubble?.speakerId) === slotId
        ? cleanText(activeBubble?.text).slice(0, MAX_BUBBLE_CHARACTERS)
        : "",
      facing: cleanText(actor?.facing) || cleanText(character.facing) || "front",
      sceneId: cleanText(actor?.sceneId) || "office",
      clip: cleanText(actor?.clip) || "idle-standing",
      frameIndex: Math.max(0, Math.floor(Number(actor?.frameIndex) || 0)),
      moving: Boolean(actor?.motion),
    };
  });
}

export function buildOfficeActorBodyRects(snapshots = []) {
  return snapshots.filter(({ visible }) => visible).map((snapshot) => {
    const bodyHeight = Math.max(1, snapshot.screenY - snapshot.headScreenY);
    const bodyWidth = clamp(bodyHeight * 0.6, 34, 90);
    return {
      id: `${snapshot.slotId}:body`,
      x: round(snapshot.screenX - (bodyWidth / 2)),
      y: round(snapshot.headScreenY),
      width: round(bodyWidth),
      height: round(bodyHeight),
    };
  });
}

export function buildOfficeSceneOverlayGeometry({ sceneId = "office", renderer = null } = {}) {
  const scene = OFFICE_SCENES[sceneId] || OFFICE_SCENES.office;
  const project = (point) => renderer?.worldToScreen?.(point) || fallbackScreenPoint(point);
  const furnitureRects = scene.objects.map((object) => {
    const colliders = object.colliders?.length ? object.colliders : [object];
    const left = Math.min(...colliders.map(({ x }) => x));
    const top = Math.min(...colliders.map(({ y }) => y));
    const right = Math.max(...colliders.map(({ x, width }) => x + width));
    const bottom = Math.max(...colliders.map(({ y, height }) => y + height));
    const topLeft = project({ x: left, y: top });
    const bottomRight = project({ x: right, y: bottom });
    return {
      id: object.id,
      x: round(topLeft.x),
      y: round(topLeft.y),
      width: round(bottomRight.x - topLeft.x),
      height: round(bottomRight.y - topLeft.y),
    };
  });
  const doorId = sceneId === "lounge" ? "lounge-door" : "office-door";
  const door = scene.objects.find(({ id }) => id === doorId);
  const doorPoint = door ? project({
    x: door.x + (door.width / 2),
    y: door.y + (door.height / 2),
  }) : { x: 0, y: 0 };
  return {
    doorPoint: { x: round(doorPoint.x), y: round(doorPoint.y) },
    furnitureRects,
  };
}

const intersects = (left, right) => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

const makeRects = (snapshot, metrics, stackX, stackY, sceneWidth, labelYOverride = null) => {
  if (!snapshot.bubble) {
    return {
      labelRect: { x: round(stackX), y: round(stackY), width: LABEL_WIDTH, height: metrics.labelHeight },
      bubbleRect: null,
    };
  }
  const labelX = clamp(
    snapshot.screenX - (LABEL_WIDTH / 2),
    EDGE_GUTTER,
    sceneWidth - LABEL_WIDTH - EDGE_GUTTER,
  );
  const labelY = Number.isFinite(labelYOverride)
    ? labelYOverride
    : Number.isFinite(snapshot.headScreenY)
      ? snapshot.headScreenY - metrics.labelHeight - HEAD_GAP
      : stackY + metrics.bubbleHeight + STACK_GAP;
  return {
    labelRect: {
      x: round(labelX),
      y: round(labelY),
      width: LABEL_WIDTH,
      height: metrics.labelHeight,
    },
    bubbleRect: { x: round(stackX), y: round(stackY), width: BUBBLE_WIDTH, height: metrics.bubbleHeight },
  };
};

const makeStatusCandidates = (snapshot, metrics, labelRect, bounds) => {
  const sideY = round(labelRect.y + ((labelRect.height - metrics.statusHeight) / 2));
  const preferredRight = snapshot.screenX > bounds.width / 2;
  const sideCandidates = [
    { x: labelRect.x + labelRect.width + 4, y: sideY },
    { x: labelRect.x - STATUS_WIDTH - 4, y: sideY },
  ];
  if (!preferredRight) sideCandidates.reverse();
  const belowY = labelRect.y + labelRect.height + 4;
  const belowSideCandidates = sideCandidates.map(({ x }) => ({ x, y: belowY }));
  const candidates = [
    ...sideCandidates,
    ...belowSideCandidates,
    { x: labelRect.x + ((labelRect.width - STATUS_WIDTH) / 2), y: labelRect.y - metrics.statusHeight - 4 },
  ];
  return candidates.map(({ x, y }, index) => ({
    penalty: index * 2,
    rectangle: {
      x: round(x),
      y: round(y),
      width: STATUS_WIDTH,
      height: metrics.statusHeight,
    },
  })).filter(({ rectangle }) => (
    rectangle.x >= EDGE_GUTTER
    && rectangle.y >= EDGE_GUTTER
    && rectangle.x + rectangle.width <= bounds.width - EDGE_GUTTER
    && rectangle.y + rectangle.height <= bounds.height - EDGE_GUTTER
    && (!Number.isFinite(snapshot.headScreenY)
      || rectangle.y + rectangle.height >= snapshot.headScreenY - MAX_STATUS_HEAD_GAP)
  ));
};

const verticalCandidates = (preferredY, maximumY) => {
  const candidates = [clamp(preferredY, EDGE_GUTTER, maximumY)];
  const searchDistance = maximumY + Math.abs(preferredY) + COLLISION_STEP;
  for (let distance = COLLISION_STEP; distance <= searchDistance; distance += COLLISION_STEP) {
    candidates.push(clamp(preferredY - distance, EDGE_GUTTER, maximumY));
    candidates.push(clamp(preferredY + distance, EDGE_GUTTER, maximumY));
  }
  return [...new Set(candidates.map(round))];
};

const horizontalCandidates = (preferredX, maximumX) => {
  const clamped = clamp(preferredX, EDGE_GUTTER, maximumX);
  const candidates = [clamped];
  for (let distance = COLLISION_STEP; distance <= maximumX + COLLISION_STEP; distance += COLLISION_STEP) {
    candidates.push(clamp(preferredX - distance, EDGE_GUTTER, maximumX));
    candidates.push(clamp(preferredX + distance, EDGE_GUTTER, maximumX));
  }
  return [...new Set(candidates.map(round))];
};

export function layoutOfficeActorOverlays(snapshots = [], {
  width = DEFAULT_SCENE_WIDTH,
  height = DEFAULT_SCENE_HEIGHT,
  avoidRects = [],
} = {}) {
  const items = snapshots.filter((snapshot) => snapshot?.visible !== false).map((snapshot) => {
    const metrics = measureOfficeOverlayText(snapshot);
    return {
      metrics,
      snapshot,
      stackHeight: metrics.stackHeight,
      stackWidth: snapshot.bubble ? BUBBLE_STACK_WIDTH : LABEL_WIDTH,
    };
  });
  const tallestStack = Math.max(1, ...items.map(({ stackHeight }) => stackHeight));
  const bounds = {
    width: Math.max(BUBBLE_WIDTH + (EDGE_GUTTER * 2), Number(width) || DEFAULT_SCENE_WIDTH),
    height: Math.max(tallestStack + (EDGE_GUTTER * 2), Number(height) || DEFAULT_SCENE_HEIGHT),
  };

  const finishLayout = (item, rectangles) => {
    const actorHeadY = Number.isFinite(item.snapshot.headScreenY)
      ? item.snapshot.headScreenY
      : item.snapshot.screenY;
    const baselineLabelY = clamp(
      actorHeadY - item.metrics.labelHeight - HEAD_GAP,
      EDGE_GUTTER,
      bounds.height - item.metrics.labelHeight - EDGE_GUTTER,
    );
    return {
      slotId: item.snapshot.slotId,
      offsetY: round(rectangles.labelRect.y - baselineLabelY),
      labelRect: rectangles.labelRect,
      statusRect: rectangles.statusRect,
      bubbleRect: rectangles.bubbleRect,
      bubbleHeight: item.metrics.bubbleHeight,
      nameHeight: item.metrics.nameHeight,
      statusHeight: item.metrics.statusHeight,
    };
  };

  const staticObstacles = avoidRects.filter((rectangle) => (
    Number.isFinite(rectangle?.x) && Number.isFinite(rectangle?.y)
    && Number.isFinite(rectangle?.width) && rectangle.width > 0
    && Number.isFinite(rectangle?.height) && rectangle.height > 0
  ));
  const candidateSets = items.map((item, itemIndex) => {
    const { snapshot, stackHeight, stackWidth } = item;
    const maximumX = bounds.width - stackWidth - EDGE_GUTTER;
    const sceneMaximumY = bounds.height - stackHeight - EDGE_GUTTER;
    const maximumY = Number.isFinite(snapshot.headScreenY)
      ? Math.min(sceneMaximumY, snapshot.headScreenY - stackHeight - HEAD_GAP)
      : sceneMaximumY;
    if (maximumY < EDGE_GUTTER) return { item, itemIndex, candidates: [] };
    const preferredX = snapshot.screenX - (snapshot.bubble ? BUBBLE_WIDTH / 2 : LABEL_WIDTH / 2);
    const preferredY = (Number.isFinite(snapshot.headScreenY) ? snapshot.headScreenY : snapshot.screenY)
      - stackHeight - HEAD_GAP;
    const xCandidates = horizontalCandidates(preferredX, maximumX);
    const maximumVerticalDrift = snapshot.bubble && Number.isFinite(snapshot.headScreenY)
      ? MAX_BUBBLE_VERTICAL_DRIFT
      : MAX_HEAD_STACK_DRIFT;
    const yCandidates = verticalCandidates(preferredY, maximumY).filter((y) => (
      y >= preferredY - maximumVerticalDrift
    ));
    const preferredLabelY = clamp(
      (Number.isFinite(snapshot.headScreenY) ? snapshot.headScreenY : snapshot.screenY)
        - item.metrics.labelHeight - HEAD_GAP,
      EDGE_GUTTER,
      bounds.height - item.metrics.labelHeight - EDGE_GUTTER,
    );
    const labelYCandidates = snapshot.bubble && Number.isFinite(snapshot.headScreenY)
      ? verticalCandidates(preferredLabelY, preferredLabelY).filter((y) => (
        y >= preferredLabelY - MAX_HEAD_STACK_DRIFT
      ))
      : [null];
    const candidates = [];
    for (const x of xCandidates) {
      for (const y of yCandidates) {
        for (const labelY of labelYCandidates) {
          const candidate = makeRects(snapshot, item.metrics, x, y, bounds.width, labelY);
          const nameCenterX = candidate.labelRect.x + (LABEL_WIDTH / 2);
          const edgeClampedName = snapshot.screenX < EDGE_GUTTER + (LABEL_WIDTH / 2)
            || snapshot.screenX > bounds.width - EDGE_GUTTER - (LABEL_WIDTH / 2);
          if (!edgeClampedName && Math.abs(nameCenterX - snapshot.screenX) > MAX_NAME_DRIFT) continue;
          let bubbleDrift = 0;
          if (snapshot.bubble) {
            const bubbleCenterX = candidate.bubbleRect.x + (candidate.bubbleRect.width / 2);
            bubbleDrift = Math.abs(bubbleCenterX - snapshot.screenX);
            if (bubbleDrift > MAX_BUBBLE_DRIFT) continue;
          }
          for (const statusCandidate of makeStatusCandidates(snapshot, item.metrics, candidate.labelRect, bounds)) {
            const rectangles = { ...candidate, statusRect: statusCandidate.rectangle };
            const candidateRects = [rectangles.labelRect, rectangles.statusRect, rectangles.bubbleRect].filter(Boolean);
            if (candidateRects.some((rectangle) => staticObstacles.some((placed) => intersects(rectangle, placed)))) continue;
            if (candidateRects.some((rectangle, index) => (
              candidateRects.slice(index + 1).some((other) => intersects(rectangle, other))
            ))) continue;
            candidates.push({
              rectangles,
              score: Math.abs(nameCenterX - snapshot.screenX)
                + (Math.abs(y - preferredY) * 0.72)
                + (Math.abs((labelY ?? preferredLabelY) - preferredLabelY) * 0.82)
                + (bubbleDrift * 0.12)
                + statusCandidate.penalty,
            });
          }
        }
      }
    }
    candidates.sort((left, right) => left.score - right.score
      || left.rectangles.labelRect.y - right.rectangles.labelRect.y
      || left.rectangles.labelRect.x - right.rectangles.labelRect.x);
    return { item, itemIndex, candidates: candidates.slice(0, 25_000) };
  });

  const searchOrder = [...candidateSets].sort((left, right) => (
    Number(Boolean(right.item.snapshot.bubble)) - Number(Boolean(left.item.snapshot.bubble))
    || left.candidates.length - right.candidates.length
    || left.itemIndex - right.itemIndex
  ));
  const greedySelected = new Map();
  const greedyPlaced = [];
  const greedyOrder = [...candidateSets].sort((left, right) => (
    (Number(left.item.snapshot.headScreenY) || 0) - (Number(right.item.snapshot.headScreenY) || 0)
    || Number(Boolean(right.item.snapshot.bubble)) - Number(Boolean(left.item.snapshot.bubble))
    || left.item.snapshot.screenX - right.item.snapshot.screenX
  ));
  for (const entry of greedyOrder) {
    const candidate = entry.candidates.find(({ rectangles }) => (
      [rectangles.labelRect, rectangles.statusRect, rectangles.bubbleRect].filter(Boolean)
        .every((rectangle) => greedyPlaced.every((other) => !intersects(rectangle, other)))
    ));
    if (!candidate) {
      greedySelected.clear();
      break;
    }
    greedySelected.set(entry.itemIndex, candidate.rectangles);
    greedyPlaced.push(candidate.rectangles.labelRect);
    greedyPlaced.push(candidate.rectangles.statusRect);
    if (candidate.rectangles.bubbleRect) greedyPlaced.push(candidate.rectangles.bubbleRect);
  }
  if (greedySelected.size === items.length) {
    return items.map((item, index) => finishLayout(item, greedySelected.get(index)));
  }

  const selected = new Map();
  const placed = [];
  let searchNodes = 0;
  const solve = (index) => {
    if (index === searchOrder.length) return true;
    if (searchNodes > 120_000) return false;
    const entry = searchOrder[index];
    for (const candidate of entry.candidates) {
      searchNodes += 1;
      const rectangles = [candidate.rectangles.labelRect, candidate.rectangles.statusRect, candidate.rectangles.bubbleRect].filter(Boolean);
      if (rectangles.some((rectangle) => placed.some((other) => intersects(rectangle, other)))) continue;
      selected.set(entry.itemIndex, candidate.rectangles);
      placed.push(...rectangles);
      if (solve(index + 1)) return true;
      placed.splice(placed.length - rectangles.length, rectangles.length);
      selected.delete(entry.itemIndex);
    }
    return false;
  };
  if (solve(0)) return items.map((item, index) => finishLayout(item, selected.get(index)));

  const bestEffortSelected = new Map();
  const bestEffortPlaced = [];
  for (const entry of greedyOrder) {
    const candidate = entry.candidates.find(({ rectangles }) => (
      [rectangles.labelRect, rectangles.statusRect, rectangles.bubbleRect].filter(Boolean)
        .every((rectangle) => bestEffortPlaced.every((other) => !intersects(rectangle, other)))
    ));
    if (!candidate) continue;
    bestEffortSelected.set(entry.itemIndex, candidate.rectangles);
    bestEffortPlaced.push(candidate.rectangles.labelRect, candidate.rectangles.statusRect);
    if (candidate.rectangles.bubbleRect) bestEffortPlaced.push(candidate.rectangles.bubbleRect);
  }

  return items.map((item, itemIndex) => {
    if (bestEffortSelected.has(itemIndex)) return finishLayout(item, bestEffortSelected.get(itemIndex));
    const stackX = clamp(item.snapshot.screenX - (item.snapshot.bubble ? BUBBLE_WIDTH / 2 : LABEL_WIDTH / 2), EDGE_GUTTER,
      bounds.width - item.stackWidth - EDGE_GUTTER);
    const actorHeadY = Number.isFinite(item.snapshot.headScreenY)
      ? item.snapshot.headScreenY
      : item.snapshot.screenY;
    const stackY = clamp(actorHeadY - item.stackHeight - HEAD_GAP, EDGE_GUTTER,
      bounds.height - item.stackHeight - EDGE_GUTTER);
    const rectangles = makeRects(item.snapshot, item.metrics, stackX, stackY, bounds.width);
    const statusRect = makeStatusCandidates(item.snapshot, item.metrics, rectangles.labelRect, bounds)[0]?.rectangle || {
      x: rectangles.labelRect.x,
      y: rectangles.labelRect.y,
      width: STATUS_WIDTH,
      height: item.metrics.statusHeight,
    };
    return finishLayout(item, { ...rectangles, statusRect });
  });
}

const isValidOverlayRect = (rectangle) => (
  Number.isFinite(rectangle?.x) && Number.isFinite(rectangle?.y)
  && Number.isFinite(rectangle?.width) && rectangle.width > 0
  && Number.isFinite(rectangle?.height) && rectangle.height > 0
);

const layoutRectangles = (layout) => (
  [layout?.labelRect, layout?.statusRect, layout?.bubbleRect].filter(Boolean)
);

export function layoutMovingOfficeActorOverlays(snapshots = [], {
  width = DEFAULT_SCENE_WIDTH,
  height = DEFAULT_SCENE_HEIGHT,
  avoidRects = [],
} = {}) {
  const bounds = {
    width: Math.max(LABEL_WIDTH + (EDGE_GUTTER * 2), Number(width) || DEFAULT_SCENE_WIDTH),
    height: Math.max(NAME_MIN_HEIGHT + (EDGE_GUTTER * 2), Number(height) || DEFAULT_SCENE_HEIGHT),
  };
  const placed = avoidRects.filter(isValidOverlayRect).map((rectangle) => ({ ...rectangle }));
  const horizontalOffsets = [0];
  for (let distance = COLLISION_STEP; distance <= MAX_NAME_DRIFT; distance += COLLISION_STEP) {
    horizontalOffsets.push(-distance, distance);
  }
  const verticalOffsets = [0];
  for (let distance = COLLISION_STEP; distance <= MAX_HEAD_STACK_DRIFT; distance += COLLISION_STEP) {
    verticalOffsets.push(-distance);
  }

  return snapshots.filter((snapshot) => snapshot?.visible !== false).map((snapshot) => {
    const metrics = measureOfficeOverlayText({ ...snapshot, bubble: "" });
    const preferredX = clamp(snapshot.screenX - (LABEL_WIDTH / 2), EDGE_GUTTER,
      bounds.width - LABEL_WIDTH - EDGE_GUTTER);
    const actorHeadY = Number.isFinite(snapshot.headScreenY) ? snapshot.headScreenY : snapshot.screenY;
    const preferredY = clamp(actorHeadY - metrics.labelHeight - HEAD_GAP, EDGE_GUTTER,
      bounds.height - metrics.labelHeight - EDGE_GUTTER);
    let selected = null;

    for (const offsetY of verticalOffsets) {
      for (const offsetX of horizontalOffsets) {
        const labelRect = {
          x: round(clamp(preferredX + offsetX, EDGE_GUTTER, bounds.width - LABEL_WIDTH - EDGE_GUTTER)),
          y: round(clamp(preferredY + offsetY, EDGE_GUTTER, bounds.height - metrics.labelHeight - EDGE_GUTTER)),
          width: LABEL_WIDTH,
          height: metrics.labelHeight,
        };
        const nameCenterX = labelRect.x + (LABEL_WIDTH / 2);
        if (Math.abs(nameCenterX - snapshot.screenX) > MAX_NAME_DRIFT) continue;
        for (const statusCandidate of makeStatusCandidates(snapshot, metrics, labelRect, bounds)) {
          const rectangles = [labelRect, statusCandidate.rectangle];
          if (rectangles.some((rectangle, index) => (
            placed.some((other) => intersects(rectangle, other))
            || rectangles.slice(index + 1).some((other) => intersects(rectangle, other))
          ))) continue;
          selected = { labelRect, statusRect: statusCandidate.rectangle, bubbleRect: null };
          break;
        }
        if (selected) break;
      }
      if (selected) break;
    }

    if (!selected) {
      const labelRect = {
        x: round(preferredX),
        y: round(preferredY),
        width: LABEL_WIDTH,
        height: metrics.labelHeight,
      };
      selected = {
        labelRect,
        statusRect: makeStatusCandidates(snapshot, metrics, labelRect, bounds)[0]?.rectangle || {
          x: labelRect.x,
          y: labelRect.y,
          width: STATUS_WIDTH,
          height: metrics.statusHeight,
        },
        bubbleRect: null,
      };
    }
    placed.push(...layoutRectangles(selected));
    return {
      slotId: snapshot.slotId,
      offsetY: round(selected.labelRect.y - preferredY),
      ...selected,
      bubbleHeight: 0,
      nameHeight: metrics.nameHeight,
      statusHeight: metrics.statusHeight,
    };
  });
}

export function adjustStationaryOfficeOverlaysForMovingBodies(layouts = [], snapshots = [], {
  width = DEFAULT_SCENE_WIDTH,
  height = DEFAULT_SCENE_HEIGHT,
  avoidRects = [],
  movingBodyRects = [],
} = {}) {
  const movingBodies = movingBodyRects.filter(isValidOverlayRect);
  if (!movingBodies.length) return layouts;
  const bounds = {
    width: Math.max(LABEL_WIDTH + (EDGE_GUTTER * 2), Number(width) || DEFAULT_SCENE_WIDTH),
    height: Math.max(NAME_MIN_HEIGHT + (EDGE_GUTTER * 2), Number(height) || DEFAULT_SCENE_HEIGHT),
  };
  const snapshotBySlot = new Map(snapshots.map((snapshot) => [snapshot.slotId, snapshot]));
  const affectedSlotIds = new Set(layouts.filter((layout) => (
    layoutRectangles(layout).some((rectangle) => movingBodies.some((body) => intersects(rectangle, body)))
  )).map(({ slotId }) => slotId));
  if (!affectedSlotIds.size) return layouts;

  const placed = avoidRects.filter(isValidOverlayRect).map((rectangle) => ({ ...rectangle }));
  for (const layout of layouts) {
    if (!affectedSlotIds.has(layout.slotId)) placed.push(...layoutRectangles(layout));
  }
  const horizontalOffsets = [0];
  for (let distance = COLLISION_STEP; distance <= MAX_NAME_DRIFT; distance += COLLISION_STEP) {
    horizontalOffsets.push(-distance, distance);
  }
  const verticalOffsets = [0];
  for (let distance = COLLISION_STEP; distance <= MAX_HEAD_STACK_DRIFT; distance += COLLISION_STEP) {
    verticalOffsets.push(-distance);
  }

  return layouts.map((layout) => {
    if (!affectedSlotIds.has(layout.slotId)) return layout;
    const snapshot = snapshotBySlot.get(layout.slotId);
    if (!snapshot) return layout;
    const headY = Number.isFinite(snapshot.headScreenY) ? snapshot.headScreenY : snapshot.screenY;
    let selected = null;
    for (const offsetY of verticalOffsets) {
      for (const offsetX of horizontalOffsets) {
        const translated = Object.fromEntries(["labelRect", "statusRect", "bubbleRect"].map((key) => {
          const rectangle = layout[key];
          return [key, rectangle ? {
            ...rectangle,
            x: round(rectangle.x + offsetX),
            y: round(rectangle.y + offsetY),
          } : null];
        }));
        const rectangles = layoutRectangles(translated);
        const labelCenterX = translated.labelRect.x + (translated.labelRect.width / 2);
        const proximityValid = Math.abs(labelCenterX - snapshot.screenX) <= MAX_NAME_DRIFT
          && rectangles.every((rectangle) => (
            rectangle.x >= EDGE_GUTTER
            && rectangle.y >= EDGE_GUTTER
            && rectangle.x + rectangle.width <= bounds.width - EDGE_GUTTER
            && rectangle.y + rectangle.height <= bounds.height - EDGE_GUTTER
          ))
          && translated.labelRect.y + translated.labelRect.height <= headY - 4
          && translated.labelRect.y + translated.labelRect.height >= headY - MAX_STATUS_HEAD_GAP
          && translated.statusRect.y + translated.statusRect.height <= headY - 4
          && translated.statusRect.y + translated.statusRect.height >= headY - MAX_STATUS_HEAD_GAP
          && (!translated.bubbleRect
            || (translated.bubbleRect.y + translated.bubbleRect.height <= headY - 4
              && translated.bubbleRect.y + translated.bubbleRect.height >= headY - 90));
        if (!proximityValid || rectangles.some((rectangle, index) => (
          placed.some((other) => intersects(rectangle, other))
          || rectangles.slice(index + 1).some((other) => intersects(rectangle, other))
        ))) continue;
        selected = { ...layout, ...translated, offsetY: round(layout.offsetY + offsetY) };
        break;
      }
      if (selected) break;
    }
    const resolved = selected || layout;
    placed.push(...layoutRectangles(resolved));
    return resolved;
  });
}

export function partitionOfficeOverlayInputs(snapshots = [], avoidRects = [], width, height) {
  const visibleSnapshots = snapshots.filter(({ visible }) => visible);
  const movingSnapshots = visibleSnapshots.filter((snapshot) => snapshot.moving && !snapshot.bubble);
  const movingSlotIds = new Set(movingSnapshots.map(({ slotId }) => slotId));
  const stationarySnapshots = visibleSnapshots.filter((snapshot) => !movingSlotIds.has(snapshot.slotId));
  const movingBodyRects = avoidRects.filter((rectangle) => {
    const bodySlotId = cleanText(rectangle?.id).match(/^(.*):body$/u)?.[1];
    return bodySlotId && movingSlotIds.has(bodySlotId);
  });
  const stationaryAvoidRects = avoidRects.filter((rectangle) => !movingBodyRects.includes(rectangle));
  return {
    movingSnapshots,
    movingBodyRects,
    stationarySnapshots,
    stationaryAvoidRects,
    stationarySignature: buildOfficeOverlayLayoutSignature(
      stationarySnapshots,
      stationaryAvoidRects,
      width,
      height,
    ),
  };
}

export function buildOfficeOverlayLayoutSignature(snapshots = [], avoidRects = [], width, height) {
  return JSON.stringify({
    width: Number(width) || 0,
    height: Number(height) || 0,
    snapshots: snapshots.map((snapshot) => [
      snapshot?.slotId || "",
      snapshot?.visible !== false,
      Number(snapshot?.screenX) || 0,
      Number(snapshot?.screenY) || 0,
      Number(snapshot?.headScreenY) || 0,
      cleanText(snapshot?.name),
      cleanText(snapshot?.status),
      cleanText(snapshot?.bubble),
    ]),
    obstacles: avoidRects.map((rectangle) => [
      Number(rectangle?.x) || 0,
      Number(rectangle?.y) || 0,
      Number(rectangle?.width) || 0,
      Number(rectangle?.height) || 0,
    ]),
  });
}

export function restoreOfficeDoorFocus(button, schedule = (callback) => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}) {
  if (!button || typeof button.focus !== "function" || typeof schedule !== "function") return false;
  schedule(() => button.focus({ preventScroll: true }));
  return true;
}

export function OfficeActorOverlay({
  snapshots = [],
  sceneId = "office",
  sceneWidth = DEFAULT_SCENE_WIDTH,
  sceneHeight = DEFAULT_SCENE_HEIGHT,
  avoidRects = [],
  doorPoint = null,
  onActorSelect,
  onSceneChange,
  rendererError = null,
}) {
  const doorRef = useRef(null);
  const partition = partitionOfficeOverlayInputs(
    snapshots,
    avoidRects,
    sceneWidth,
    sceneHeight,
  );
  const stationaryLayouts = useMemo(() => layoutOfficeActorOverlays(partition.stationarySnapshots, {
    width: sceneWidth,
    height: sceneHeight,
    avoidRects: partition.stationaryAvoidRects,
  }), [partition.stationarySignature]);
  const adjustedStationaryLayouts = adjustStationaryOfficeOverlaysForMovingBodies(
    stationaryLayouts,
    partition.stationarySnapshots,
    {
      width: sceneWidth,
      height: sceneHeight,
      avoidRects,
      movingBodyRects: partition.movingBodyRects,
    },
  );
  const movingAvoidRects = [
    ...avoidRects,
    ...adjustedStationaryLayouts.flatMap(layoutRectangles),
  ];
  const movingLayouts = layoutMovingOfficeActorOverlays(partition.movingSnapshots, {
    width: sceneWidth,
    height: sceneHeight,
    avoidRects: movingAvoidRects,
  });
  const layouts = new Map([...adjustedStationaryLayouts, ...movingLayouts].map((layout) => [layout.slotId, layout]));
  const doorLabel = sceneId === "lounge" ? "返回办公室" : "进入休息区";

  const handleSceneChange = () => {
    onSceneChange?.();
    restoreOfficeDoorFocus(doorRef.current);
  };

  return (
    <div className="office-scene-overlay" aria-live="polite">
      {snapshots.map((snapshot) => {
        const layout = layouts.get(snapshot.slotId);
        const metrics = layout || measureOfficeOverlayText(snapshot);
        const labelCenterX = layout
          ? layout.labelRect.x + (layout.labelRect.width / 2)
          : snapshot.screenX;
        const bubbleCenterX = layout?.bubbleRect
          ? layout.bubbleRect.x + (layout.bubbleRect.width / 2)
          : labelCenterX;
        const statusCenterX = layout?.statusRect
          ? layout.statusRect.x + (layout.statusRect.width / 2)
          : labelCenterX;
        return (
          <button
            key={snapshot.slotId}
            type="button"
            className="office-actor-overlay"
            data-office-actor-overlay={snapshot.slotId}
            data-facing={snapshot.facing}
            data-world-x={snapshot.worldX}
            data-world-y={snapshot.worldY}
            data-screen-x={snapshot.screenX}
            data-screen-y={snapshot.screenY}
            data-head-screen-y={snapshot.headScreenY}
            data-scene-id={snapshot.sceneId}
            data-motion-clip={snapshot.clip}
            data-motion-frame={snapshot.frameIndex}
            data-moving={snapshot.moving ? "true" : "false"}
            hidden={!snapshot.visible}
            style={{
              left: `${labelCenterX}px`,
              top: `${layout?.labelRect?.y ?? snapshot.screenY}px`,
              "--office-bubble-shift-x": `${bubbleCenterX - labelCenterX}px`,
              "--office-bubble-shift-y": `${(layout?.bubbleRect?.y ?? 0) - (layout?.labelRect?.y ?? 0)}px`,
              "--office-status-shift-x": `${statusCenterX - labelCenterX}px`,
              "--office-status-shift-y": `${(layout?.statusRect?.y ?? 0) - (layout?.labelRect?.y ?? 0)}px`,
              "--office-bubble-height": `${metrics.bubbleHeight}px`,
              "--office-name-height": `${metrics.nameHeight}px`,
              "--office-status-height": `${metrics.statusHeight}px`,
            }}
            aria-label={`${snapshot.name}，${snapshot.status}`}
            onClick={() => onActorSelect?.(snapshot.slotId)}
          >
            {snapshot.bubble && <span className="office-actor-bubble">{snapshot.bubble}</span>}
            <span className="office-actor-label">
              <span className="office-actor-name">{snapshot.name}</span>
            </span>
            <span className="office-actor-status">{snapshot.status}</span>
          </button>
        );
      })}
      <button
        ref={doorRef}
        type="button"
        className="office-door-control"
        data-scene={sceneId}
        data-door-screen-x={doorPoint?.x}
        data-door-screen-y={doorPoint?.y}
        style={doorPoint ? { left: `${doorPoint.x}px`, top: `${doorPoint.y}px` } : undefined}
        aria-label={doorLabel}
        title={doorLabel}
        onClick={handleSceneChange}
      >
        <DoorOpen size={21} strokeWidth={1.8} data-lucide="door-open" aria-hidden="true" />
      </button>
      {rendererError && <p className="office-renderer-error" role="alert">场景暂时无法加载</p>}
    </div>
  );
}

export default OfficeActorOverlay;
