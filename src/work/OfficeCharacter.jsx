import { getActivityFrame, getOfficeChibi } from "./officeAssets.js";
import { OFFICE_NODES, getFacing } from "./officeNavigation.js";

const MOVING_PHASES = new Set(["walkingToActivity", "returning"]);
const ATLAS_ACTIVITIES = new Set(["idle", "working", "slacking", "eating", "gaming", "chatting"]);
const VALID_FACING = new Set(["left", "right", "up", "down"]);

const STATUS_FALLBACKS = {
  idle: "空闲中",
  working: "工作中",
  slacking: "摸鱼中",
  eating: "吃饭中",
  gaming: "游戏中",
  chatting: "闲聊中",
  returning: "返回工位",
};

const MEAL_DETAILS = {
  bento: { label: "便当", utensil: "chopsticks" },
  rice: { label: "米饭", utensil: "spoon" },
  noodles: { label: "面条", utensil: "chopsticks" },
  sandwich: { label: "三明治", utensil: "hands" },
};

const SLACK_DETAILS = {
  phone: { label: "手机", className: "phone" },
  comic: { label: "漫画", className: "comic" },
  handheld: { label: "掌机", className: "handheld" },
};

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const clampDuration = (value, fallback) => {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return fallback;
  return Math.min(1800, Math.max(450, duration));
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
  if (VALID_FACING.has(declaredFacing)) return declaredFacing;

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
    if (VALID_FACING.has(routeFacing)) return routeFacing;
  }

  return "right";
};

const resolveFramePhase = (character, now) => {
  const explicitPhase = Number(character?.props?.framePhase ?? character?.framePhase);
  if (Number.isFinite(explicitPhase)) return explicitPhase;

  const clock = Number(now);
  if (Number.isFinite(clock) && clock > 0) return Math.floor(clock / 720);
  return Number.isFinite(character?.routeIndex) ? character.routeIndex : 0;
};

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

const getSlackDetail = (character, slotId) => {
  const requested = cleanText(character?.props?.slackProp).toLowerCase();
  if (requested === "console" || requested === "game") return SLACK_DETAILS.handheld;
  if (SLACK_DETAILS[requested]) return SLACK_DETAILS[requested];

  const options = Object.values(SLACK_DETAILS);
  const slotSeed = [...slotId].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  const timeSeed = Number.isFinite(character?.activityStartedAt)
    ? Math.floor(character.activityStartedAt / 1000)
    : 0;
  return options[Math.abs(slotSeed + timeSeed) % options.length];
};

function WorkProps() {
  return (
    <div className="office-work-props office-activity-prop" role="img" aria-label="电脑与工作文件">
      <i className="office-work-computer computer" aria-hidden="true"><b className="screen"></b><b className="cursor"></b></i>
      <i className="office-work-document document" aria-hidden="true"><b></b><b></b><b></b></i>
    </div>
  );
}

function SlackProps({ detail }) {
  return (
    <div
      className={`office-slack-prop office-activity-prop prop-${detail.className}`}
      data-prop={detail.className}
      role="img"
      aria-label={`正在看${detail.label}`}
    >
      <i className="office-slack-screen" aria-hidden="true"></i>
      <i className="office-slack-hand" aria-hidden="true"></i>
      <i className="office-slack-page" aria-hidden="true"></i>
      <i className="office-slack-controls" aria-hidden="true"></i>
    </div>
  );
}

function GameProps() {
  return (
    <div className="office-game-props office-activity-prop" role="img" aria-label="游戏画面与控制器">
      <i className="office-game-screen" aria-hidden="true"><b></b><b></b><b></b></i>
      <i className="office-game-controller" aria-hidden="true"><b></b><b></b></i>
    </div>
  );
}

function MealProps({ meal, stage }) {
  const detail = MEAL_DETAILS[meal] || MEAL_DETAILS.bento;
  return (
    <div
      className={`office-meal office-activity-prop meal-${meal} meal-stage-${stage}`}
      data-depletion-stage={stage}
      data-meal={meal}
      role="img"
      aria-label={`${detail.label}、餐具${meal === "sandwich" ? "" : "和热气"}`}
    >
      <span className="office-food food" aria-hidden="true">
        <i className="office-food-serving"></i>
        <i className="office-food-side"></i>
        <i className="office-food-garnish"></i>
      </span>
      <i className={`office-utensil utensil utensil-${detail.utensil}`} aria-hidden="true"></i>
      <i className="office-meal-steam steam" aria-hidden="true"><b></b><b></b></i>
    </div>
  );
}

