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

const makeRects = (snapshot, offsetY, bounds) => {
  const labelX = clamp(snapshot.screenX - (LABEL_WIDTH / 2), EDGE_GUTTER, bounds.width - LABEL_WIDTH - EDGE_GUTTER);
  const labelY = clamp(snapshot.screenY - LABEL_HEIGHT - 12 + offsetY, EDGE_GUTTER, bounds.height - LABEL_HEIGHT - EDGE_GUTTER);
  const labelRect = { x: round(labelX), y: round(labelY), width: LABEL_WIDTH, height: LABEL_HEIGHT };
  if (!snapshot.bubble) return { labelRect, bubbleRect: null };
  const bubbleX = clamp(snapshot.screenX - (BUBBLE_WIDTH / 2), EDGE_GUTTER, bounds.width - BUBBLE_WIDTH - EDGE_GUTTER);
  const bubbleY = clamp(labelY - BUBBLE_HEIGHT - STACK_GAP, EDGE_GUTTER, bounds.height - BUBBLE_HEIGHT - EDGE_GUTTER);
  return {
    labelRect,
    bubbleRect: { x: round(bubbleX), y: round(bubbleY), width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT },
  };
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
    let offsetY = 0;
    let rectangles = makeRects(snapshot, offsetY, bounds);
    while (occupied.some((rectangle) => (
      intersects(rectangles.labelRect, rectangle)
      || (rectangles.bubbleRect && intersects(rectangles.bubbleRect, rectangle))
    ))) {
      const nextOffset = offsetY - COLLISION_STEP;
      const nextRectangles = makeRects(snapshot, nextOffset, bounds);
      if (nextRectangles.labelRect.y === rectangles.labelRect.y
        && nextRectangles.bubbleRect?.y === rectangles.bubbleRect?.y) break;
      offsetY = nextOffset;
      rectangles = nextRectangles;
    }
    occupied.push(rectangles.labelRect);
    if (rectangles.bubbleRect) occupied.push(rectangles.bubbleRect);
    return {
      slotId: snapshot.slotId,
      offsetY,
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
              top: `${snapshot.screenY + (layout?.offsetY || 0)}px`,
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
