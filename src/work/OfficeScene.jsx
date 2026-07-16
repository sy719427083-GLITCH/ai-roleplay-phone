import OfficeCharacter from "./OfficeCharacter.jsx";
import { sampleOfficeRoute } from "./officeMotion.js";
import { OFFICE_NODES } from "./officeNavigation.js";
import "./office.css";

const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];
const OFFICE_BACKGROUND = "/ai-roleplay-phone/work-office-assets/office-bg.webp";
const OFFICE_WALK_SPEED = 18;
const MOVING_PHASES = new Set(["walkingToActivity", "returning"]);
const GROUP_BOUNDS = { minX: 12, maxX: 88, minY: 18, maxY: 94 };
const SCENE_PERCENT_TO_PHONE_PX = 3.9;
const SCENE_PHONE_WIDTH_PX = 390;
const BUBBLE_HALF_WIDTH_PX = 90;
const BUBBLE_VIEWPORT_GUTTER_PX = 12;
const FIVE_MEMBER_BUBBLE_OFFSETS_PX = [-50, -50, 0, 50, 50];

const GROUP_OFFSETS = {
  2: [
    { x: -9, y: 1 },
    { x: 9, y: 1 },
  ],
  3: [
    { x: -12, y: 5 },
    { x: 0, y: -4 },
    { x: 12, y: 5 },
  ],
  4: [
    { x: -15, y: 6 },
    { x: -5, y: -3 },
    { x: 5, y: -1 },
    { x: 15, y: 7 },
  ],
  5: [
    { x: -16, y: 7 },
    { x: -8, y: 0 },
    { x: 0, y: -5 },
    { x: 8, y: 1 },
    { x: 16, y: 7 },
  ],
};

const BUBBLE_PLACEMENTS = {
  "chat-1": { side: "left", offsetPx: -62 },
  "chat-2": { side: "right", offsetPx: 62 },
  "chat-3": { side: "left", offsetPx: -62 },
  "chat-4": { side: "right", offsetPx: 62 },
};

const STATIONS = [
  { id: "boss-desk", label: "老板工位", left: 32, top: 16, width: 36, height: 14 },
  { id: "employee1-desk", label: "一号员工工位", left: 8, top: 39, width: 32, height: 15 },
  { id: "employee2-desk", label: "二号员工工位", left: 60, top: 39, width: 32, height: 15 },
  { id: "employee3-desk", label: "三号员工工位", left: 8, top: 58, width: 32, height: 15 },
  { id: "employee4-desk", label: "四号员工工位", left: 60, top: 58, width: 32, height: 15 },
  { id: "meal-pickup", label: "取餐架", left: 4, top: 76, width: 36, height: 9 },
  { id: "break-area", label: "休息用餐区", left: 3, top: 84, width: 42, height: 13 },
  { id: "meeting-area", label: "中央交流区", left: 40, top: 49, width: 20, height: 24 },
];

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

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

const getFallbackCharacter = (slotId, assignment) => ({
  slotId,
  profileId: cleanText(assignment?.profileId),
  profile: isRecord(assignment?.profile) ? assignment.profile : null,
  phase: "idle",
  activity: "idle",
  status: "空闲中",
  conversationId: "",
  positionNode: `${slotId}-home`,
  homeNode: `${slotId}-home`,
  homePosition: `${slotId}-home`,
  route: [],
  routeIndex: 0,
  props: {},
});

const getCharacterNode = (character, slotId) => {
  const routeIndex = Number.isFinite(character?.routeIndex) ? character.routeIndex : 0;
  const routeNode = Array.isArray(character?.route) ? character.route[routeIndex] : "";
  const nodeId = cleanText(character?.positionNode)
    || cleanText(routeNode)
    || cleanText(character?.homeNode)
    || `${slotId}-home`;
  return OFFICE_NODES[nodeId] || OFFICE_NODES[`${slotId}-home`] || { x: 50, y: 50 };
};

const fitGroupAxis = (anchorValue, offsets, minimum, maximum) => {
  const rawMinimum = anchorValue + Math.min(...offsets);
  const rawMaximum = anchorValue + Math.max(...offsets);
  if (rawMinimum < minimum) return minimum - rawMinimum;
  if (rawMaximum > maximum) return maximum - rawMaximum;
  return 0;
};

