import { useEffect, useRef, useState } from 'react';
import { EVENT_TYPES, readOfficeEvents, createOfficeEvent, resolveOfficeEvent, writeOfficeEvents, officeRelationship, OFFICE_EVENTS_KEY } from './officeEvents.js';
export function useOfficeEvents({storage,roster,life,paused,invite,release}){
 const [state,setState]=useState(()=>readOfficeEvents(storage));const [error,setError]=useState('');const first=useRef(life.now+8000);const stateRef=useRef(state);stateRef.current=state;
 const commit=next=>{const message=writeOfficeEvents(storage,next);setError(message);if(message){first.current=life.now+5000;return false;}stateRef.current=next;setState(next);return true;};
 useEffect(()=>{const refresh=e=>{if(e.key!==OFFICE_EVENTS_KEY)return;const next=readOfficeEvents(storage);const old=stateRef.current.active;if(old&&old.id!==next.active?.id)release(old.seat);stateRef.current=next;setState(next);};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[]);
 const active=state.active;const person=roster.find(p=>p.id===active?.seat&&p.sourceKey===active?.sourceKey);
 useEffect(()=>{if(active&&!person){release(active.seat);commit({...stateRef.current,active:null,nextAt:Date.now()+15000});}},[active?.id,person?.sourceKey]);
 useEffect(()=>{
  if(paused||document.hidden||life.now<first.current)return;
  if(active){if(person)invite(person.id);return;}
  if(Date.now()<state.nextAt||life.actors.some(a=>a.task==='report'&&a.phase!=='working'))return;
  const candidates=roster.filter(p=>p.id!=='boss'&&life.actors.some(a=>a.id===p.id&&a.phase==='working'));
  if(!candidates.length)return;
  const p=candidates[Math.floor(Math.random()*candidates.length)];const next=createOfficeEvent(stateRef.current,p);if(commit(next))invite(p.id);
 },[life.now,paused,active?.id]);
 const choose=index=>{const current=stateRef.current;if(!current.active)return;const saved=readOfficeEvents(storage);if(saved.active?.id!==current.active.id){release(current.active.seat);stateRef.current=saved;setState(saved);setError('这件事已在另一个页面处理。');return;}const next=resolveOfficeEvent(current,current.active.id,index);if(next!==current&&commit(next)){release(current.active.seat);return next.history.at(-1);}};
 return {state,active:person?active:null,error,choose};
}
export function OfficeEventPanel({events,roster,onClose}){
 const [result,setResult]=useState(null);const event=events.active;const type=EVENT_TYPES.find(t=>t.id===event?.type);const person=roster.find(p=>p.sourceKey===event?.sourceKey);
 const scores=officeRelationship(events.state.history,event?.sourceKey||result?.sourceKey);
 return <div className="ow-overlay"><section className="ow-event-panel" role="dialog" aria-modal="true" aria-label="办公室小事"><header><h2>办公室小事</h2><button onClick={onClose} aria-label="关闭办公室小事">×</button></header>
 {event&&!result?<><small>本地事件 · {person?.name}</small><h3>{type.title}</h3><p className="ow-event-quote">{type.text}</p><p className="ow-event-scores">心情 {scores.mood} · 信任 {scores.trust}</p><div className="ow-event-choices">{type.choices.map(([label],index)=><button key={label} onClick={()=>{const r=events.choose(index);if(r)setResult(r);}}>{label}</button>)}</div><button className="ow-event-later" onClick={onClose}>稍后回应</button></>:result?<><small>{result.name}记住了这件事</small><p className="ow-event-quote">{result.reply}</p><p>心情 {result.mood>=0?'+':''}{result.mood} · 信任 {result.trust>=0?'+':''}{result.trust}</p><button className="ow-event-done" onClick={onClose}>回到办公室</button></>:<p>暂时没有人找你。员工在办公室活动一会儿后，可能会带着小事来找你。</p>}
 {events.error&&<p role="alert">{events.error}</p>}<details><summary>共同经历 · {events.state.history.length}</summary>{events.state.history.slice().reverse().map(h=><article key={h.id}><strong>{h.name} · {h.choice}</strong><p>{h.reply}</p></article>)}</details>
 </section></div>;
}
