import { getActivityFrame, getOfficeChibi } from "./officeAssets.js";
import { getWalkFrame } from "./officeMotion.js";
import { OFFICE_NODES, getFacing } from "./officeNavigation.js";

const MOVING_PHASES = new Set(["walkingToActivity", "returning"]);
const ATLAS_ACTIVITIES = new Set([
  "idle", "working", "slacking", "eating", "gaming", "reading",
  "watchingSeries", "watchingShortVideo", "chatting", "listening",
]);
const EVENT_ACTIVITIES = new Set([
  "working", "slacking", "eating", "gaming", "reading",
  "watchingSeries", "watchingShortVideo", "chatting",
]);
const VALID_FACING = new Set(["left", "right", "front", "back"]);

const STATUS_FALLBACKS = {
  idle: "空闲中",
  working: "工作中",
  slacking: "摸鱼中",
  eating: "吃饭中",
  gaming: "游戏中",
  reading: "看书中",
  watchingSeries: "刷剧中",
  watchingShortVideo: "看抖音中",
  chatting: "闲聊中",
  returning: "返回工位",
};

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

export const getOwnedActivityEvent = (activityEvent, characterOrSlotId) => {
  if (!isRecord(activityEvent)) return null;
  if (!cleanText(activityEvent.eventId)) return null;
  const character = isRecord(characterOrSlotId) ? characterOrSlotId : {};
  const slotId = cleanText(character.slotId || characterOrSlotId);
  const activityType = cleanText(activityEvent.activityType);
  if (!slotId || !EVENT_ACTIVITIES.has(activityType)) return null;
  if (Number(activityEvent.endedAt) > 0) return null;
  if (cleanText(activityEvent.actorId) === slotId) {
    if (activityType !== "chatting") return activityEvent;
    const characterConversationId = cleanText(character.conversationId);
    if (!characterConversationId) {
      return character.phase === "walkingToActivity" ? activityEvent : null;
    }
    const participantIds = Array.isArray(activityEvent.participantIds)
      ? activityEvent.participantIds.map(String)
      : [];
    if (cleanText(activityEvent.conversationId) !== characterConversationId) return null;
    return participantIds.includes(slotId) ? activityEvent : null;
  }
  if (activityType !== "chatting") return null;
  const conversationId = cleanText(activityEvent.conversationId);
  if (!conversationId || conversationId !== cleanText(character.conversationId)) return null;
  const participantIds = Array.isArray(activityEvent.participantIds)
    ? activityEvent.participantIds.map(String)
    : [];
  if (!participantIds.includes(slotId)) return null;
  return activityEvent;
};

const normalizeFacing = (facing) => {
  if (facing === "up") return "back";
  if (facing === "down") return "front";
  return VALID_FACING.has(facing) ? facing : "right";
};

const resolveNode = (character, slotId) => {
  const routeIndex = Number.isFinite(character?.routeIndex) ? character.routeIndex : 0;
  const routeNode = Array.isArray(character?.route) ? character.route[routeIndex] : "";
  const nodeId = cleanText(character?.positionNode)
    || cleanText(routeNode)
    || cleanText(character?.homeNode)
    || `${slotId}-home`;
  const fallbackId = OFFICE_NODES[`${slotId}-home`] ? `${slotId}-home` : "boss-home";

  return {
    id: OFFICE_NODES[nodeId] ? nodeId : fallbackId,
    node: OFFICE_NODES[nodeId] || OFFICE_NODES[fallbackId] || { x: 50, y: 50 },
  };
};

const resolveFacing = (character, resolvedNodeId) => {
  const declaredFacing = cleanText(character?.facing);
  if (["left", "right", "front", "back", "up", "down"].includes(declaredFacing)) {
    return normalizeFacing(declaredFacing);
  }

  if (MOVING_PHASES.has(character?.phase) && Array.isArray(character?.route)) {
    const routeIndex = Number.isFinite(character.routeIndex) ? character.routeIndex : 0;
    const currentId = character.route[routeIndex] || resolvedNodeId;
    const nextId = character.route[routeIndex + 1];
    const previousId = character.route[routeIndex - 1];
    const routeFacing = nextId
      ? getFacing(currentId, nextId)
      : previousId
        ? getFacing(previousId, currentId)
        : null;
    if (routeFacing) return normalizeFacing(routeFacing);
  }

  return "right";
};

const getActiveFrame = (motionNow) => Math.floor(Math.max(0, Number(motionNow) || 0) / 320) % 4;

