import { ChevronRight } from "lucide-react";
import { OFFICE_BACKGROUND_URL, OFFICE_FURNITURE } from "./officeAssets.js";
import { getOfficePoint } from "./officeGeometry.js";
import { OfficeCharacter } from "./OfficeCharacter.jsx";

export function OfficeScene({ occupants, meMovement, onObjectClick, onEnterBreakroom, sceneRef }) {
  return (
    <main ref={sceneRef} className="office-scene" style={{ backgroundImage: `url(${OFFICE_BACKGROUND_URL})` }}>
      <div className="office-light" aria-hidden="true" />
      {OFFICE_FURNITURE.map((item) => (
        <button type="button" key={item.id} className={`office-object ${item.kind}`} aria-label={item.label} onClick={() => onObjectClick(item)}>
          <img className="office-object-art" src={item.asset} alt="" draggable="false" />
        </button>
      ))}
      <button className="work-breakroom-entry" type="button" onClick={onEnterBreakroom} aria-label="进入茶水间和员工餐厅">
        <ChevronRight size={22} />
      </button>
      {occupants.map((occupant) => {
        const isMe = occupant.profile.source === "me";
        const node = isMe ? meMovement.point : getOfficePoint(`${occupant.slotId}-home`);
        return <OfficeCharacter key={occupant.profile.id} {...occupant} node={node} durationMs={isMe ? meMovement.durationMs : 700} moving={isMe && meMovement.moving} facing={isMe ? meMovement.facing : "right"} />;
      })}
      {occupants.length === 0 && <div className="office-empty-note"><strong>办公室还空着</strong><span>前往员工管理安排老板与员工</span></div>}
    </main>
  );
}
