import { useMemo, useRef } from "react";
import { DoorOpen } from "lucide-react";

const DEFAULT_SCENE_WIDTH = 390;
const DEFAULT_SCENE_HEIGHT = 712;
const LABEL_WIDTH = 112;
const BUBBLE_WIDTH = 180;
const BUBBLE_MIN_HEIGHT = 48;
const NAME_MIN_HEIGHT = 21;
const STATUS_MIN_HEIGHT = 19;
const STACK_GAP = 5;
const LABEL_GAP = 2;
const EDGE_GUTTER = 6;
const COLLISION_STEP = 8;
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
    lineUnits: 8.5,
    lineHeight: 12.65,
    minimumHeight: NAME_MIN_HEIGHT,
    verticalChrome: 8,
  });
  const statusHeight = measureTextBox(snapshot.status || IDLE_STATUS, {
    lineUnits: 9,
    lineHeight: 11,
    minimumHeight: STATUS_MIN_HEIGHT,
    verticalChrome: 8,
  });
  const bubbleHeight = bubble ? measureTextBox(bubble, {
    lineUnits: 13,
    lineHeight: 14.3,
    minimumHeight: BUBBLE_MIN_HEIGHT,
    verticalChrome: 14,
  }) : 0;
  const labelHeight = nameHeight + LABEL_GAP + statusHeight;
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

const intersects = (left, right) => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

