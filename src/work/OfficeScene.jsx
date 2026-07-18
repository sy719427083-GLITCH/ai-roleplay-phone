import { useMemo } from "react";
import OfficeCanvas from "./pixi/OfficeCanvas.jsx";
import { OFFICE_SCENES, OFFICE_WORLD_SIZE } from "./officeSceneManifest.js";
import { sampleOfficeRoute } from "./officeMotion.js";
import { OFFICE_NODES } from "./officeNavigation.js";
import { resolveOfficeModuleState } from "./officeStations.js";
import "./office.css";

const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];
const MOVING_PHASES = new Set(["walkingToActivity", "returning"]);
const OFFICE_WALK_SPEED = 10;
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

export function resolveOfficeActivityEventForCharacter({
  slotId,
  character = {},
  activityEvents = [],
  activeEventBySlot = {},
  activityEventById = null,
} = {}) {
  const normalizedSlotId = cleanText(slotId || character.slotId);
  if (!normalizedSlotId) return null;
  const eventById = activityEventById instanceof Map
    ? activityEventById
    : new Map((Array.isArray(activityEvents) ? activityEvents : [])
      .map((event) => [cleanText(event?.eventId), event]));
  const activeEventId = cleanText(activeEventBySlot?.[normalizedSlotId]);
  const directlyOwnedEvent = eventById.get(activeEventId);
  if (directlyOwnedEvent?.actorId === normalizedSlotId) {
    if (directlyOwnedEvent.activityType !== "chatting") return directlyOwnedEvent;
    const eventConversationId = cleanText(directlyOwnedEvent.conversationId);
    const characterConversationId = cleanText(character.conversationId);
    if (!characterConversationId) {
      return character.phase === "walkingToActivity" ? directlyOwnedEvent : null;
    }
    const participantIds = Array.isArray(directlyOwnedEvent.participantIds)
      ? directlyOwnedEvent.participantIds.map(String)
      : [];
    if (eventConversationId === characterConversationId
      && participantIds.includes(normalizedSlotId)) return directlyOwnedEvent;
  }

  const characterConversationId = cleanText(character.conversationId);
  if (!characterConversationId) return null;
  for (const event of eventById.values()) {
    if (cleanText(event?.activityType) !== "chatting") continue;
    if (cleanText(event?.conversationId) !== characterConversationId) continue;
    const participantIds = Array.isArray(event?.participantIds)
      ? event.participantIds.map(String)
      : [];
    if (!participantIds.includes(normalizedSlotId)) continue;
    const ownerId = cleanText(event?.actorId);
    if (!ownerId || cleanText(activeEventBySlot?.[ownerId]) !== cleanText(event?.eventId)) continue;
    return event;
  }
  return null;
}

const getCharacterNode = (character, slotId) => {
  const routeIndex = Number.isFinite(character?.routeIndex) ? character.routeIndex : 0;
  const routeNode = Array.isArray(character?.route) ? character.route[routeIndex] : "";
  const nodeId = cleanText(character?.positionNode)
    || cleanText(routeNode)
    || cleanText(character?.homeNode)
    || `${slotId}-home`;
  return OFFICE_NODES[nodeId] || OFFICE_NODES[`${slotId}-home`] || { x: 50, y: 50 };
};

const legacyPointToWorld = (point) => ({
  x: (Number(point?.x) || 50) * (OFFICE_WORLD_SIZE.width / 100),
  y: (Number(point?.y) || 50) * (OFFICE_WORLD_SIZE.height / 100),
});

export function buildOfficeWorld({ state = {}, assignments = {}, motionNow } = {}) {
  const characters = isRecord(state.characters) ? state.characters : {};
  const now = Number.isFinite(motionNow) ? motionNow : Number(state.now) || 0;
  const visibleSceneId = OFFICE_SCENES[state.visibleSceneId] ? state.visibleSceneId : "office";
  // The former office-module-layer/data-module-state DOM contract is carried as Pixi world metadata.
  const moduleState = resolveOfficeModuleState({
    characters,
    reservations: isRecord(state.reservations) ? state.reservations : {},
  });
  const actors = OFFICE_SLOT_IDS.map((slotId) => {
    const character = isRecord(characters[slotId]) ? characters[slotId] : { slotId };
    const motion = MOVING_PHASES.has(character.phase)
      ? sampleOfficeRoute({
        route: character.route,
        startedAt: character.routeStartedAt,
        now,
        speed: OFFICE_WALK_SPEED,
        nodes: OFFICE_NODES,
      })
      : null;
    const point = motion || getCharacterNode(character, slotId);
    const assignment = isRecord(assignments[slotId]) ? assignments[slotId] : {};

    return {
      id: slotId,
      sceneId: OFFICE_SCENES[character.sceneId] ? character.sceneId : "office",
      ...legacyPointToWorld(point),
      facing: motion?.facing || character.facing || "front",
      status: cleanText(character.status),
      profile: isRecord(assignment.profile) ? assignment.profile : null,
      furnitureReady: moduleState.characters[slotId]?.furnitureReady !== false,
    };
  });

  return { scenes: OFFICE_SCENES, actors, visibleSceneId, moduleState };
}

const getOverlaySnapshots = (state, world) => {
  const characters = isRecord(state.characters) ? state.characters : {};
  const conversations = isRecord(state.conversations) ? state.conversations : {};
  const activityEvents = Array.isArray(state.activityEvents) ? state.activityEvents : [];
  const activeEventBySlot = isRecord(state.activeEventBySlot) ? state.activeEventBySlot : {};

  return world.actors.map((actor) => {
    const character = isRecord(characters[actor.id]) ? characters[actor.id] : {};
    const activityEvent = resolveOfficeActivityEventForCharacter({
      slotId: actor.id,
      character,
      activityEvents,
      activeEventBySlot,
    });
    const conversation = conversations[character.conversationId];
    const speakerId = conversation?.bubbleQueue?.[0]?.speakerId;
    const conversationRole = character.phase === "chatting"
      ? (speakerId === actor.id ? "speaker" : "listener")
      : "";

    return {
      id: actor.id,
      activity: activityEvent?.activityType || character.activity || "idle",
      conversationRole,
      furnitureReady: actor.furnitureReady,
    };
  });
};

function OfficeOverlaySnapshot({ snapshot, furnitureReady }) {
  return (
    <span
      className="office-overlay-snapshot"
      data-actor-id={snapshot.id}
      data-activity={snapshot.activity}
      data-conversation-role={snapshot.conversationRole || undefined}
      data-furniture-ready={furnitureReady}
    />
  );
}

export function OfficeScene({
  state = {},
  assignments = {},
  motionNow,
  onSlotSelect,
  onStationSelect,
  onAssetError,
}) {
  const world = useMemo(
    () => buildOfficeWorld({ state, assignments, motionNow }),
    [state, assignments, motionNow],
  );
  const overlaySnapshots = useMemo(() => getOverlaySnapshots(state, world), [state, world]);

  return (
    <section
      className="office-scene"
      aria-label="办公室动态场景"
      data-character-count={world.actors.length}
    >
      <OfficeCanvas
        world={world}
        visibleSceneId={world.visibleSceneId}
        onDoorSelect={onStationSelect}
        onActorSelect={onSlotSelect}
        onError={onAssetError}
      />
      <div className="office-scene-overlay" aria-live="polite">
        {overlaySnapshots.map((snapshot) => (
          <OfficeOverlaySnapshot
            key={snapshot.id}
            snapshot={snapshot}
            furnitureReady={snapshot.furnitureReady}
          />
        ))}
      </div>
    </section>
  );
}

export default OfficeScene;
