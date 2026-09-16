import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Briefcase, Check, ChevronRight, Coffee, FileText, Globe2, Mail, MessageCircle, Monitor, Send, Users } from 'lucide-react';
import { JOBS, SAVE_KEY, readSources, createCareer, loadCareer, transition, formatWorkTime, WAGES } from './workSimulation.js';
import { requestWorkReply } from './workSimulationApi.js';
import { tryWriteJson } from './storageSafety.js';
import { initializePayroll, remainingWorkMs, formatCountdown, completePaidWork } from './workPayroll.js';
import { getWorkNextStep } from './workNextStep.js';
import './workSimulation.css';

const tabs = [['office', '办公室', Coffee], ['desk', '工作台', Monitor], ['chat', '通讯', MessageCircle], ['career', '职业档案', Briefcase]];
function Avatar({ person }) { return <span className="ws-avatar">{person?.avatar ? <img src={person.avatar} alt="" /> : (person?.name || '人').slice(0, 1)}</span>; }
function OfficeArt() {
  return <svg viewBox="0 0 560 330" className="ws-office-art" aria-hidden="true">
    <defs><pattern id="ws-floor" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="skewX(-25)"><path d="M0 0H36V36" fill="none" stroke="#cfc5ae" strokeWidth=".7" /></pattern><linearGradient id="ws-window"><stop stopColor="#c3dce0"/><stop offset="1" stopColor="#eef4df"/></linearGradient></defs>
    <path d="M30 190 285 315 534 186 281 62Z" fill="#e4dcc8"/><path d="M30 190 285 315 534 186 281 62Z" fill="url(#ws-floor)"/>
    <path d="M30 190V60L281 0V62Z" fill="#ebe8d9"/><path d="M281 0 534 60V186L281 62Z" fill="#d4d9c8"/>
    <path d="M66 78 242 31V91L66 151Z" fill="url(#ws-window)" stroke="#fff9eb" strokeWidth="8"/><path d="M124 61V131M183 47V111" stroke="#fff9eb" strokeWidth="5"/>
    <path d="M77 154 243 99 377 218 230 288Z" fill="#faf6d7" opacity=".42"/>
    <path d="M330 39 414 60V110L330 86Z" fill="#f6f0db" stroke="#9da58f" strokeWidth="4"/><path d="m343 61 51 13m-51 4 34 9" stroke="#acb8a0" strokeWidth="5"/>
    <g fill="#a78158"><path d="M121 195v45l8 4v-45M223 155v45l8 4v-45M276 210v45l8-4v-45"/></g>
    <path d="m110 183 112-45 71 49-116 47Z" fill="#cba577"/><path d="m110 183 67 51v9l-67-51Zm67 51 116-47v9l-116 47Z" fill="#b08b62"/>
    <path d="m164 147 47-18v38l-47 19Z" fill="#344f48" stroke="#597069" strokeWidth="4"/><path d="m185 178 18 7-20 8-15-8Z" fill="#65736a"/>
    <path d="m222 188 27-11 17 10-28 12Z" fill="#f9f7eb"/><path d="m229 188 16-6" stroke="#96a49a" strokeWidth="2"/>
    <ellipse cx="146" cy="201" rx="8" ry="5" fill="#f9f5e7"/><path d="M138 200v10q8 8 16 0v-10" fill="#f9f5e7"/>
    <path d="m326 164 88-40 78 43-91 45Z" fill="#a9b5a0"/><path d="M339 176v35m142-37v35m-81 0v31" stroke="#687b68" strokeWidth="7"/>
    <path d="m364 164 24-11 26 14-24 11Z" fill="#f6f1df"/><path d="m398 159 21-9 21 11-21 10Z" fill="#d2b477"/>
    <g fill="#6b8270"><path d="M333 218q-28-35-37-12v19l30 18Z"/><path d="M450 223q27-33 37-13v18l-31 20Z"/></g>
    <path d="M466 121h28l-5 25h-18Z" fill="#b99a77"/><g fill="#6b8661"><ellipse cx="476" cy="100" rx="10" ry="26" transform="rotate(-25 476 100)"/><ellipse cx="489" cy="99" rx="10" ry="27" transform="rotate(23 489 99)"/></g>
    <path d="m70 176 31 15-1 33-31-15Z" fill="#aa8765"/><path d="m70 176 17-8 32 16-18 7Z" fill="#ccae87"/>
  </svg>;
}

