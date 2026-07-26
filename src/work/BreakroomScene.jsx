import { ChevronLeft } from "lucide-react";
import { BREAKROOM_BACKGROUND_URL, BREAKROOM_FACILITIES } from "./breakroomAssets.js";
import { OfficeCharacter } from "./OfficeCharacter.jsx";

export function BreakroomScene({ sceneRef, meOccupant, movement, onFacilityClick, onBack }) {
  return (
    <main ref={sceneRef} className="breakroom-scene" style={{ backgroundImage: `url(${BREAKROOM_BACKGROUND_URL})` }}>
      <button className="breakroom-back" type="button" onClick={onBack} aria-label="返回办公室">
        <ChevronLeft size={22} />
      </button>
      {BREAKROOM_FACILITIES.map((facility) => (
        <button
          type="button"
          key={facility.id}
          className={`breakroom-object ${facility.kind}`}
          aria-label={facility.label}
          onClick={() => onFacilityClick(facility)}
        >
          <img src={facility.asset} alt="" draggable="false" />
        </button>
      ))}
      {meOccupant && <OfficeCharacter {...meOccupant} node={movement.point} durationMs={movement.durationMs} moving={movement.moving} facing={movement.facing} />}
    </main>
  );
}
