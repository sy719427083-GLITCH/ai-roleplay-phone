import { Clock3, CheckCircle2 } from 'lucide-react';
import { useOfficeWork } from './OfficeWorkContext.jsx';
import { availableAccepts, jobCountdown, remainingJobMs } from './officeJobs.js';
export function OfficeCountdown({onProjects}){
 const {jobs,now,error,retry,ready}=useOfficeWork();
 const active=jobs.filter(j=>!j.paid).sort((a,b)=>a.endsAt-b.endsAt),paid=jobs.filter(j=>j.paid).slice().reverse();
 return <main className="ow-projects" aria-label="工作倒计时内容">
  <div className="ow-project-intro"><div><span className="ow-project-eyebrow">WORK IN PROGRESS</span><h2>{active.length?`${active.length} 个项目进行中`:'安排下一份工作'}</h2><p>按现实时间计时，到期自动入账。</p></div><Clock3 size={28}/></div>
  <div className="ow-project-quota"><span>今日还可接取 <strong>{availableAccepts(jobs,now)} / 3</strong></span><button className="ow-text-button" onClick={onProjects}>查看项目</button></div>
  <p className="ow-project-note">退出后继续计时。浏览器关闭期间完成的项目，下次打开自动结算。</p>
  {error&&<div className="ow-project-error" role="alert"><p>{error}</p><button className="ow-outline" onClick={retry}>重试结算</button></div>}
  {!ready&&<p className="ow-hint">正在读取工作记录…</p>}
  <div className="ow-project-list ow-job-list">{active.map(job=>{
   const left=remainingJobMs(job,now),progress=Math.min(100,Math.max(0,(1-left/(job.endsAt-job.startedAt))*100));
   return <article className="ow-project-card" key={job.id}><div className="ow-project-card-top"><span className="ow-project-time">{left?'进行中':'正在自动结算'}</span><strong className="ow-job-amount">¥ {job.amount.toLocaleString('zh-CN')}</strong></div><h3>{job.name}</h3><div className="ow-job-clock" aria-label={`${job.name}剩余时间`}>{jobCountdown(left)}</div><progress className="ow-job-progress" max="100" value={progress} aria-label={`${job.name}进度`}/><p className="ow-job-deadline">预计完成 {new Date(job.endsAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · 共 {job.minutes} 分钟</p></article>;
  })}</div>
  {ready&&!active.length&&<div className="ow-job-empty"><Clock3 size={32} strokeWidth={1.25}/><p>当前没有进行中的项目</p><button className="ow-save" onClick={onProjects}>去接取项目</button></div>}
  {paid.length>0&&<section className="ow-job-history"><h3>已结算</h3>{paid.map(job=><article key={job.id}><CheckCircle2 size={17}/><div><strong>{job.name}</strong><small>{new Date(job.settledAt).toLocaleString('zh-CN')} · 已自动存入钱包</small></div><span>+{job.amount.toLocaleString('zh-CN')}</span></article>)}</section>}
 </main>;
}