export function WorkSimulation({ onClose }) {
  const [sources, setSources] = useState(() => readSources(window.localStorage));
  const [career, setCareer] = useState(() => initializePayroll(loadCareer(window.localStorage), { id: crypto.randomUUID() }));
  const [setup, setSetup] = useState(false);
  const [worldId, setWorldId] = useState(() => sources[0]?.id || '');
  const [jobId, setJobId] = useState('project');
  const [durationMs, setDurationMs] = useState(300000);
  const [now, setNow] = useState(Date.now());
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const paymentPending = useRef(false);
  const [assignments, setAssignments] = useState({});
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [view, setView] = useState('office');
  const [personId, setPersonId] = useState('');
  const [location, setLocation] = useState('同事工位');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const request = useRef(null);
  const chatEnd = useRef(null);
  const scrollArea = useRef(null);
  const world = sources.find(w => w.id === career?.worldId);
  const selected = sources.find(w => w.id === worldId) || sources[0];
  const people = world?.people || [];
  const person = people.find(p => p.id === personId) || people[0];
  const onboarding = setup || !career;
  useEffect(() => { if (scrollArea.current) scrollArea.current.scrollTop = 0; }, [view, onboarding]);
  useEffect(() => {
    if (!world || !career) return;
    const missing = world.people.filter(p => !Object.hasOwn(career.assignments, p.id));
    if (missing.length) setCareer(s => ({ ...s, assignments: { ...s.assignments, ...Object.fromEntries(missing.map(p => [p.id, p.identity || p.role || '合作伙伴'])) } }));
  }, [world, career]);
  const persist = state => { const result = tryWriteJson(window.localStorage, SAVE_KEY, state); setSaveError(result.ok ? '' : '存储空间不足或不可用，当前进度尚未保存。请保留此页面并重试。'); };
  useEffect(() => { if (career) persist(career); }, [career]);
  useEffect(() => {
    const refresh = event => {
      setSources(readSources(window.localStorage));
      if (event?.key === SAVE_KEY || event?.type === 'focus') {
        const latest = loadCareer(window.localStorage);
        if (latest) setCareer(initializePayroll(latest, { id: crypto.randomUUID() }));
      }
      setNow(Date.now());
    };
    window.addEventListener('focus', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); request.current?.abort(); };
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [career?.chats, view, personId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = remainingWorkMs(career, now);
  const nextStep = career ? getWorkNextStep(career.project, remaining) : null;
  useEffect(() => {
    if (!navigationTarget || view !== 'desk') return;
    const element = scrollArea.current?.querySelector(`#${navigationTarget}`);
    if (element) { element.scrollIntoView({ block: 'center' }); element.focus({ preventScroll: true }); }
    setNavigationTarget(null);
  }, [navigationTarget, view]);
  const goToNextStep = () => { setView('desk'); setNavigationTarget(nextStep.target); };
  const act = type => setCareer(s => transition(s, { type, now: Date.now() }));
  const settle = async () => {
    if (paymentPending.current) return;
    paymentPending.current = true; setPaying(true); setPayError('');
    const work = () => {
      const saved = loadCareer(window.localStorage);
      if (!saved || saved.payrollId !== career.payrollId || saved.day !== career.day) throw new Error('工作存档已在其他页面更新，请重新打开工作。');
      setCareer(completePaidWork(window.localStorage, saved));
    };
    try {
      if (navigator.locks) await navigator.locks.request('ccat-work-salary', work);
      else work();
    } catch (err) {
      const saved = loadCareer(window.localStorage);
      if (saved?.payrollId === career.payrollId) setCareer(saved);
      setPayError(err.message);
    } finally { paymentPending.current = false; setPaying(false); }
  };
  const openChat = (id, place = '同事工位', text = '') => { setPersonId(id || people[0]?.id || ''); setLocation(place); setInput(text); setError(''); setView('chat'); };
  const start = () => {
    if (!selected) return;
    if (career && !window.confirm('开始新的职业会替换当前工作存档。世界书和原人物不会改变。继续吗？')) return;
    setCareer(initializePayroll(createCareer(selected, selected.people, jobId, assignments), { id: crypto.randomUUID(), durationMs })); setSetup(false); setView('office'); setInput(''); setError('');
  };
  const send = async e => {
    e?.preventDefault(); if (!input.trim() || busy || !person || !world) return;
    const text = input.trim(); const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const reply = await requestWorkReply({ storage: window.localStorage, world, character: person, career, text: `【${location}】${text}`, signal: controller.signal });
      if (!controller.signal.aborted) { setCareer(s => transition(s, { type: 'chat', personId: person.id, text, reply })); setInput(''); }
    } catch (err) { setError(err.name === 'AbortError' ? '等待超时或已取消，输入已保留，可再次发送。' : err.message); }
    finally { clearTimeout(timeout); request.current = null; setBusy(false); }
  };
  const progress = career ? [career.project.accepted, career.project.researched, career.project.reviewed, career.project.delivered].filter(Boolean).length : 0;
  return <section className="full-page ws-app" aria-label="工作模拟">
    <header className="ws-header"><button className="ws-icon" onClick={onClose} aria-label="返回桌面"><ArrowLeft size={20}/></button><span className="ws-wordmark">工作室 <small>WORK / LIFE</small></span><span className="ws-header-day">{career && !onboarding ? `DAY ${String(career.day).padStart(2, '0')}` : '新的篇章'}</span></header>
    {saveError && <div role="alert" className="ws-alert">{saveError}<button onClick={() => persist(career)}>重试保存</button></div>}
    <main className="ws-scroll" ref={scrollArea}>
      {onboarding ? <div className="ws-onboarding">
        <div className="ws-eyebrow">A PLACE TO BEGIN</div><h1>在你的世界里，<br/>开始一个工作日。</h1><p className="ws-muted">熟悉的人物，新的共同经历。<br/>从一项小小的工作，走进彼此的日常。</p>
        <div className="ws-welcome-art"><OfficeArt/><span>你的工位，已经准备好了。</span></div>
        {!sources.length ? <div className="ws-paper"><Globe2/><h2>先建立你的世界</h2><p>还没有可读取的世界书。请返回桌面，在「世界书」中保存一个世界，并在角色资料里关联人物。</p><button className="ws-primary" onClick={onClose}>返回桌面</button><button className="ws-secondary" onClick={() => setSources(readSources(window.localStorage))}>重新读取</button></div> : <>
          <label className="ws-label">01 / 选择世界<select value={selected?.id || ''} onChange={e => { setWorldId(e.target.value); setAssignments({}); }}>{sources.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <p className="ws-world-note">{selected?.tone || selected?.note || '沿用世界书中的背景与关联人物。'}</p>
          <div className="ws-label">02 / 选择体验岗位</div><div className="ws-jobs">{JOBS.map(j => <button key={j.id} className={jobId === j.id ? 'selected' : ''} onClick={() => setJobId(j.id)}><Briefcase size={18}/><span><strong>{j.name}</strong><small>{j.subtitle} · ¥{WAGES[j.id]} / 天</small></span>{jobId === j.id && <Check size={17}/>}</button>)}</div>
          <label className="ws-label">每项工作倒计时<select value={durationMs} onChange={e => setDurationMs(Number(e.target.value))}><option value={60000}>1 分钟 · 快速体验</option><option value={300000}>5 分钟 · 标准工作</option><option value={900000}>15 分钟 · 专注工作</option></select></label><p className="ws-muted">确认需求后开始倒计时。到时并交付成果，工资自动进入钱包。</p><div className="ws-label">03 / 人物与职场安排</div><p className="ws-muted">以下为可调整的模拟安排，原人物身份保持不变。</p>
          {selected?.people.length ? selected.people.map(c => <label className="ws-assignment" key={c.id}><Avatar person={c}/><span><strong>{c.name}</strong><small>{c.identity || c.role || '世界书关联人物'}</small></span><input aria-label={`${c.name}的职场安排`} value={assignments[c.id] ?? c.identity ?? c.role ?? '合作伙伴'} maxLength={60} onChange={e => setAssignments(a => ({ ...a, [c.id]: e.target.value }))}/></label>) : <p className="ws-paper">这个世界还没有关联人物。可以先体验工作流程，之后在角色 APP 关联人物，他们就会出现在这里。</p>}
          <button className="ws-primary ws-start" onClick={start}>开始我的工作日 <ArrowUpRight size={18}/></button>{career && <button className="ws-secondary" onClick={() => setSetup(false)}>返回当前职业</button>}
        </>}
      </div> : !world ? <div className="ws-paper"><h1>暂时找不到关联世界</h1><p>当前职业存档仍然保留。请在世界书中恢复「{career.worldName}」，或开始新的职业。</p><button className="ws-primary" onClick={onClose}>返回桌面</button><button className="ws-secondary" onClick={() => setSetup(true)}>选择其他世界</button></div> : <>
        {(view === 'office' || view === 'desk') && <section className="ws-payroll" aria-label="工资与工作倒计时"><div><small>{career.project.salaryPaid ? '本日已结算' : '本日工资'}</small><strong>¥{career.project.wage}</strong><span>{career.project.salaryPaid ? '已进入钱包' : '完成交付后进入钱包'}</span></div><div className="ws-countdown"><small>{career.project.delivered ? '工作已完成' : career.project.accepted ? remaining ? '工作进行中' : '计时完成，等待交付' : '确认需求后开始'}</small><strong role="timer" aria-label="剩余工作时间">{formatCountdown(remaining)}</strong><progress aria-label="工作计时进度" value={career.project.delivered ? 1 : 1 - remaining / career.workDurationMs} max="1"/></div></section>}
        {(view === 'office' || view === 'desk') && <aside className="ws-next-step"><p>{nextStep.hint}</p>{nextStep.target && <button className="ws-secondary" onClick={goToNextStep}>{nextStep.label}<ChevronRight size={16}/></button>}</aside>}
        {view === 'office' && <>
          <div className="ws-page-heading"><div><div className="ws-eyebrow">{world.name} / 日常进行中</div><h1>今天，也一起努力。</h1></div><span className="ws-clock">{formatWorkTime(career.minutes)}<small>行动推进时间</small></span></div>
          <div className="ws-office"><div className="ws-room-caption"><span><i/> 我的办公室</span><button onClick={() => setShowLore(!showLore)}><BookOpen size={14}/> 世界资料</button></div><OfficeArt/>
            <button className="ws-hotspot ws-hotspot-desk" onClick={() => setView('desk')}><Monitor size={14}/> 我的工位 <ChevronRight size={13}/></button>
            <button className="ws-hotspot ws-hotspot-meet" onClick={() => openChat(null, '会议室', '我们一起讨论一下今天的项目目标和安排吧。')}><Users size={14}/> 会议室</button>
            <button className="ws-hotspot ws-hotspot-coffee" onClick={() => openChat(null, '茶水间', '稍微休息一下，你今天过得怎么样？')}><Coffee size={14}/> 茶水间</button>
            <span className="ws-room-footer">点击场景，开始互动</span>
          </div>
          {showLore && <article className="ws-paper ws-lore"><h2>{world.name}</h2><p>{world.tone || world.note || '世界简介尚未填写。'}</p><p className="ws-muted">{Array.isArray(world.tags) ? world.tags.join(' · ') : world.genre}</p><details><summary>查看世界记忆</summary><pre>{JSON.stringify(world.memories || [], null, 2)}</pre></details></article>}
          <div className="ws-section-title"><h2>今日工作</h2><span>0{progress} / 04</span></div>
          <button className="ws-project-card" onClick={() => setView('desk')}><span className="ws-project-icon"><FileText size={24}/></span><span><small>{career.project.delivered ? '已交付 · 可以收工' : '进行中的项目'}</small><strong>{career.project.title}</strong><span className="ws-progress"><i style={{ width: `${progress * 25}%` }}/></span></span><ArrowUpRight size={20}/></button>
          <div className="ws-section-title"><h2>办公室里的大家</h2><span>{people.length} 位人物</span></div>
          <div className="ws-people">{people.map((c, i) => <button key={c.id} onClick={() => openChat(c.id)}><Avatar person={c}/><span><strong>{c.name}</strong><small>{career.assignments[c.id] || c.identity || '合作伙伴'}</small></span><span className="ws-person-state">{['整理资料', '准备讨论', '工间休息'][(i + career.day - 1 + Math.floor((career.minutes - 540) / 30)) % 3]}</span></button>)}{!people.length && <p className="ws-muted">在角色 APP 中关联这个世界，人物就会出现在办公室。</p>}</div>
        </>}
        {view === 'desk' && <>
          <div className="ws-eyebrow">MAKE SOMETHING HAPPEN</div><h1>我的工作台</h1><p className="ws-muted">把想法落在纸上，把今天向前推进一点。</p>
          <article className="ws-paper"><div className="ws-section-title"><span className="ws-eyebrow">收件箱 / 今日委托</span><Mail size={18}/></div><h2>{career.project.title}</h2><p>{career.project.brief}</p><p className="ws-muted">这是根据所选岗位生成的模拟委托。涉及世界设定的具体内容，请参考世界书并向人物核实。</p><button id="ws-brief" className="ws-primary" disabled={career.project.accepted} onClick={() => act('brief')}>{career.project.accepted ? '已确认需求' : '确认需求，开始计时'}<Check size={16}/></button></article>
          <div className="ws-task-line"><span className={career.project.accepted ? 'done' : ''}>1 需求</span><span className={career.project.researched ? 'done' : ''}>2 资料</span><span className={career.project.reviewed ? 'done' : ''}>3 检查</span><span className={career.project.delivered ? 'done' : ''}>4 交付</span></div>
          <article className="ws-paper"><h2>资料与待办</h2><p>{world.tone || world.note || '世界书还没有简介，可以向关联人物了解具体背景。'}</p><button id="ws-research" className="ws-secondary" disabled={!career.project.accepted || career.project.researched} onClick={() => act('research')}>{career.project.researched ? '资料已整理' : '整理背景资料'}</button>{career.project.researched && <div className="ws-event"><strong>一件需要你处理的小事</strong><p>{career.project.event}</p><button onClick={() => openChat(null, '同事工位', `关于今天的项目：${career.project.event} 你有什么建议？`)}>找人物商量 <ChevronRight size={14}/></button></div>}</article>
          <article className="ws-paper ws-editor"><div className="ws-section-title"><h2>方案草稿</h2><span>{career.project.draft.length} 字</span></div><label className="ws-muted" htmlFor="ws-draft">写下目标、安排和备选方案（至少 30 字）。草稿随进度保存。</label><textarea id="ws-draft" value={career.project.draft} disabled={career.project.delivered} maxLength={12000} placeholder={'工作目标：\n\n具体安排：\n\n遇到问题时：'} onChange={e => setCareer(s => transition(s, { type: 'draft', text: e.target.value }))}/>
            <p className="ws-muted">{!career.project.researched ? '请先完成资料整理。' : career.project.draft.trim().length < 30 ? `草稿还需 ${30 - career.project.draft.trim().length} 字，才能检查。` : career.project.reviewed ? '检查已通过，可在倒计时结束后交付。' : '现在可以检查；检查即时完成，不需要再等 30 分钟。'}</p><div className="ws-actions"><button id="ws-review" className="ws-secondary" disabled={!career.project.researched || career.project.draft.trim().length < 30 || career.project.reviewed || career.project.delivered} onClick={() => act('review')}>{career.project.reviewed ? '检查已通过' : '交付前检查'}</button><button className="ws-secondary" disabled={!career.project.draft.trim() || !people.length} onClick={() => openChat(null, '会议室', `请帮我评审这份工作方案，指出一个具体问题和一个改进建议：\n${career.project.draft}`)}>请人物评审</button></div>
            {career.project.feedback && <p className="ws-feedback">{career.project.feedback}</p>}<button id="ws-delivery" className="ws-primary" disabled={paying || !career.project.reviewed || remaining > 0 || career.project.salaryPaid} onClick={settle}>{paying ? '正在结算…' : career.project.salaryPaid ? '工资已到账 · 成果已归档' : career.project.delivered ? '重试工资结算' : remaining > 0 ? `工作中 · 剩余 ${formatCountdown(remaining)}` : `提交成果，领取 ¥${career.project.wage}`}<ArrowUpRight size={16}/></button>{payError && <p className="ws-alert" role="alert">{payError}</p>}
          </article>{career.project.delivered && career.project.salaryPaid && <button id="ws-next-day" className="ws-primary ws-start" onClick={() => { act('nextDay'); setView('office'); }}>收工，开始下一天 <ChevronRight size={18}/></button>}
        </>}
        {view === 'chat' && <div className="ws-chat"><div className="ws-eyebrow">A LITTLE CONVERSATION</div><h1>工作，也有人情味。</h1>
          {!people.length ? <div className="ws-paper"><h2>等待伙伴加入</h2><p>请在角色 APP 中将人物关联到「{world.name}」，再次打开工作即可读取。</p><button className="ws-secondary" onClick={() => setView('desk')}>先处理手头工作</button></div> : <>
            <label className="ws-label">和谁聊聊<select disabled={busy} value={person?.id || ''} onChange={e => { setPersonId(e.target.value); setInput(''); setError(''); }}>{people.map(c => <option key={c.id} value={c.id}>{c.name} · {career.assignments[c.id] || c.identity || '合作伙伴'}</option>)}</select></label>
            <div className="ws-chat-person"><Avatar person={person}/><span><strong>{person?.name}</strong><small>{location} · 仅对方可见的对话</small></span></div>
            <div className="ws-conversation" aria-live="polite">{!(career.chats[person.id] || []).length && <div className="ws-chat-empty"><MessageCircle size={28}/><p>从一句问候，或一件工作开始。</p><small>人物将依据世界书与自身设定回应。</small></div>}{(career.chats[person.id] || []).map((m, i) => <div key={i} className={`ws-bubble ${m.from === 'me' ? 'mine' : ''}`}><small>{m.from === 'me' ? '我' : person.name}</small><p>{m.text}</p></div>)}{busy && <p className="ws-muted">正在等待回应… <button onClick={() => request.current?.abort()}>取消</button></p>}<div ref={chatEnd}/></div>
            <div className="ws-quick">{['今天有什么需要我帮忙的？', '这个项目你有什么建议？', '一起休息一下吧。'].map(t => <button disabled={busy} key={t} onClick={() => setInput(t)}>{t}</button>)}</div>
            {error && <p className="ws-alert" role="alert">{error}</p>}<form className="ws-compose" onSubmit={send}><textarea aria-label="给人物发送消息" placeholder="说点什么，也可以提出工作请求…" value={input} maxLength={14000} disabled={busy} onChange={e => setInput(e.target.value)}/><button className="ws-primary" disabled={busy || !input.trim()} aria-label="发送消息"><Send size={18}/></button></form><p className="ws-muted ws-tiny">使用设置中的主 API；成功对话推进 10 分钟。</p>
          </>}
        </div>}
        {view === 'career' && <><div className="ws-eyebrow">YOUR DAYS, YOUR STORY</div><h1>每一天，都算数。</h1><article className="ws-career-card"><Briefcase size={25}/><small>{world.name}</small><h2>{JOBS.find(j => j.id === career.jobId)?.name}</h2><div><span><strong>{career.day}</strong>工作日</span><span><strong>{career.completed}</strong>已交付</span><span><strong>{Object.values(career.relations).reduce((a, b) => a + b, 0)}</strong>共同对话</span></div></article>
          <div className="ws-section-title"><h2>留下的成果</h2><span>独立职业存档</span></div>{career.history.length ? career.history.slice().reverse().map((h, i) => <details className="ws-paper" key={i}><summary>DAY {h.day} · {h.title}</summary><p className="ws-preserve">{h.draft}</p></details>) : <p className="ws-paper ws-muted">第一份成果，正在路上。完成交付后会保存在这里。</p>}
          <h2>工作足迹</h2><div className="ws-timeline">{career.log.slice(-12).reverse().map((l, i) => <div key={i}><small>DAY {l.day}</small><p>{l.text}</p></div>)}</div><p className="ws-muted">世界书与原人物资料保持不变。当前浏览器保存一份职业进度。</p><button className="ws-secondary" disabled={paying || (career.project.delivered && !career.project.salaryPaid)} onClick={() => setSetup(true)}>体验另一份职业</button>
        </>}
      </>}
    </main>
    {!onboarding && world && <nav className="ws-nav" aria-label="工作导航">{tabs.map(([id, label, Icon]) => <button key={id} disabled={busy && id !== 'chat'} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}><Icon size={21}/><span>{label}</span>{view === id && <i/>}</button>)}</nav>}
  </section>;
}
