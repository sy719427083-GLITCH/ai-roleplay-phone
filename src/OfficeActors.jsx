import { OfficeAvatar } from './OfficeAvatarEditor.jsx';
import { OFFICE_FRAME } from './officeSceneLayout.js';
import { officeActorPosition, officeActorStatus } from './officeLife.js';

export function OfficeActors({life,roster,reducedMotion,onEdit,dialogue,onObserve}) {
  return <div className="ow-actors" aria-label="员工自主活动">
    {life.actors.map(actor=>{
      const person=roster.find(p=>p.id===actor.id);
      if(!person)return null;
      const [x,y]=officeActorPosition(actor,life.now,reducedMotion);
      const status=officeActorStatus(actor,life,roster);
      const moving=['walking','returning'].includes(actor.phase);
      return <button key={actor.id} className={`ow-actor ${moving?'is-walking':''} task-${actor.task} mood-${actor.mood||'none'}`} data-phase={actor.phase} data-activity={actor.task} data-seat={actor.id} data-edge={x<160?'left':x>690?'right':'center'}
        style={{left:`${x/OFFICE_FRAME.width*100}%`,top:`${(y-OFFICE_FRAME.top)/OFFICE_FRAME.sceneHeight*100}%`,zIndex:10+Math.round(y/20)}}
        aria-label={`观察${person.name} · ${status}`} title={`${person.name} · ${status} · 点击观察`} onClick={()=>onObserve(actor.id)}>
        {!(actor.visitHostId&&actor.visitHostId!==actor.id&&actor.phase==='active')&&<span className="ow-activity" aria-hidden="true">{status}</span>}
        {dialogue?.line?.speaker===actor.id&&<span className="ow-speech" aria-label="交流内容">{dialogue.line.text}</span>}
        <span className="ow-actor-portrait"><OfficeAvatar src={person.avatar}/><span className="ow-action-icon" aria-hidden="true">{actor.icon}</span></span>
        <span className="ow-actor-name" aria-hidden="true">{person.name}</span>
      </button>;
    })}
  </div>;
}