const roundPosition = (value) => Math.round(value * 10) / 10;

const getConversationLayout = (character, conversation, slotId, fallbackNode) => {
  if (!isRecord(conversation)
    || MOVING_PHASES.has(character.phase)
    || character.phase !== "chatting"
    || character.activity !== "chatting") {
    return null;
  }

  const sessionId = cleanText(conversation.id || conversation.conversationId);
  if (!sessionId || sessionId !== cleanText(character.conversationId)) return null;

  const memberIds = Array.isArray(conversation.memberIds)
    ? conversation.memberIds.map(String)
    : [];
  const groupCount = memberIds.length;
  const groupIndex = memberIds.indexOf(slotId);
  const offsets = GROUP_OFFSETS[groupCount];
  if (!offsets || groupIndex < 0) return null;

  const anchorId = cleanText(conversation.anchorId);
  const anchor = OFFICE_NODES[anchorId] || fallbackNode;
  const xAdjustment = fitGroupAxis(
    anchor.x,
    offsets.map((offset) => offset.x),
    GROUP_BOUNDS.minX,
    GROUP_BOUNDS.maxX,
  );
  const yAdjustment = fitGroupAxis(
    anchor.y,
    offsets.map((offset) => offset.y),
    GROUP_BOUNDS.minY,
    GROUP_BOUNDS.maxY,
  );
  const offset = offsets[groupIndex];
  const x = roundPosition(anchor.x + xAdjustment + offset.x);
  const y = roundPosition(anchor.y + yAdjustment + offset.y);
  const groupCenterX = anchor.x + xAdjustment;
  const facing = x < groupCenterX ? "right" : x > groupCenterX ? "left" : "right";
  const bubblePlacement = BUBBLE_PLACEMENTS[anchorId] || { side: "center", offsetPx: 0 };
  const bubbleMemberOffsetPx = bubblePlacement.offsetPx
    ? roundPosition((anchor.x - x) * SCENE_PERCENT_TO_PHONE_PX)
    : 0;

  return {
    x,
    y,
    facing,
    groupIndex,
    groupCount,
    bubblePlacement: bubblePlacement.side,
    bubbleOffsetPx: bubblePlacement.offsetPx,
    bubbleMemberOffsetPx,
  };
};

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

const clampStage = (value) => Math.min(3, Math.max(0, value));

const parseMealStage = (value) => {
  if (typeof value === "string") {
    const namedStages = { full: 0, high: 1, half: 2, low: 3, empty: 3 };
    if (Object.hasOwn(namedStages, value.toLowerCase())) return namedStages[value.toLowerCase()];
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number >= 0 && number <= 1 && !Number.isInteger(number)) {
    return clampStage(Math.floor(number * 4));
  }
  return clampStage(Math.round(number));
};

export const getMealDepletionStage = (character, now) => {
  const props = isRecord(character?.props) ? character.props : {};
  const explicitStage = parseMealStage(props.mealStage ?? props.depletionStage);
  if (explicitStage !== null) return explicitStage;

  const explicitProgress = Number(props.mealProgress ?? character?.mealProgress);
  if (Number.isFinite(explicitProgress)) {
    const progress = Math.min(1, Math.max(0, explicitProgress));
    return clampStage(Math.floor(progress * 4));
  }

  const startedAt = Number(character?.activityStartedAt);
  const endsAt = Number(character?.activityEndsAt);
  const currentTime = Number(now);
  if (Number.isFinite(startedAt)
    && Number.isFinite(endsAt)
    && Number.isFinite(currentTime)
    && endsAt > startedAt) {
    const progress = Math.min(1, Math.max(0, (currentTime - startedAt) / (endsAt - startedAt)));
    return clampStage(Math.floor(progress * 4));
  }

  return 0;
};

const resolveConversation = (conversations, conversationId) => {
  if (!conversationId || !isRecord(conversations)) return null;
  const session = conversations[conversationId];
  if (!isRecord(session)) return null;
  const sessionId = cleanText(session.id || session.conversationId) || conversationId;
  if (sessionId !== conversationId) return null;
  return session.id ? session : { ...session, id: conversationId };
};

