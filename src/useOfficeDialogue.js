import { useEffect, useRef, useState } from 'react';
import { localOfficeDialogue, requestOfficeDialogue } from './officeDialogue.js';
export function useOfficeDialogue({life,roster,mode,storage,control,suspended}) {
  const [session,setSession]=useState(null);
  const [retry,setRetry]=useState(0);
  const latestNow=useRef(life.now);latestNow.current=life.now;
  const lastRequest=useRef(0);
  const suspendedRef=useRef(suspended);suspendedRef.current=suspended;
  const actor=life.actors.find(a=>a.task==='chat'&&a.phase==='active'&&!a.cancelChat&&roster.some(p=>p.id===a.id));
  const group=actor?.group;
  const participants=group?life.actors.filter(a=>a.group===group&&roster.some(p=>p.id===a.id)).map(a=>({...roster.find(p=>p.id===a.id),currentTask:a.pendingTask?.text||a.workLine})):[];
  const participantsRef=useRef(participants);participantsRef.current=participants;
  const signature=group?JSON.stringify([group,mode,participants.map(p=>[p.id,p.identity,p.role,p.managerId]),actor.activity?.label]):'';
  useEffect(()=>{
    if(!signature){setSession(previous=>previous?.status==='loading'?{...previous,status:'ended'}:previous);return;}
    const controller=new AbortController();let alive=true;let timer;let launch;
    const start={key:signature,group,mode,participants:participants.map(p=>({id:p.id,name:p.name})),topic:actor.activity?.label||'工作交流',status:'loading',messages:[]};
    setSession(start);
    const begin=async()=>{
      if(document.hidden||suspendedRef.current){launch=setTimeout(begin,1000);return;}
      try{
        if(mode==='ai')lastRequest.current=Date.now();
        timer=setTimeout(()=>controller.abort(),45000);
        const messages=mode==='ai'?await requestOfficeDialogue({storage,participants:participantsRef.current,topic:start.topic,signal:controller.signal}):localOfficeDialogue(participants,start.topic);
        if(alive)setSession({...start,status:'ready',messages,startedAt:latestNow.current});
      }catch(error){if(alive)setSession({...start,status:'error',errorAt:latestNow.current,error:controller.signal.aborted?'AI 交流超时，请重试。':error.message});}
      finally{clearTimeout(timer);}
    };
    // Defer dispatch so StrictMode's setup/cleanup probe never sends an extra request.
    launch=setTimeout(begin,mode==='ai'?Math.max(0,lastRequest.current+60000-Date.now()):0);
    return()=>{alive=false;clearTimeout(launch);clearTimeout(timer);controller.abort();};
  },[signature,retry]);
  const current=session?.key===signature?session:null;
  const index=current?.status==='ready'?Math.floor((life.now-current.startedAt)/5500):-1;
  const line=index>=0?current.messages[index]:null;
  control.current.holdGroup=group&&(!current||current.status==='loading'||Boolean(line)||(current.status==='error'&&life.now-current.errorAt<90000))?group:null;
  return {session,line,loading:current?.status==='loading',group,retry:()=>setRetry(v=>v+1),canRetry:current?.status==='error',end:()=>setSession(s=>s?{...s,status:'ended'}:s)};
}
