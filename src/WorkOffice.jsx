import { useOfficeStories, OfficeEventPanel } from './OfficeEvents.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, Settings, FolderClosed, Clock3, UsersRound } from 'lucide-react';
import { readOfficeSources, readOfficeAvatars, resolveSeat, saveOfficeAvatar } from './officeProfiles.js';
import { OfficeAvatarEditor } from './OfficeAvatarEditor.jsx';
import { OFFICE_OBJECTS, OFFICE_DESKS, objectStyle } from './officeSceneLayout.js';
import { OfficeActors } from './OfficeActors.jsx';
import { useOfficeLife } from './useOfficeLife.js';
import { readOfficeTeam, saveOfficeTeam, officeTeamForRoster } from './officeTeam.js';
import { useOfficeDialogue } from './useOfficeDialogue.js';
import { OfficeSettings, OfficeTeamPanel, OfficeTranscript } from './OfficeTeamPanel.jsx';
import { OfficeProjects } from './OfficeProjects.jsx';
import { OfficeCountdown } from './OfficeCountdown.jsx';
import { useOfficeWork } from './OfficeWorkContext.jsx';
import { remainingJobMs, jobCountdown } from './officeJobs.js';
import './workOffice.css';
const asset = name => `${import.meta.env.BASE_URL}office-white/${name}.webp`;
const storage = () => {try{return window.localStorage;}catch{return undefined;}};
const seatLabel = id => id === 'boss' ? '老板' : `员工${id.split('-')[1].padStart(2,'0')}`;
const destinations = [['projects','项目管理',FolderClosed],['countdown','工作倒计时',Clock3],['employees','员工管理',UsersRound]];
function SceneObject({ object }) {
  const [pressed,setPressed]=useState(false);
  const timeout=useRef();
  useEffect(()=>()=>clearTimeout(timeout.current),[]);
  return <button className={`ow-scene-object ${pressed?'ow-pop':''}`} style={objectStyle(object)} aria-label={object.name} onClick={()=>{
    clearTimeout(timeout.current);setPressed(true);
    timeout.current=setTimeout(()=>setPressed(false),220);
  }}/>;
}
export function WorkOffice({onClose}) {
  const work=useOfficeWork();
  const activeJobs=work.jobs.filter(j=>!j.paid);
  const nextJob=activeJobs.slice().sort((a,b)=>a.endsAt-b.endsAt)[0];
  const [team,setTeam]=useState(()=>readOfficeTeam(storage()));
  const [teamError,setTeamError]=useState('');const [notice,setNotice]=useState('');const [transcript,setTranscript]=useState(false);const control=useRef({holdGroup:null});
  const updateTeam=value=>{const result=saveOfficeTeam(storage(),value);if(result.ok){setTeam(result.team);setTeamError('');}else setTeamError(result.error);};
  const [sources,setSources]=useState(()=>readOfficeSources(storage()));
  const [seats,setSeats]=useState(()=>readOfficeAvatars(storage()));
  const [eventOpen,setEventOpen]=useState(false);const [observed,setObserved]=useState(null);
  const [editing,setEditing]=useState(null);const [page,setPage]=useState('');const [menu,setMenu]=useState(false);const menuRef=useRef(null);
  const visibleTeam=useMemo(()=>officeTeamForRoster(team,OFFICE_DESKS.filter(({id})=>resolveSeat(id,seats,sources).sourceKey).map(d=>d.id)),[team,seats,sources]);
  const allSeats=useMemo(()=>OFFICE_DESKS.map(({id})=>{
    const person=resolveSeat(id,seats,sources);const label=seatLabel(id);
    return {...person,id,label,name:person.name || label,identity:person.sourceKey || id,role:id==='boss'?'boss':team.roles[id],managerId:id==='boss'?null:visibleTeam.managers[id]};
  }),[seats,sources,team,visibleTeam]);
  const roster=useMemo(()=>allSeats.filter(person=>person.sourceKey),[allSeats]);
  const selectPerson=(id,sourceKey)=>{
    const result=saveOfficeAvatar(storage(),seats,id,{sourceKey,avatar:seats[id]?.sourceKey===sourceKey?seats[id]?.avatar:''});
    if(result.ok){setSeats(result.seats);setTeamError('');}else setTeamError(result.error);
  };
  const {life,reducedMotion,assign,follow}=useOfficeLife(roster,Boolean(editing || page || menu),control);
  const stories=useOfficeStories({storage:storage(),roster,life,follow});
  const dialogue=useOfficeDialogue({life,roster,mode:team.mode,storage:storage(),control,suspended:Boolean(page||editing||menu),onDecision:stories.decide});
  useEffect(()=>{const refresh=()=>{setSources(readOfficeSources(storage()));setSeats(readOfficeAvatars(storage()));setTeam(readOfficeTeam(storage()));};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[]);
  useEffect(()=>{if(!menu)return;const close=e=>{if(!menuRef.current?.contains(e.target))setMenu(false);};const key=e=>{if(e.key==='Escape'){setMenu(false);menuRef.current?.querySelector('button')?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[menu]);
  const title=page==='settings'?'设置':destinations.find(([id])=>id===page)?.[1] || '工作';
  return <section className="full-page ow-app" aria-label="工作办公室">
    {page!=='projects'&&<header className="ow-header"><button className="ow-icon" aria-label={page?'返回办公室':'返回桌面'} onClick={()=>page?setPage(''):onClose()}><ArrowLeft size={23}/></button><h1>{title}</h1>
      {!page?<div className="ow-menu-anchor" ref={menuRef}><button className="ow-icon" aria-label="更多选项" aria-expanded={menu} aria-controls="ow-menu" onClick={()=>setMenu(v=>!v)}><MoreHorizontal size={24}/></button>{menu&&<div className="ow-menu" id="ow-menu"><button onClick={()=>{setMenu(false);setPage('settings');}}><Settings size={17}/>设置</button></div>}</div>:<span/>}
    </header>}
    {page==='projects'?<OfficeProjects storage={storage()} onBack={()=>setPage('')} onCountdown={()=>setPage('countdown')}/>:page==='countdown'?<OfficeCountdown onProjects={()=>setPage('projects')}/>:page==='settings'?<OfficeSettings team={team} onChange={updateTeam} error={teamError}/>:page==='employees'?<OfficeTeamPanel team={visibleTeam} roster={allSeats} sources={sources} onSelect={selectPerson} onChange={updateTeam} onEdit={setEditing} notice={notice} error={teamError} onAssign={(manager,employee,task)=>{assign(manager,employee,task);setNotice(`已安排${roster.find(p=>p.id===employee).name}：${task}，返回办公室后执行。`);}}/>:page?<main className="ow-empty" aria-label={`${title}内容`}/>:<>
      <button className="ow-dialogue-toggle" onClick={()=>setTranscript(true)}>{team.mode==='ai'?'AI 交流':'本地交流'} · {dialogue.session?.status==='error'?'交流失败，查看原因':dialogue.loading?'正在生成…':'查看交流内容'}</button>
      <button className="ow-event-inbox" onClick={()=>{setObserved(null);setEventOpen(true);}}>办公室动态 · 自主进行中</button>
      <main className="ow-floor" aria-label="办公室场景">
        <div className="ow-stage" style={{'--ow-scene-image':`url("${asset('scene-atlas')}")`}}>
          <img className="ow-room" src={asset('scene-atlas')} alt="" draggable="false"/>
          {OFFICE_OBJECTS.map(object=><SceneObject key={object.id} object={object}/>)}
          {OFFICE_DESKS.map(({id,box})=><SceneObject key={id} object={{box,name:`${seatLabel(id)}办公桌`}}/>)}
          <OfficeActors life={life} roster={roster} reducedMotion={reducedMotion} onEdit={setEditing} dialogue={dialogue} onObserve={id=>{setObserved(id);setEventOpen(true);}}/>
        </div>
      </main>
      <nav className="ow-nav" aria-label="工作导航">{destinations.map(([id,label,Icon])=><button key={id} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span>{id==='countdown'&&nextJob&&<small className="ow-nav-countdown">{activeJobs.length} 个 · {jobCountdown(remainingJobMs(nextJob,work.now))}</small>}</button>)}</nav>
    </>}
    {eventOpen&&<OfficeEventPanel stories={stories} roster={roster} life={life} dialogue={dialogue} selected={observed} onClose={()=>setEventOpen(false)}/>}
    {transcript&&<OfficeTranscript dialogue={dialogue} onClose={()=>setTranscript(false)}/>}
    {editing&&<OfficeAvatarEditor key={editing} seat={editing} label={seatLabel(editing)} person={resolveSeat(editing,seats,sources)} saved={seats[editing]} sources={sources} onClose={()=>setEditing(null)} onSave={(id,entry)=>{const result=saveOfficeAvatar(storage(),seats,id,entry);if(result.ok)setSeats(result.seats);return result;}}/>}
  </section>;
}