function StationHitArea({ station, onStationSelect }) {
  const style = {
    left: `${station.left}%`,
    top: `${station.top}%`,
    width: `${station.width}%`,
    height: `${station.height}%`,
  };

  if (typeof onStationSelect === "function") {
    return (
      <button
        type="button"
        className="office-hit-area is-interactive"
        data-station={station.id}
        style={style}
        aria-label={station.label}
        onClick={() => onStationSelect(station.id)}
      ></button>
    );
  }

  return (
    <span
      className="office-hit-area"
      data-station={station.id}
      style={style}
      role="img"
      aria-label={station.label}
    ></span>
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
  const stateAssignments = isRecord(state.assignments) ? state.assignments : {};
  const suppliedAssignments = isRecord(assignments) ? assignments : {};
  const characters = isRecord(state.characters) ? state.characters : {};
  const conversations = isRecord(state.conversations) ? state.conversations : {};
  const now = Number.isFinite(state.now) ? state.now : 0;
  const sampledMotionNow = Number.isFinite(motionNow) ? motionNow : now;
  const activityEvents = Array.isArray(state.activityEvents) ? state.activityEvents : [];
  const activeEventBySlot = isRecord(state.activeEventBySlot) ? state.activeEventBySlot : {};
  const activityEventById = new Map(activityEvents.map((event) => [cleanText(event?.eventId), event]));

  const sceneCharacters = OFFICE_SLOT_IDS.map((slotId, slotIndex) => {
    const assignment = isRecord(suppliedAssignments[slotId])
      ? suppliedAssignments[slotId]
      : isRecord(stateAssignments[slotId])
        ? stateAssignments[slotId]
        : {};
    const sourceCharacter = isRecord(characters[slotId]) ? characters[slotId] : {};
    const character = {
      ...getFallbackCharacter(slotId, assignment),
      ...sourceCharacter,
      slotId,
      props: isRecord(sourceCharacter.props) ? sourceCharacter.props : {},
    };
    const node = getCharacterNode(character, slotId);
    const conversation = resolveConversation(conversations, cleanText(character.conversationId));
    const motion = MOVING_PHASES.has(character.phase)
      ? sampleOfficeRoute({
        route: character.route,
        startedAt: character.routeStartedAt,
        now: sampledMotionNow,
        speed: OFFICE_WALK_SPEED,
        nodes: OFFICE_NODES,
      })
      : null;
    const conversationLayout = getClampedBubbleLayout(
      getConversationLayout(character, conversation, slotId, node),
    );
    const sceneLayout = motion || conversationLayout;
    const activityEvent = resolveOfficeActivityEventForCharacter({
      slotId,
      character,
      activityEvents,
      activeEventBySlot,
      activityEventById,
    });

    return {
      slotId,
      slotIndex,
      assignment,
      character,
      node,
      motion,
      sceneLayout,
      finalY: sceneLayout?.y ?? node.y,
      conversation,
      activityEvent,
      mealStage: getMealDepletionStage(character, now),
    };
  }).sort((left, right) => left.finalY - right.finalY || left.slotIndex - right.slotIndex);

  return (
    <section
      className="office-scene"
      aria-label="办公室动态场景"
      data-character-count={sceneCharacters.length}
    >
      <img
        className="office-scene-background"
        src={OFFICE_BACKGROUND}
        alt=""
        aria-hidden="true"
        draggable={false}
      />

      <div className="office-furniture-layer" role="group" aria-label="办公室设施与互动区域">
        {STATIONS.map((station) => (
          <StationHitArea
            key={station.id}
            station={station}
            onStationSelect={onStationSelect}
          />
        ))}
      </div>

      <div className="office-character-layer" aria-label="办公室成员">
        {sceneCharacters.map(({
          slotId,
          character,
          assignment,
          conversation,
          activityEvent,
          mealStage,
          motion,
          sceneLayout,
        }) => (
          <OfficeCharacter
            key={slotId}
            character={character}
            assignment={assignment}
            conversation={conversation}
            activityEvent={activityEvent}
            mealStage={mealStage}
            motion={motion}
            motionNow={sampledMotionNow}
            sceneLayout={sceneLayout}
            onSlotSelect={onSlotSelect}
            onAssetError={onAssetError}
          />
        ))}
      </div>
    </section>
  );
}

export default OfficeScene;
