import OfficeCharacter from "./OfficeCharacter.jsx";
import { OFFICE_NODES } from "./officeNavigation.js";
import "./office.css";

const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];
const OFFICE_BACKGROUND = "/ai-roleplay-phone/work-office-assets/office-bg.png";

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
  onSlotSelect,
  onStationSelect,
  onAssetError,
}) {
  const stateAssignments = isRecord(state.assignments) ? state.assignments : {};
  const suppliedAssignments = isRecord(assignments) ? assignments : {};
  const characters = isRecord(state.characters) ? state.characters : {};
  const conversations = isRecord(state.conversations) ? state.conversations : {};
  const now = Number.isFinite(state.now) ? state.now : 0;

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

    return {
      slotId,
      slotIndex,
      assignment,
      character,
      node,
      conversation: resolveConversation(conversations, cleanText(character.conversationId)),
      mealStage: getMealDepletionStage(character, now),
    };
  }).sort((left, right) => left.node.y - right.node.y || left.slotIndex - right.slotIndex);

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
        {sceneCharacters.map(({ slotId, character, assignment, conversation, mealStage }) => (
          <OfficeCharacter
            key={slotId}
            character={character}
            assignment={assignment}
            conversation={conversation}
            mealStage={mealStage}
            now={now}
            onSlotSelect={onSlotSelect}
            onAssetError={onAssetError}
          />
        ))}
      </div>
    </section>
  );
}

export default OfficeScene;
