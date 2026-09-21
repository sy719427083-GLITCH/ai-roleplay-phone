import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { advanceOfficeLife, createOfficeLife, assignOfficeTask, syncOfficeRoster } from './officeLife.js';

export function useOfficeLife(roster, paused, control) {
  const [life,setLife]=useState(()=>createOfficeLife(Date.now(),roster));
  const current=useRef(life);
  const people=useRef(roster);
  const [reducedMotion,setReducedMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useLayoutEffect(()=>{people.current=roster;current.current=syncOfficeRoster(current.current,roster);setLife(current.current);},[roster]);
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReducedMotion(query.matches);
    query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    if(paused)return;
    let frame=0,last=null,accumulated=0,stopped=false;
    const tick=time=>{
      if(stopped || document.hidden)return;
      if(last!==null)accumulated+=time-last;
      last=time;
      if(accumulated>=70){
        current.current=advanceOfficeLife(current.current,accumulated,people.current,control?.current?.holdGroup);
        setLife(current.current);accumulated=0;
      }
      frame=requestAnimationFrame(tick);
    };
    const visibility=()=>{
      cancelAnimationFrame(frame);last=null;accumulated=0;
      if(!document.hidden)frame=requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange',visibility);visibility();
    return()=>{stopped=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
  },[paused]);
  const assign=(manager,employee,text)=>{current.current=assignOfficeTask(current.current,manager,employee,text,people.current);setLife(current.current);};
  return {life,reducedMotion,assign};
}