const getConversationEntry = (conversation) => {
  if (!isRecord(conversation)) return null;
  const sessionId = cleanText(conversation.id || conversation.conversationId);
  const memberIds = Array.isArray(conversation.memberIds) ? conversation.memberIds.map(String) : [];

  const isValid = (entry) => {
    if (!isRecord(entry) || !cleanText(entry.text) || !cleanText(entry.speakerId)) return false;
    const entrySessionId = cleanText(entry.conversationId);
    if (entrySessionId && sessionId && entrySessionId !== sessionId) return false;
    if (memberIds.length && !memberIds.includes(String(entry.speakerId))) return false;
    return true;
  };

  if (Array.isArray(conversation.bubbleQueue)) {
    const queued = conversation.bubbleQueue[0];
    return isValid(queued) ? queued : null;
  }

  return isValid(conversation.lastResponse) ? conversation.lastResponse : null;
};

const getOwnBubble = (conversation, character, slotId) => {
  const sessionId = cleanText(conversation?.id || conversation?.conversationId);
  const characterSessionId = cleanText(character?.conversationId);
  if (!sessionId || !characterSessionId || sessionId !== characterSessionId) return null;

  const memberIds = Array.isArray(conversation?.memberIds) ? conversation.memberIds.map(String) : [];
  if (memberIds.length && !memberIds.includes(slotId)) return null;

  const entry = getConversationEntry(conversation);
  return entry && String(entry.speakerId) === slotId ? entry : null;
};

const getCurrentSpeakerId = (conversation, character) => {
  const sessionId = cleanText(conversation?.id || conversation?.conversationId);
  if (!sessionId || sessionId !== cleanText(character?.conversationId)) return "";

  const entry = getConversationEntry(conversation);
  if (entry) return String(entry.speakerId);
  return "";
};

function ConversationProps({ isSpeaker, subject, variant }) {
  if (isSpeaker) {
    return (
      <div className="office-chat-prop office-activity-prop" data-prop={variant} role="img" aria-label={`正在聊${subject || "当前话题"}`}>
        <i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i>
      </div>
    );
  }

  return (
    <div className="office-listen-prop office-activity-prop" data-prop={variant} role="img" aria-label={`正在听${subject || "当前话题"}`}>
      <i aria-hidden="true"></i><i aria-hidden="true"></i>
    </div>
  );
}

