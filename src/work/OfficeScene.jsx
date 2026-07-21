import { OFFICE_BACKGROUND_URL, OFFICE_FURNITURE } from "./officeAssets.js";
import { OFFICE_NODES } from "./officeNavigation.js";
import { OfficeCharacter } from "./OfficeCharacter.jsx";

export function OfficeScene({ occupants, meMovement, onObjectClick }) {
  return (
    <main className="office-scene" style={{ backgroundImage: `url(${OFFICE_BACKGROUND_URL})` }}>
      <div className="office-light" aria-hidden="true" />
      {OFFICE_FURNITURE.map((item) => (
        <button type="button" key={item.id} className={`office-object ${item.kind}`} aria-label={item.label} onClick={() => onObjectClick(item.destination)}>
          {item.kind.includes("desk") && <><span className="office-monitor" /><span className="office-desk-top" /><span className="office-desk-legs" /></>}
          {item.kind.includes("door") && <><span className="office-door-panel" /><span className="office-door-knob" /></>}
          {item.kind === "tea" && <><span className="office-kettle" /><span className="office-cups" /><span className="office-counter-top" /></>}
        </button>
      ))}
      {occupants.map((occupant) => {
        const isMe = occupant.profile.source === "me";
        const nodeId = isMe ? meMovement.nodeId : `${occupant.slotId}-home`;
        return <OfficeCharacter key={occupant.profile.id} {...occupant} node={OFFICE_NODES[nodeId]} moving={isMe && meMovement.moving} facing={isMe ? meMovement.facing : "right"} />;
      })}
      {occupants.length === 0 && <div className="office-empty-note"><strong>办公室还空着</strong><span>前往员工管理安排老板与员工</span></div>}
    </main>
  );
}
