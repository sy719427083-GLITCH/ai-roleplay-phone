import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, Settings, FolderClosed, Clock3, UsersRound } from 'lucide-react';
import { OFFICE_SEATS, readOfficeSources, readOfficeAvatars, resolveSeat, saveOfficeAvatar } from './officeProfiles.js';
import { OfficeAvatar, OfficeAvatarEditor } from './OfficeAvatarEditor.jsx';
import './workOffice.css';
const asset = name => `${import.meta.env.BASE_URL}office-white/${name}.webp`;
const storage = () => {try{return window.localStorage;}catch{return undefined;}};
const seatLabel = id => id === 'boss' ? '老板' : `员工${id.split('-')[1].padStart(2,'0')}`;
const destinations = [['projects','项目管理',FolderClosed],['countdown','工作倒计时',Clock3],['employees','员工管理',UsersRound]];
function Prop({name,image,className}) {
  const [pressed,setPressed]=useState(false);const timeout=useRef();
  useEffect(()=>()=>clearTimeout(timeout.current),[]);
  return <button className={`ow-prop ${className} ${pressed?'ow-pop':''}`} aria-label={name} onClick={()=>{clearTimeout(timeout.current);setPressed(true);timeout.current=setTimeout(()=>setPressed(false),220);}}><img src={asset(image)} alt="" draggable="false"/></button>;
}
export function WorkOffice({onClose}) {
  const [sources,setSources]=useState(()=>readOfficeSources(storage()));
  const [seats,setSeats]=useState(()=>readOfficeAvatars(storage()));
  const [editing,setEditing]=useState(null);const [page,setPage]=useState('');const [menu,setMenu]=useState(false);const menuRef=useRef(null);
  useEffect(()=>{const refresh=()=>{setSources(readOfficeSources(storage()));setSeats(readOfficeAvatars(storage()));};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[]);
  useEffect(()=>{if(!menu)return;const close=e=>{if(!menuRef.current?.contains(e.target))setMenu(false);};const key=e=>{if(e.key==='Escape'){setMenu(false);menuRef.current?.querySelector('button')?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[menu]);
  const title=page==='settings'?'设置':destinations.find(([id])=>id===page)?.[1] || '工作';
  return <section className="full-page ow-app" aria-label="工作办公室">
    <header className="ow-header"><button className="ow-icon" aria-label={page?'返回办公室':'返回桌面'} onClick={()=>page?setPage(''):onClose()}><ArrowLeft size={23}/></button><h1>{title}</h1>
      {!page?<div className="ow-menu-anchor" ref={menuRef}><button className="ow-icon" aria-label="更多选项" aria-expanded={menu} aria-controls="ow-menu" onClick={()=>setMenu(v=>!v)}><MoreHorizontal size={24}/></button>{menu&&<div className="ow-menu" id="ow-menu"><button onClick={()=>{setMenu(false);setPage('settings');}}><Settings size={17}/>设置</button></div>}</div>:<span/>}
    </header>
    {page?<main className="ow-empty" aria-label={`${title}内容`}/>:<>
      <main className="ow-floor" aria-label="办公室场景">
        <div className="ow-stage">
          <img className="ow-room" src={asset('room')} alt="" draggable="false"/>
          <Prop name="办公室挂钟" image="clock" className="ow-clock"/>
          <Prop name="办公白板" image="whiteboard" className="ow-whiteboard"/>
          <Prop name="茶水吧台" image="tea" className="ow-tea"/>
          <Prop name="打印机与文件柜" image="cabinet" className="ow-cabinet-left"/>
          <Prop name="办公收纳柜" image="cabinet" className="ow-cabinet-right"/>
          <Prop name="窗边绿植" image="plant" className="ow-plant-top"/>
          <Prop name="办公室绿植" image="plant" className="ow-plant-bottom"/>
          {OFFICE_SEATS.map((id,index)=>{const person=resolveSeat(id,seats,sources);const label=seatLabel(id);return <div key={id} className={`ow-seat ow-seat-${index}`}>
            <Prop name={`${label}办公桌`} image="desk" className="ow-desk"/>
            <button className="ow-person" aria-label={`更换${label}头像${person.name?` · ${person.name}`:''}`} title={person.name || `更换${label}头像`} onClick={()=>setEditing(id)}><OfficeAvatar src={person.avatar}/><span>{label}</span></button>
          </div>;})}
        </div>
      </main>
      <nav className="ow-nav" aria-label="工作导航">{destinations.map(([id,label,Icon])=><button key={id} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
    </>}
    {editing&&<OfficeAvatarEditor key={editing} seat={editing} label={seatLabel(editing)} person={resolveSeat(editing,seats,sources)} saved={seats[editing]} sources={sources} onClose={()=>setEditing(null)} onSave={(id,entry)=>{const result=saveOfficeAvatar(storage(),seats,id,entry);if(result.ok)setSeats(result.seats);return result;}}/>}
  </section>;
}