const makeRects = (snapshot, metrics, stackX, stackY) => {
  if (!snapshot.bubble) {
    return {
      labelRect: { x: round(stackX), y: round(stackY), width: LABEL_WIDTH, height: metrics.labelHeight },
      bubbleRect: null,
    };
  }
  return {
    labelRect: {
      x: round(stackX + ((BUBBLE_WIDTH - LABEL_WIDTH) / 2)),
      y: round(stackY + metrics.bubbleHeight + STACK_GAP),
      width: LABEL_WIDTH,
      height: metrics.labelHeight,
    },
    bubbleRect: { x: round(stackX), y: round(stackY), width: BUBBLE_WIDTH, height: metrics.bubbleHeight },
  };
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
} = {}) {
  const items = snapshots.filter((snapshot) => snapshot?.visible !== false).map((snapshot) => {
    const metrics = measureOfficeOverlayText(snapshot);
    return {
      metrics,
      snapshot,
      stackHeight: metrics.stackHeight,
      stackWidth: snapshot.bubble ? BUBBLE_WIDTH : LABEL_WIDTH,
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
      bubbleRect: rectangles.bubbleRect,
      bubbleHeight: item.metrics.bubbleHeight,
      nameHeight: item.metrics.nameHeight,
      statusHeight: item.metrics.statusHeight,
    };
  };

  const occupied = [];
  const greedyLayouts = [];
  for (const item of items) {
    const { snapshot, stackHeight, stackWidth } = item;
    const maximumX = bounds.width - stackWidth - EDGE_GUTTER;
    const sceneMaximumY = bounds.height - stackHeight - EDGE_GUTTER;
    const maximumY = Number.isFinite(snapshot.headScreenY)
      ? Math.min(sceneMaximumY, snapshot.headScreenY - stackHeight - HEAD_GAP)
      : sceneMaximumY;
    if (maximumY < EDGE_GUTTER) {
      greedyLayouts.length = 0;
      break;
    }
    const preferredX = snapshot.screenX - (stackWidth / 2);
    const preferredY = (Number.isFinite(snapshot.headScreenY) ? snapshot.headScreenY : snapshot.screenY)
      - stackHeight - HEAD_GAP;
    const xCandidates = horizontalCandidates(preferredX, maximumX);
    const yCandidates = verticalCandidates(preferredY, maximumY);
    let rectangles = null;

    for (const x of xCandidates) {
      for (const y of yCandidates) {
        const candidate = makeRects(snapshot, item.metrics, x, y);
        const candidateRects = [candidate.labelRect, candidate.bubbleRect].filter(Boolean);
        if (!candidateRects.some((rectangle) => occupied.some((placed) => intersects(rectangle, placed)))) {
          rectangles = candidate;
          break;
        }
      }
      if (rectangles) break;
    }
    if (!rectangles) {
      greedyLayouts.length = 0;
      break;
    }
    occupied.push(rectangles.labelRect);
    if (rectangles.bubbleRect) occupied.push(rectangles.bubbleRect);
    greedyLayouts.push(finishLayout(item, rectangles));
  }
  if (greedyLayouts.length === items.length) return greedyLayouts;

  const laneWidth = Math.max(...items.map(({ stackWidth }) => stackWidth), LABEL_WIDTH);
  const availableWidth = bounds.width - (EDGE_GUTTER * 2);
  const columnCount = Math.max(1, Math.min(
    items.length,
    Math.floor((availableWidth + STACK_GAP) / (laneWidth + STACK_GAP)),
  ));
  const lastLaneX = bounds.width - EDGE_GUTTER - laneWidth;
  const laneXs = Array.from({ length: columnCount }, (_, index) => (
    columnCount === 1
      ? clamp((bounds.width - laneWidth) / 2, EDGE_GUTTER, lastLaneX)
      : EDGE_GUTTER + ((lastLaneX - EDGE_GUTTER) * index) / (columnCount - 1)
  ));
  const columnHeights = Array.from({ length: columnCount }, () => EDGE_GUTTER);
  return items.map((item) => {
    const orderedColumns = Array.from({ length: columnCount }, (_, index) => index).sort((left, right) => (
      columnHeights[left] - columnHeights[right]
      || Math.abs((laneXs[left] + (laneWidth / 2)) - item.snapshot.screenX)
        - Math.abs((laneXs[right] + (laneWidth / 2)) - item.snapshot.screenX)
      || left - right
    ));
    const column = orderedColumns.find((index) => (
      columnHeights[index] + item.stackHeight <= bounds.height - EDGE_GUTTER
    )) ?? orderedColumns[0];
    const x = laneXs[column] + ((laneWidth - item.stackWidth) / 2);
    const y = clamp(columnHeights[column], EDGE_GUTTER, bounds.height - item.stackHeight - EDGE_GUTTER);
    const rectangles = makeRects(item.snapshot, item.metrics, x, y);
    columnHeights[column] = y + item.stackHeight + STACK_GAP;
    return finishLayout(item, rectangles);
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
  onActorSelect,
  onSceneChange,
  rendererError = null,
}) {
  const doorRef = useRef(null);
  const visibleSnapshots = snapshots.filter(({ visible }) => visible);
  const layouts = useMemo(() => new Map(layoutOfficeActorOverlays(visibleSnapshots, {
    width: sceneWidth,
    height: sceneHeight,
  }).map((layout) => [layout.slotId, layout])), [visibleSnapshots, sceneWidth, sceneHeight]);
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
        return (
          <button
            key={snapshot.slotId}
            type="button"
            className="office-actor-overlay"
            data-office-actor-overlay={snapshot.slotId}
            data-facing={snapshot.facing}
            data-world-x={snapshot.worldX}
            data-world-y={snapshot.worldY}
            data-head-screen-y={snapshot.headScreenY}
            data-motion-clip={snapshot.clip}
            data-motion-frame={snapshot.frameIndex}
            data-moving={snapshot.moving ? "true" : "false"}
            hidden={!snapshot.visible}
            style={{
              left: `${labelCenterX}px`,
              top: `${layout?.bubbleRect?.y ?? layout?.labelRect?.y ?? snapshot.screenY}px`,
              "--office-bubble-shift": `${bubbleCenterX - labelCenterX}px`,
              "--office-bubble-height": `${metrics.bubbleHeight}px`,
              "--office-name-height": `${metrics.nameHeight}px`,
              "--office-status-height": `${metrics.statusHeight}px`,
            }}
            aria-label={`${snapshot.name}，${snapshot.status}`}
            onClick={() => onActorSelect?.(snapshot.slotId)}
          >
            {snapshot.bubble && <span className="office-actor-bubble">{snapshot.bubble}</span>}
            <span className="office-actor-name">{snapshot.name}</span>
            <span className="office-actor-status">{snapshot.status}</span>
          </button>
        );
      })}
      <button
        ref={doorRef}
        type="button"
        className="office-door-control"
        data-scene={sceneId}
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
