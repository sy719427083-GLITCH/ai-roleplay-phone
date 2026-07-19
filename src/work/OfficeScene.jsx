import { useCallback, useMemo, useState } from "react";
import OfficeCanvas from "./pixi/OfficeCanvas.jsx";
import { getActivityDefinition } from "./officeActivityManifest.js";
import { OFFICE_SCENES, OFFICE_WORLD_SIZE } from "./officeSceneManifest.js";
import { OFFICE_CLIP_METADATA } from "./pixi/officeCharacterClips.js";
import "./office.css";

const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];
const MOVING_PHASES = new Set(["walkingToActivity", "returning"]);
const SCENE_PERCENT_TO_PHONE_PX = 3.9;
const SCENE_PHONE_WIDTH_PX = 390;
const BUBBLE_HALF_WIDTH_PX = 90;
const BUBBLE_VIEWPORT_GUTTER_PX = 12;
const FIVE_MEMBER_BUBBLE_OFFSETS_PX = [-50, -50, 0, 50, 50];

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const roundPosition = (value) => Math.round(value * 10) / 10;

export const getClampedBubbleLayout = (layout) => {
  if (!layout) return null;
  const fiveMemberOffset = layout.groupCount === 5
    ? FIVE_MEMBER_BUBBLE_OFFSETS_PX[layout.groupIndex] || 0
    : 0;
  const combinedOffset = fiveMemberOffset
    + (layout.bubbleOffsetPx || 0)
    + (layout.bubbleMemberOffsetPx || 0);
  const bubbleCenter = (layout.x * SCENE_PERCENT_TO_PHONE_PX) + combinedOffset;
  const minimumCenter = BUBBLE_VIEWPORT_GUTTER_PX + BUBBLE_HALF_WIDTH_PX;
  const maximumCenter = SCENE_PHONE_WIDTH_PX - minimumCenter;
  const clampedCenter = Math.min(maximumCenter, Math.max(minimumCenter, bubbleCenter));

  return {
    ...layout,
    bubbleOffsetPx: roundPosition(combinedOffset + clampedCenter - bubbleCenter),
    bubbleMemberOffsetPx: 0,
  };
};

const getCharacterPoint = (character) => {
  const sceneId = OFFICE_SCENES[character?.sceneId] ? character.sceneId : "office";
  const position = character?.position;
  if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
    return { sceneId, x: position.x, y: position.y, facing: character.facing || "front" };
  }
  const fallback = OFFICE_SCENES.office.anchors[`${character?.slotId}:seat-approach`]
    || OFFICE_SCENES.office.anchors.entry;
  return { sceneId: "office", x: fallback.x, y: fallback.y, facing: "front" };
};

const getActorClip = (character, slotId, moving) => {
  if (moving) return "locomotion";
  if (character.activity === "idle") return "idle-standing";
  const definition = getActivityDefinition(character.activity);
  const role = cleanText(character.propState?.actorRoles?.[slotId]) || "actor";
  return definition?.clips?.[role] || definition?.clips?.actor || "idle-standing";
};

const getClipFrameIndex = (clipId, now, startedAt) => {
  const clip = OFFICE_CLIP_METADATA[clipId] || OFFICE_CLIP_METADATA["idle-standing"];
  return Math.floor(Math.max(0, now - (Number(startedAt) || 0)) / (1000 / clip.fps)) % clip.frameCount;
};

export function buildOfficeWorld({ state = {}, assignments = {}, sampledWorldActors = {}, motionNow } = {}) {
  const characters = isRecord(state.characters) ? state.characters : {};
  const now = Number.isFinite(motionNow) ? motionNow : Number(state.now) || 0;
  const visibleSceneId = OFFICE_SCENES[state.visibleSceneId] ? state.visibleSceneId : "office";
  const actors = OFFICE_SLOT_IDS.map((slotId) => {
    const character = isRecord(characters[slotId]) ? characters[slotId] : { slotId };
    const sampled = isRecord(sampledWorldActors[slotId]) ? sampledWorldActors[slotId] : null;
    const point = sampled && OFFICE_SCENES[sampled.sceneId]
      && Number.isFinite(sampled.x) && Number.isFinite(sampled.y)
      ? sampled
      : getCharacterPoint(character);
    const moving = MOVING_PHASES.has(character.phase) && Boolean(sampled);
    const assignment = isRecord(assignments[slotId]) ? assignments[slotId] : {};
    const clip = getActorClip(character, slotId, moving);
    return {
      id: slotId,
      characterId: assignment.chibiId,
      sceneId: point.sceneId,
      x: point.x,
      y: point.y,
      facing: point.facing || character.facing || "front",
      motion: moving ? point : null,
      clip,
      frameIndex: getClipFrameIndex(clip, now, character.activityStartedAt || character.routeStartedAt),
      furnitureAnchor: null,
      status: cleanText(character.status),
      profile: isRecord(assignment.profile) ? assignment.profile : isRecord(character.profile) ? character.profile : null,
      furnitureReady: true,
    };
  });

  const activityStates = actors.map((actor) => {
    const character = characters[actor.id] || {};
    return {
      slotId: actor.id,
      sceneId: actor.sceneId,
      activity: actor.clip,
      anchorId: character.targetAnchorId || character.homeAnchorId || "",
      propState: character.propState || null,
    };
  });

  return { scenes: OFFICE_SCENES, actors, visibleSceneId, activityStates };
}

