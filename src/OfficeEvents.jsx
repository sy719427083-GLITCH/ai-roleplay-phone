import { useEffect, useRef, useState } from 'react';
import { officeActorStatus } from './officeLife.js';
import { readOfficeStories, saveOfficeStory, STORY_ACTIONS } from './officeStories.js';
export function useOfficeStories({storage,roster,life,follow}){
 const [history,setHistory]=useState(()=>readOfficeStories(storage));const [error,setError]=useState('');const pending=useRef(new Map());const serial=useRef(0);
 const persist=record=>{const saved=saveOfficeStory(storage,record);if(saved){setHistory(saved);setError('');}else{setHistory(previous=>[...previous.filter(s=>s.id!==record.id),record].slice(-40));setError('动态暂未保存，当前仍可继续观察。');}};
 const decide=session=>{
  const id=`${Date.now()}-${++serial.current}-${session.group}`;const result=follow(session.group,session.action,id);if(!result)return;
  const record={id,participants:session.participants,topic:session.topic,messages:session.messages,action:result.action,reason:result.reason,mode:session.mode,status:'进行中',at:Date.now()};
  pending.current.set(id,record);persist(record);
 };
 useEffect(()=>{
  for(const [id,record] of pending.current){
   const missing=record.participants.some(p=>!roster.some(r=>r.id===p.id&&r.sourceKey===p.sourceKey));
   if(missing||!life.actors.some(a=>a.storyId===id)){pending.current.delete(id);persist({...record,status:missing?'参与角色已离开':'已结束'});}
  }
 },[life.now,roster]);
 // Previous animation cannot be resumed after app closure. Keep the decision but do not claim completion.
 useEffect(()=>{for(const record of readOfficeStories(storage).filter(s=>s.status==='进行中'))persist({...record,status:'离开办公室时中断'});},[]);
 return {history,error,decide};
}
export function OfficeEventPanel({stories,roster,life,dialogue,selected,onClose}){
 const person=roster.find(p=>p.id===selected);const actor=life.actors.find(a=>a.id===selected);const records=stories.history.filter(s=>!person||s.participants.some(p=>p.sourceKey===person.sourceKey));
 const dialog=useRef(null);useEffect(()=>{dialog.current?.querySelector('button')?.focus();},[]);
 return <div className="ow-overlay ow-observer-overlay"><section ref={dialog} className="ow-event-panel" role="dialog" aria-modal="true" aria-label="办公室动态" onKeyDown={e=>{if(e.key==='Escape')onClose();}}><header><h2>{person?`${person.name} · 观察`:'办公室动态'}</h2><button onClick={onClose} aria-label="关闭办公室动态">×</button></header>
 <small>实时旁观 · 角色会自行行动</small>{person&&actor&&<p className="ow-event-quote">{officeActorStatus(actor,life)}</p>}
 {dialogue.session&&(!person||dialogue.session.participants.some(p=>p.id===person.id))&&<article><h3>{dialogue.session.topic}</h3><small>{dialogue.session.mode==='ai'?'AI 交流':'本地自主交流'}</small>{dialogue.loading?<p>角色正在组织回应…</p>:dialogue.session.status==='error'?<p>AI 交流未完成，角色会自行结束本次交流。</p>:dialogue.session.messages.map((m,i)=><p key={i}><strong>{dialogue.session.participants.find(p=>p.id===m.speaker)?.name}：</strong>{m.text}</p>)}</article>}
 <h3>最近发生的事</h3>{records.length===0&&<p>还没有完整的小剧情。选入至少两位不同角色，他们交流后会自行决定接下来做什么。</p>}{records.slice().reverse().map(record=><article key={record.id}><strong>{record.participants.map(p=>p.name).join('、')}</strong><p>{STORY_ACTIONS[record.action]} · {record.status}</p>{record.reason&&<p>{record.reason}</p>}<details><summary>{record.mode==='ai'?'AI':'本地'} · {record.topic}</summary>{record.messages.map((m,i)=><p key={i}>{record.participants.find(p=>p.id===m.speaker)?.name}：{m.text}</p>)}</details></article>)}{stories.error&&<p role="status">{stories.error}</p>}
 </section></div>;
}
