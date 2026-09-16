import { useEffect, useRef, useState } from 'react';
import { Coffee, MessageCircle, ArrowUpRight, Users, Check } from 'lucide-react';
import { requestWorkReply } from './workSimulationApi.js';
import { WORK_APPROACHES, makeRoleWorkPrompt } from './workRoleShift.js';
import { formatCountdown } from './workPayroll.js';

export function WorkShift({ career, world, people, remaining, onBegin, onScene, onFinish, onNextDay, onChat, paying, payError }) {
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(null);
  const project = career.project;
  const scenes = project.scenes || [];
  const recorded = scenes.find(s => s.phase === 'intro' || s.phase === 'support');
  const partner = people.find(p => p.id === (recorded?.personId || chosen)) || people[(career.day - 1) % Math.max(1, people.length)];
  const supported = scenes.find(s => s.phase === 'support');
  useEffect(() => () => pending.current?.abort(), []);
  const speak = async (phase, snapshot = career, choice = '') => {
    if (!partner || pending.current) return;
    const controller = new AbortController(); pending.current = controller; setBusy(phase); setError('');
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const reply = await requestWorkReply({ storage: window.localStorage, world, character: partner, career: snapshot,
        text: makeRoleWorkPrompt(phase, snapshot, partner, choice), signal: controller.signal });
      if (!controller.signal.aborted) onScene(snapshot, { type: 'roleScene', phase, choice, personId: partner.id, personName: partner.name, reply, now: Date.now() });
    } catch (err) {
      if (!controller.signal.aborted) setError(`${err.message} 你仍然可以继续计时，到时收工领薪。`);
      else setError('回应已取消或超时。工作进度保留，可以重试，也可以继续工作。');
    } finally { clearTimeout(timeout); pending.current = null; setBusy(''); }
  };
  const begin = () => { const started = onBegin(); if (partner) speak('intro', started); };
  const finish = async () => { const paid = await onFinish(); if (paid && partner && !paid.project.scenes?.some(s => s.phase === 'finish')) speak('finish', paid); };
  return <section className="ws-shift" aria-label="今日角色工作">
    <div className="ws-eyebrow">A DAY TOGETHER</div><h1>{project.delivered ? '辛苦了，今天就到这里。' : '今天，和谁一起工作？'}</h1>
    <article className="ws-paper ws-partner-card">
      {partner ? <>
        <div className="ws-chat-person"><span className="ws-avatar">{partner.avatar ? <img src={partner.avatar} alt=""/> : partner.name.slice(0, 1)}</span><span><strong>{partner.name}</strong><small>{career.assignments[partner.id] || partner.identity || '合作伙伴'}</small></span><span className="ws-partner-badge">今日搭档</span></div>
        {!recorded && !busy && !project.delivered && <label className="ws-label">选择搭档<select value={partner.id} onChange={e => setChosen(e.target.value)}>{people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
        <p>{project.accepted ? `${partner.name}会按照自己的性格和世界背景回应。一起商量、分工，或者聊聊今天发生的事。` : `和${partner.name}一起接下今天的工作。不用写方案，也不用手动检查。`}</p>
      </> : <p>还没有关联人物。你可以先独立工作；在角色 APP 关联这个世界后，就能邀请人物参与。</p>}
      <h2>{project.title}</h2>
      {!project.accepted && <button id="ws-brief" className="ws-primary" onClick={begin}>{partner ? `和${partner.name}开始工作` : '开始工作'}<ArrowUpRight size={17}/></button>}
      {project.accepted && !project.delivered && partner && !scenes.some(s => s.phase === 'intro') && <button className="ws-secondary" disabled={Boolean(busy)} onClick={() => speak('intro')}>听听{partner.name}的安排</button>}
      {partner && project.accepted && <button className="ws-secondary ws-shift-chat" disabled={Boolean(busy)} onClick={() => onChat(partner.id, '同事工位', '聊聊我们今天一起做的工作吧。')}><MessageCircle size={16}/>和{partner.name}聊聊</button>}
    </article>
    {scenes.map(scene => <article className="ws-paper ws-role-scene" key={scene.phase}><small>{scene.phase === 'intro' ? '一起开工' : scene.phase === 'support' ? '共同处理' : '收工反馈'} · {scene.personName}</small><p>{scene.reply}</p>{scene.choice && <span className="ws-scene-effect"><Check size={14}/>{scene.choice === 'delegate' ? `协作节省 ${Math.ceil((project.timeSavedMs || 0) / 1000)} 秒` : WORK_APPROACHES.find(a => a.id === scene.choice)?.effect}</span>}</article>)}
    {project.accepted && !project.delivered && <article className="ws-paper" id="ws-support" tabIndex={-1}><div className="ws-section-title"><h2>工作中的小插曲</h2><Users size={17}/></div><p>{project.event}</p>
      {partner && !supported ? <><p className="ws-muted">你想怎么和{partner.name}一起处理？选一个即可，也可以直接聊天。互动可选，不影响到时领薪。</p><div className="ws-approaches">{WORK_APPROACHES.map(choice => <button disabled={Boolean(busy)} key={choice.id} onClick={() => speak('support', career, choice.id)}><strong>{choice.label}</strong><small>{choice.effect}</small></button>)}</div></> : <p className="ws-muted">{supported ? `你和${supported.personName}已经一起处理了这件事。可以继续聊天，或等待收工。` : '可以按自己的节奏处理，倒计时结束后直接收工。'}</p>}
    </article>}
    {busy && <p className="ws-feedback" role="status">{partner?.name}正在{busy === 'finish' ? '和你道别' : '回应你'}… <button className="ws-secondary" onClick={() => pending.current?.abort()}>取消等待</button></p>}
    {error && <p className="ws-alert" role="alert">{error}</p>}
    {project.accepted && <article className="ws-paper"><h2>{project.salaryPaid ? '今天的工资已到账' : remaining > 0 ? '工作正在推进' : '可以收工了'}</h2><p className="ws-muted">{project.salaryPaid ? '共同经历已留在职业档案，明天还会有新的事情。' : remaining > 0 ? `还剩 ${formatCountdown(remaining)}，可以和搭档互动，也可以切换到其他 APP。` : '不用补文件或检查，收工即可结算工资。'}</p>
      <button id="ws-delivery" className="ws-primary" disabled={Boolean(busy) || paying || remaining > 0 || project.salaryPaid} onClick={finish}>{paying ? '正在结算…' : project.salaryPaid ? `工资 ¥${project.wage} 已到账` : `收工，领取 ¥${project.wage}`}<Coffee size={17}/></button>
      {payError && <p className="ws-alert" role="alert">{payError}</p>}
      {project.salaryPaid && partner && !scenes.some(s => s.phase === 'finish') && <button className="ws-secondary ws-shift-chat" disabled={Boolean(busy)} onClick={() => speak('finish')}>听听{partner.name}的收工反馈</button>}
      {project.salaryPaid && <button id="ws-next-day" className="ws-secondary ws-start" disabled={Boolean(busy)} onClick={onNextDay}>开始下一天<ArrowUpRight size={16}/></button>}
    </article>}
    {project.draft && <details className="ws-paper"><summary>以前保存的笔记（不影响工作）</summary><p className="ws-preserve">{project.draft}</p></details>}
  </section>;
}