const getOverlaySnapshots = (state, world, renderer) => {
  const characters = isRecord(state.characters) ? state.characters : {};
  const conversations = isRecord(state.conversations) ? state.conversations : {};

  return world.actors.flatMap((actor) => {
    if (actor.sceneId !== world.visibleSceneId || (!actor.profile && !characters[actor.id])) return [];
    const character = isRecord(characters[actor.id]) ? characters[actor.id] : {};
    const conversation = conversations[cleanText(character.conversationId)];
    const activeBubble = conversation?.bubbleQueue?.[0];
    const bubble = cleanText(activeBubble?.speakerId) === actor.id ? cleanText(activeBubble?.text) : "";
    const point = renderer?.worldToScreen(actor);
    const position = point
      ? { left: `${point.x}px`, top: `${point.y}px` }
      : { left: `${(actor.x / OFFICE_WORLD_SIZE.width) * 100}%`, top: `${(actor.y / OFFICE_WORLD_SIZE.height) * 100}%` };
    const name = cleanText(actor.profile?.name) || cleanText(character.profile?.name) || actor.id;
    const status = cleanText(actor.status) || cleanText(character.status) || IDLE_STATUS;
    return [{ id: actor.id, activity: character.activity || "idle", name, status, bubble, position }];
  });
};

const IDLE_STATUS = "空闲中";

function OfficeActorOverlay({ snapshot, onSelect }) {
  return (
    <button
      type="button"
      className="office-actor-overlay"
      data-office-actor-overlay={snapshot.id}
      data-activity={snapshot.activity}
      style={snapshot.position}
      aria-label={`${snapshot.name}，${snapshot.status}`}
      onClick={() => onSelect?.(snapshot.id)}
    >
      {snapshot.bubble && <span className="office-actor-bubble">{snapshot.bubble}</span>}
      <span className="office-actor-name">{snapshot.name}</span>
      <span className="office-actor-status">{snapshot.status}</span>
    </button>
  );
}

export function OfficeScene({
  state = {},
  assignments = {},
  sampledWorldActors = {},
  motionNow,
  onSlotSelect,
  onStationSelect,
}) {
  const [renderer, setRenderer] = useState(null);
  const [rendererError, setRendererError] = useState(null);
  const [, setOverlayRevision] = useState(0);
  const world = useMemo(
    () => buildOfficeWorld({ state, assignments, sampledWorldActors, motionNow }),
    [state, assignments, sampledWorldActors, motionNow],
  );
  const onFrame = useCallback(() => setOverlayRevision((revision) => revision + 1), []);
  const onReady = useCallback((nextRenderer) => {
    setRenderer(nextRenderer);
    setRendererError(null);
  }, []);
  const overlaySnapshots = getOverlaySnapshots(state, world, renderer);

  return (
    <section className="office-scene" aria-label="办公室动态场景" data-character-count={overlaySnapshots.length}>
      <OfficeCanvas
        world={world}
        visibleSceneId={world.visibleSceneId}
        onFrame={onFrame}
        onDoorSelect={onStationSelect}
        onActorSelect={onSlotSelect}
        onReady={onReady}
        onError={setRendererError}
      />
      <div className="office-scene-overlay" aria-live="polite">
        {overlaySnapshots.map((snapshot) => <OfficeActorOverlay key={snapshot.id} snapshot={snapshot} onSelect={onSlotSelect} />)}
        {rendererError && <p className="office-renderer-error" role="alert">场景暂时无法加载</p>}
      </div>
    </section>
  );
}

export default OfficeScene;
