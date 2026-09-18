import { useEffect, useState } from 'react';
import { Coffee, Monitor, Users, MessageCircle, VolumeX, Sparkles } from 'lucide-react';
import { officeMode, officeCast } from './officeSceneState.js';
import './officeScene.css';

function Room() {
  return <svg className="wo-room" viewBox="0 0 600 510" aria-hidden="true">
    <defs>
      <pattern id="wo-boards" width="60" height="32" patternUnits="userSpaceOnUse" patternTransform="skewY(-7)"><path d="M0 0H60V32" fill="none" stroke="#bda781" strokeOpacity=".25"/></pattern>
      <linearGradient id="wo-glass" x2="0" y2="1"><stop stopColor="#bad6da"/><stop offset="1" stopColor="#e5eee0"/></linearGradient>
    </defs>
    <path d="M20 235 325 158 580 241 285 481Z" fill="#d8c29c"/>
    <path d="M20 235 325 158 580 241 285 481Z" fill="url(#wo-boards)"/>
    <path d="M20 235V86L325 18V158Z" fill="#f1ecdc"/>
    <path d="M325 18 580 104V241L325 158Z" fill="#c8d1bb"/>
    <path d="M20 235 285 481 580 241V258L285 497 20 251Z" fill="#b79c79"/>
    <path d="M48 113 237 71V171L48 214Z" fill="url(#wo-glass)" stroke="#fffcf0" strokeWidth="9"/>
    <path d="M111 99V200M175 85V186" stroke="#fffcf0" strokeWidth="6"/>
    <path d="M53 203 233 162 451 280 263 376Z" fill="#fff5c7" opacity=".23"/>
    <g stroke="#75896f" strokeWidth="3"><path d="M376 64 447 88V144L376 121Z" fill="#f7f1d9"/><path d="m388 89 44 15m-44 1 30 10"/></g>
    <ellipse cx="274" cy="73" rx="19" ry="21" fill="#fffaf0" stroke="#b6bba7" strokeWidth="4"/><path d="M274 59V74l10 5" fill="none" stroke="#61775e" strokeWidth="3"/>
    <g><path d="m53 227 62-18 52 35-63 22Z" fill="#d3b28b"/><path d="M53 227v54l51 33v-48Z" fill="#b79269"/><path d="m104 266 63-22v53l-63 17Z" fill="#9c7d5c"/><path d="m70 235 1 25 21 14v-27Z" fill="#80664e"/><path d="m94 205 24-8 16 11-25 8Z" fill="#344d48"/><path d="M94 205v28l15 9v-26l25-8v27l-25 7" fill="#4e6558"/><path d="m116 221 10-3v12l-10 3" fill="#f6eddb"/><ellipse cx="142" cy="239" rx="8" ry="4" fill="#fff8e4"/><path d="M134 239v9q8 7 16 0v-9" fill="#fff8e4"/></g>
    <g className="wo-plant"><path d="M513 209h36l-6 39h-24Z" fill="#bd8667"/><path d="M531 216v-56" stroke="#6d8263" strokeWidth="4"/><g fill="#7e996d"><ellipse cx="519" cy="185" rx="12" ry="25" transform="rotate(-32 519 185)"/><ellipse cx="543" cy="173" rx="12" ry="26" transform="rotate(35 543 173)"/><ellipse cx="530" cy="155" rx="11" ry="20"/></g></g>
    <path d="m363 223 104 35-71 64-107-40Z" fill="#f0e7cb"/><path d="M306 290v29m141-37v28m-53 18v31" stroke="#8e977d" strokeWidth="8"/><path d="m289 277 105 40 73-59v9l-73 61-105-39Z" fill="#b8bda0"/><path d="m342 254 30 10-16 13-31-11Z" fill="#c7d8c2"/><path d="m387 271 23 8-13 11-24-9Z" fill="#d4ad7c"/>
    <g><path d="M141 321v43m139-39v44m-60 33v29" stroke="#977750" strokeWidth="9"/><path d="m125 310 93-44 95 58-94 57Z" fill="#d1ab79"/><path d="m125 310 94 60 94-46v12l-94 57-94-61Z" fill="#b58b5e"/><path className="wo-monitor" d="m168 276 51-22 1 43-52 25Z" fill="#31524a" stroke="#648178" strokeWidth="5"/><path d="m194 310 15 9-21 10-15-9Z" fill="#75887a"/><path d="m213 338 35-17 23 14-34 18Z" fill="#f2ebd6"/><path d="m224 337 25-12m-17 18 24-12" stroke="#bbc3ad" strokeWidth="2"/><ellipse cx="151" cy="324" rx="8" ry="4" fill="#fff9e6"/></g>
    <path d="m465 330 41 14-58 53-43-17Z" fill="#b8c6a9" opacity=".75"/>
    <path d="M560 180v47m-11-54v49" stroke="#79916f" strokeWidth="4"/>
  </svg>;
}
function Chibi({ person, index, mode, onClick }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [person?.avatar]);
  return <button className={`wo-person wo-person-${index} wo-${mode}`} onClick={onClick} aria-label={person ? `和${person.name}互动` : '我的工位'} style={{ '--coat': ['#567b6e','#b58063','#8099ad','#ada174'][index] }}>
    <span className="wo-shadow"/>{mode === 'typing' && <span className="wo-chair"/>}
    <span key={mode} className="wo-figure">
      <svg className="wo-body" viewBox="0 0 80 100" aria-hidden="true"><g className="wo-legs" stroke="#4d5a52" strokeWidth="10" strokeLinecap="round"><path d="M31 77v14"/><path d="M49 77v14"/></g><path d="M23 48q17-12 34 0l3 31q-20 11-40 0Z" fill="var(--coat)"/><path d="m31 45 9 13 9-13" fill="#fff6e5"/><path d="M40 58v20" stroke="#ffffff55" strokeWidth="2"/><path className="wo-arm wo-arm-left" d="m23 54-8 18" stroke="var(--coat)" strokeWidth="11" strokeLinecap="round"/><path className="wo-arm wo-arm-right" d="m57 54 8 18" stroke="var(--coat)" strokeWidth="11" strokeLinecap="round"/><circle cx="15" cy="73" r="6" fill="#f0cfac"/><circle cx="65" cy="73" r="6" fill="#f0cfac"/></svg>
      <span className="wo-head">{person?.avatar && !failed ? <img src={person.avatar} onError={() => setFailed(true)} alt=""/> : <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="33" r="27" fill="#f6d8b6"/><path d="M5 31Q0 0 33 2q33 1 28 32L49 19 37 27 28 17 17 30Z" fill={index % 2 ? '#77594b' : '#444c42'}/><circle cx="22" cy="36" r="2.5" fill="#38463b"/><circle cx="43" cy="36" r="2.5" fill="#38463b"/><path d="M28 46q5 4 9-1" fill="none" stroke="#a67a61" strokeWidth="2" strokeLinecap="round"/><ellipse cx="15" cy="43" rx="5" ry="3" fill="#e6a896" opacity=".65"/><ellipse cx="50" cy="43" rx="5" ry="3" fill="#e6a896" opacity=".65"/></svg>}</span>
      {mode === 'typing' && <span className="wo-typing-dots">···</span>}{mode === 'coffee' && <span className="wo-cup">☕</span>}
    </span><span className="wo-name">{person?.name || '我'}</span>
  </button>;
}
export function OfficeScene({ career, people, partnerId, activity, onChat, onDesk }) {
  const [place, setPlace] = useState('work');
  const [invitation, setInvitation] = useState(false);
  const [focusedId, setFocusedId] = useState('');
  const cast = officeCast(people, activity ? partnerId : focusedId || partnerId);
  const mode = officeMode(career.project, place, activity);
  const latestScene = career.project.scenes?.at(-1);
  useEffect(() => { setPlace('work'); setInvitation(false); setFocusedId(''); }, [career.day]);
  useEffect(() => {
    if (!career.project.accepted || career.project.delivered || !cast.length) return;
    const timer = setTimeout(() => setInvitation(true), 18000);
    return () => clearTimeout(timer);
  }, [career.day, career.project.accepted, career.project.delivered, cast[0]?.id]);
  const status = { arriving:'新的一天，工位已经准备好了', typing:'键盘轻响，今天的工作正在推进', talking:'靠近一点，一起把事情做好', coffee:'暂时离开屏幕，喝口热饮', leaving:'电脑合上了，今天辛苦啦' }[mode];
  return <section className={`wo-scene wo-scene-${mode}`} aria-label="互动办公室">
    <div className="wo-scene-caption"><span><i/> OFFICE · DAY {String(career.day).padStart(2,'0')}</span><span><VolumeX size={12}/> 静音场景</span></div>
    <div className="wo-stage"><Room/>
      <Chibi index={0} mode={mode} onClick={() => {setPlace('work'); onDesk();}}/>
      {cast.map((p,i) => <Chibi key={p.id} person={p} index={i+1} mode={mode === 'leaving' ? 'leaving' : i === 0 && (mode === 'talking' || mode === 'coffee') ? mode : i === 2 ? 'coffee' : 'typing'} onClick={() => {setFocusedId(p.id);setPlace('meeting');onChat(p.id, '办公室', '我走到你身边，想聊聊你正在做的事。');}}/>)}
      {(activity || (!invitation && latestScene) || (career.project.delivered && latestScene)) && <button className="wo-dialogue" onClick={onDesk}><small>{activity ? cast[0]?.name || '搭档' : latestScene?.personName} · {activity ? '正在回应' : latestScene?.phase === 'finish' ? '收工时刻' : '办公室对白'}</small><span>{activity ? '稍等一下，我想想……' : latestScene?.reply}</span></button>}
      {invitation && !activity && !career.project.delivered && cast[0] && <button className="wo-invitation" onClick={() => {setInvitation(false);setPlace('meeting');onChat(cast[0].id,'办公室','我们休息一下吧，聊聊今天的工作。');}}><MessageCircle size={14}/><span>{cast[0].name}在你身边<small>要不要聊一会儿？</small></span></button>}
    </div>
    <p className="wo-atmosphere" role="status"><Sparkles size={14}/>{status}</p>
    <div className="wo-destinations" aria-label="办公室活动" hidden={career.project.delivered}><button aria-pressed={place === 'work'} onClick={() => {setFocusedId('');setPlace('work');}}><Monitor size={17}/>回到工位</button><button aria-pressed={place === 'meeting'} onClick={() => setPlace('meeting')}><Users size={17}/>一起讨论</button><button aria-pressed={place === 'coffee'} onClick={() => setPlace('coffee')}><Coffee size={17}/>休息一下</button></div>
    {place !== 'work' && !career.project.delivered && <div className="wo-place-note"><span>{place === 'coffee' ? '热饮准备好了，工作计时继续。' : '搭档来到桌边，可以一起讨论今天的工作。'}</span>{cast[0] && <button onClick={() => onChat(cast[0].id,place === 'coffee' ? '茶水间' : '会议桌',place === 'coffee' ? '一起喝杯咖啡吧，你今天心情怎么样？' : '我们一起讨论今天的项目吧。')}>和{cast[0].name}聊聊 →</button>}</div>}
  </section>;
}
