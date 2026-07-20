import { useCallback, useMemo, useRef, useState } from "react";
import OfficeCanvas from "./pixi/OfficeCanvas.jsx";
import OfficeActorOverlay, { buildOfficeActorSnapshots } from "./OfficeActorOverlay.jsx";
import { getActivityDefinition } from "./officeActivityManifest.js";
import { getCustomOfficeClipSource } from "./officeAnimatedAssets.js";
import { OFFICE_SCENES } from "./officeSceneManifest.js";
import { OFFICE_CLIP_METADATA } from "./pixi/officeCharacterClips.js";
import "./office.css";

const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];
const MOVING_PHASES = new Set(["walkingToActivity", "returning"]);
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

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

const getClipFrameIndex = (clipId, now, startedAt, animationManifest, facing) => {
  const clip = getCustomOfficeClipSource(animationManifest, clipId, facing)
    || OFFICE_CLIP_METADATA[clipId]
    || OFFICE_CLIP_METADATA["idle-standing"];
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
      animationManifest: assignment.customAnimationManifest || null,
      sceneId: point.sceneId,
      x: point.x,
      y: point.y,
      facing: point.facing || character.facing || "front",
      motion: moving ? point : null,
      clip,
      frameIndex: getClipFrameIndex(
        clip,
        now,
        character.activityStartedAt || character.routeStartedAt,
        assignment.customAnimationManifest,
        point.facing || character.facing,
      ),
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

export function OfficeScene({
  state = {},
  assignments = {},
  sampledWorldActors = {},
  motionNow,
  onActorAssetError,
  onSlotSelect,
  onSceneChange,
}) {
  const sceneRef = useRef(null);
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
  const onRendererError = useCallback((error) => {
    setRendererError(error);
    if (error?.context?.kind === "actor") onActorAssetError?.(error.context.actorId);
  }, [onActorAssetError]);
  const overlaySnapshots = buildOfficeActorSnapshots({ state, world, renderer });
  const sceneWidth = sceneRef.current?.clientWidth || 390;
  const sceneHeight = sceneRef.current?.clientHeight || 712;

  return (
    <section ref={sceneRef} className="office-scene" aria-label="办公室动态场景" data-character-count={overlaySnapshots.length}>
      <OfficeCanvas
        world={world}
        visibleSceneId={world.visibleSceneId}
        onFrame={onFrame}
        onActorSelect={onSlotSelect}
        onReady={onReady}
        onError={onRendererError}
      />
      <OfficeActorOverlay
        snapshots={overlaySnapshots}
        sceneId={world.visibleSceneId}
        sceneWidth={sceneWidth}
        sceneHeight={sceneHeight}
        onActorSelect={onSlotSelect}
        onSceneChange={onSceneChange}
        rendererError={rendererError}
      />
    </section>
  );
}

export default OfficeScene;