export function OfficeCharacter({
  character = {},
  assignment = {},
  conversation = null,
  activityEvent = null,
  mealStage = 0,
  motion = null,
  motionNow = 0,
  sceneLayout = null,
  furnitureReady = true,
  onSlotSelect,
  onAssetError,
}) {
  const slotId = cleanText(character.slotId || assignment.slotId) || "unassigned";
  const phase = cleanText(character.phase) || "idle";
  const ownedActivityEvent = getOwnedActivityEvent(activityEvent, { ...character, slotId });
  const activity = cleanText(ownedActivityEvent?.activityType) || "idle";
  const activitySubject = cleanText(ownedActivityEvent?.subject);
  const propVariant = cleanText(ownedActivityEvent?.propVariant);
  const profile = {
    ...(isRecord(character.profile) ? character.profile : {}),
    ...(isRecord(assignment.profile) ? assignment.profile : {}),
  };
  const name = cleanText(profile.name) || "NPC";
  const isMoving = MOVING_PHASES.has(phase);
  const fallbackStatus = phase === "walkingToActivity"
    ? activity === "eating"
      ? "前往用餐"
      : activity === "chatting"
        ? "前往闲聊"
        : "前往工位"
    : phase === "returning"
      ? STATUS_FALLBACKS.returning
      : STATUS_FALLBACKS[activity] || STATUS_FALLBACKS.idle;
  const status = isMoving
    ? cleanText(character.status) || fallbackStatus
    : cleanText(ownedActivityEvent?.status) || fallbackStatus;
  const { id: nodeId, node } = resolveNode(character, slotId);
  const layoutX = typeof sceneLayout?.x === "number" ? sceneLayout.x : Number.NaN;
  const layoutY = typeof sceneLayout?.y === "number" ? sceneLayout.y : Number.NaN;
  const hasSceneLayout = isRecord(sceneLayout)
    && Number.isFinite(layoutX)
    && Number.isFinite(layoutY);
  const positionX = hasSceneLayout ? layoutX : node.x;
  const positionY = hasSceneLayout ? layoutY : node.y;
  const layoutFacing = normalizeFacing(cleanText(motion?.facing || sceneLayout?.facing));
  const facing = hasSceneLayout
    ? layoutFacing
    : resolveFacing(character, nodeId);
  const kind = slotId === "boss" ? "boss" : "employee";
  const assetId = cleanText(
    assignment.chibiId
    || assignment.officeChibiId
    || assignment.assetId
    || assignment.asset?.id
    || character.chibiId
    || character.assetId
    || profile.chibiId,
  );
  const builtInAsset = getOfficeChibi(assetId, kind);
  const customAssetSrc = cleanText(
    assignment.customAssetSrc
    || profile.customAssetSrc
    || character.customAssetSrc
    || character.profile?.customAssetSrc,
  );
  const bubble = getOwnBubble(conversation, character, slotId);
  const currentSpeakerId = getCurrentSpeakerId(conversation, character);
  const isAtActivity = !isMoving && Boolean(ownedActivityEvent);
  const spriteActivity = isMoving
    ? "walking"
    : activity === "chatting" && currentSpeakerId && currentSpeakerId !== slotId
      ? "listening"
      : ATLAS_ACTIVITIES.has(activity)
        ? activity
        : "idle";
  const framePhase = isMoving
    ? getWalkFrame({ startedAt: character.routeStartedAt, now: motionNow })
    : getActiveFrame(motionNow);
  const chairBearing = !isMoving && [
    "idle", "working", "slacking", "eating", "gaming", "reading",
    "watchingSeries", "watchingShortVideo",
  ].includes(spriteActivity);
  const renderedActivity = chairBearing
    ? furnitureReady ? spriteActivity : "listening"
    : spriteActivity;
  const frame = getActivityFrame(renderedActivity, framePhase, facing);
  const positionDuration = isMoving ? 0 : 220;
  const sessionId = cleanText(conversation?.id || conversation?.conversationId);
  const conversationRole = isAtActivity && activity === "chatting"
    ? currentSpeakerId === slotId
      ? "speaker"
      : "listener"
    : "";
  const groupIndex = Number.isInteger(sceneLayout?.groupIndex) ? sceneLayout.groupIndex : null;
  const groupCount = Number.isInteger(sceneLayout?.groupCount) ? sceneLayout.groupCount : null;
  const bubbleOffset = Number.isFinite(sceneLayout?.bubbleOffsetPx)
    ? sceneLayout.bubbleOffsetPx
    : 0;
  const bubblePlacement = cleanText(sceneLayout?.bubblePlacement) || "center";

  const layerStyle = {
    left: `${positionX}%`,
    top: `${positionY}%`,
    zIndex: 20 + Math.round(positionY * 10),
    "--office-position-duration": `${positionDuration}ms`,
    "--office-bubble-offset": `${bubbleOffset}px`,
  };
  const frameStyle = {
    backgroundImage: `url(${builtInAsset.src})`,
    backgroundSize: `${frame.backgroundWidth}px ${frame.backgroundHeight}px`,
    backgroundPosition: `-${frame.frameX}px -${frame.frameY}px`,
    "--office-frame-index": frame.index,
    "--office-frame-row": frame.row,
    "--office-frame-column": frame.column,
  };

  return (
    <div
      className={`office-character${customAssetSrc ? " has-custom-sprite" : " has-atlas-sprite"}`}
      data-slot={slotId}
      data-phase={phase}
      data-activity={activity}
      data-facing={facing}
      data-node={nodeId}
      data-prop={isAtActivity ? propVariant || undefined : undefined}
      data-furniture-ready={furnitureReady}
      data-conversation-group={sessionId || undefined}
      data-conversation-role={conversationRole || undefined}
      data-group-index={groupIndex ?? undefined}
      data-group-count={groupCount ?? undefined}
      data-bubble-placement={bubblePlacement}
      data-motion-now={motionNow}
      style={layerStyle}
    >
      <button
        type="button"
        className="office-character-select"
        aria-label={`${name}，${status}`}
        onClick={() => onSlotSelect?.(slotId)}
      ></button>

      {bubble && (
        <div
          className="office-speech-bubble"
          data-conversation-id={sessionId}
          data-bubble-placement={bubblePlacement}
          role="status"
          aria-live="polite"
        >
          {cleanText(bubble.text)}
        </div>
      )}

      <div className="office-character-name" aria-hidden="true">{name}</div>

      <div className="office-character-motion" aria-hidden="true">
        {customAssetSrc ? (
          <img
            className="office-character-sprite office-character-custom-sprite"
            src={customAssetSrc}
            alt=""
            draggable={false}
            onError={() => onAssetError?.(slotId)}
          />
        ) : (
          <div className="office-character-sprite office-character-atlas-sprite" style={frameStyle}></div>
        )}
      </div>

      {isAtActivity && activity === "chatting" && (
        <ConversationProps
          isSpeaker={currentSpeakerId === slotId}
          subject={activitySubject}
          variant={propVariant}
        />
      )}

      <div className="office-character-status" aria-hidden="true">
        <i aria-hidden="true"></i>
        <span>{status}</span>
      </div>
    </div>
  );
}

export default OfficeCharacter;
