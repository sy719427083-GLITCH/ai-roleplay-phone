import { useMemo, useRef } from "react";
import { DoorOpen } from "lucide-react";

const DEFAULT_SCENE_WIDTH = 390;
const DEFAULT_SCENE_HEIGHT = 712;
const LABEL_WIDTH = 112;
const LABEL_HEIGHT = 38;
const BUBBLE_WIDTH = 180;
const BUBBLE_HEIGHT = 48;
const STACK_GAP = 5;
const EDGE_GUTTER = 6;
const COLLISION_STEP = 8;
const IDLE_STATUS = "空闲中";

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const round = (value) => Math.round(value * 10) / 10;

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
    return {
      slotId,
      visible: cleanText(actor?.sceneId) === visibleSceneId,
      screenX: round(Number(point?.x) || 0),
      screenY: round(Number(point?.y) || 0),
      name: cleanText(actor?.profile?.name) || cleanText(character.profile?.name) || "NPC",
      status: cleanText(actor?.status) || cleanText(character.status) || IDLE_STATUS,
      bubble: cleanText(activeBubble?.speakerId) === slotId ? cleanText(activeBubble?.text) : "",
      facing: cleanText(actor?.facing) || cleanText(character.facing) || "front",
      sceneId: cleanText(actor?.sceneId) || "office",
    };
  });
}

const intersects = (left, right) => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

const makeRects = (snapshot, stackX, stackY) => {
  if (!snapshot.bubble) {
    return {
      labelRect: { x: round(stackX), y: round(stackY), width: LABEL_WIDTH, height: LABEL_HEIGHT },
      bubbleRect: null,
    };
  }
  return {
    labelRect: {
      x: round(stackX + ((BUBBLE_WIDTH - LABEL_WIDTH) / 2)),
      y: round(stackY + BUBBLE_HEIGHT + STACK_GAP),
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT,
    },
    bubbleRect: { x: round(stackX), y: round(stackY), width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT },
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
  const bounds = {
    width: Math.max(BUBBLE_WIDTH + (EDGE_GUTTER * 2), Number(width) || DEFAULT_SCENE_WIDTH),
    height: Math.max(BUBBLE_HEIGHT + LABEL_HEIGHT + (EDGE_GUTTER * 2), Number(height) || DEFAULT_SCENE_HEIGHT),
  };
  const occupied = [];
  return snapshots.filter((snapshot) => snapshot?.visible !== false).map((snapshot) => {
    const stackWidth = snapshot.bubble ? BUBBLE_WIDTH : LABEL_WIDTH;
    const stackHeight = snapshot.bubble
      ? BUBBLE_HEIGHT + STACK_GAP + LABEL_HEIGHT
      : LABEL_HEIGHT;
    const maximumX = bounds.width - stackWidth - EDGE_GUTTER;
    const maximumY = bounds.height - stackHeight - EDGE_GUTTER;
    const preferredX = snapshot.screenX - (stackWidth / 2);
    const preferredY = snapshot.screenY - stackHeight - 12;
    const xCandidates = horizontalCandidates(preferredX, maximumX);
    const yCandidates = verticalCandidates(preferredY, maximumY);
    let rectangles = null;

    for (const x of xCandidates) {
      for (const y of yCandidates) {
        const candidate = makeRects(snapshot, x, y);
        const candidateRects = [candidate.labelRect, candidate.bubbleRect].filter(Boolean);
        if (!candidateRects.some((rectangle) => occupied.some((placed) => intersects(rectangle, placed)))) {
          rectangles = candidate;
          break;
        }
      }
      if (rectangles) break;
    }
    rectangles ||= makeRects(snapshot, xCandidates[0], yCandidates[0]);
    occupied.push(rectangles.labelRect);
    if (rectangles.bubbleRect) occupied.push(rectangles.bubbleRect);
    const baselineLabelY = clamp(
      snapshot.screenY - LABEL_HEIGHT - 12,
      EDGE_GUTTER,
      bounds.height - LABEL_HEIGHT - EDGE_GUTTER,
    );
    return {
      slotId: snapshot.slotId,
      offsetY: round(rectangles.labelRect.y - baselineLabelY),
      labelRect: rectangles.labelRect,
      bubbleRect: rectangles.bubbleRect,
    };
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
            hidden={!snapshot.visible}
            style={{
              left: `${labelCenterX}px`,
              top: `${layout?.bubbleRect?.y ?? layout?.labelRect?.y ?? snapshot.screenY}px`,
              "--office-bubble-shift": `${bubbleCenterX - labelCenterX}px`,
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