function ConversationProps({ isSpeaker }) {
  if (isSpeaker) {
    return (
      <div className="office-chat-prop office-activity-prop" role="img" aria-label="正在说话">
        <i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i>
      </div>
    );
  }

  return (
    <div className="office-listen-prop office-activity-prop" role="img" aria-label="正在倾听">
      <i aria-hidden="true"></i><i aria-hidden="true"></i>
    </div>
  );
}

export function OfficeCharacter({
  character = {},
  assignment = {},
  conversation = null,
  mealStage = 0,
  now = 0,
  sceneLayout = null,
  onSlotSelect,
  onAssetError,
}) {
  const slotId = cleanText(character.slotId || assignment.slotId) || "unassigned";
  const phase = cleanText(character.phase) || "idle";
  const activity = cleanText(character.activity) || "idle";
  const profile = {
    ...(isRecord(character.profile) ? character.profile : {}),
    ...(isRecord(assignment.profile) ? assignment.profile : {}),
  };
  const name = cleanText(profile.name) || "NPC";
  const fallbackStatus = phase === "walkingToActivity"
    ? activity === "eating"
      ? "前往用餐"
      : activity === "chatting"
        ? "前往闲聊"
        : "前往工位"
    : STATUS_FALLBACKS[phase] || STATUS_FALLBACKS[activity] || STATUS_FALLBACKS.idle;
  const status = cleanText(character.status) || fallbackStatus;
  const { id: nodeId, node } = resolveNode(character, slotId);
  const layoutX = typeof sceneLayout?.x === "number" ? sceneLayout.x : Number.NaN;
  const layoutY = typeof sceneLayout?.y === "number" ? sceneLayout.y : Number.NaN;
  const hasSceneLayout = isRecord(sceneLayout)
    && Number.isFinite(layoutX)
    && Number.isFinite(layoutY);
  const positionX = hasSceneLayout ? layoutX : node.x;
  const positionY = hasSceneLayout ? layoutY : node.y;
  const layoutFacing = cleanText(sceneLayout?.facing);
  const facing = hasSceneLayout && VALID_FACING.has(layoutFacing)
    ? layoutFacing
    : resolveFacing(character, nodeId);
  const spriteActivity = MOVING_PHASES.has(phase)
    ? "walking"
    : ATLAS_ACTIVITIES.has(activity)
      ? activity
      : "idle";
  const frame = getActivityFrame(spriteActivity, resolveFramePhase(character, now));
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
  const isAtActivity = !MOVING_PHASES.has(phase);
  const walkDuration = clampDuration(
    character.routeStepDurationMs
      ?? character.stepDurationMs
      ?? character.props?.walkDurationMs,
    900,
  );
  const positionDuration = MOVING_PHASES.has(phase) ? walkDuration : 220;
  const normalizedMealStage = Math.min(3, Math.max(0, Number.parseInt(mealStage, 10) || 0));
  const meal = MEAL_DETAILS[cleanText(character.props?.meal)] ? cleanText(character.props.meal) : "bento";
  const slackDetail = getSlackDetail(character, slotId);
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
  const bubbleMemberOffset = Number.isFinite(sceneLayout?.bubbleMemberOffsetPx)
    ? sceneLayout.bubbleMemberOffsetPx
    : 0;
  const bubblePlacement = cleanText(sceneLayout?.bubblePlacement) || "center";

  const layerStyle = {
    left: `${positionX}%`,
    top: `${positionY}%`,
    zIndex: 20 + Math.round(positionY * 10),
    "--office-position-duration": `${positionDuration}ms`,
    "--office-bubble-offset": `${bubbleOffset}px`,
    "--office-bubble-member-offset": `${bubbleMemberOffset}px`,
  };
  const frameStyle = {
    backgroundImage: `url(${builtInAsset.src})`,
    backgroundSize: frame.backgroundSize,
    backgroundPosition: frame.backgroundPosition,
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
      data-conversation-group={sessionId || undefined}
      data-conversation-role={conversationRole || undefined}
      data-group-index={groupIndex ?? undefined}
      data-group-count={groupCount ?? undefined}
      data-bubble-placement={bubblePlacement}
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

      {isAtActivity && activity === "working" && <WorkProps />}
      {isAtActivity && activity === "slacking" && <SlackProps detail={slackDetail} />}
      {isAtActivity && activity === "gaming" && <GameProps />}
      {isAtActivity && activity === "eating" && <MealProps meal={meal} stage={normalizedMealStage} />}
      {isAtActivity && activity === "chatting" && (
        <ConversationProps isSpeaker={currentSpeakerId === slotId} />
      )}

      <div className="office-character-status" aria-hidden="true">
        <i aria-hidden="true"></i>
        <span>{status}</span>
      </div>
    </div>
  );
}

export default OfficeCharacter;
