import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, RefreshCw, Clock3, Sparkles, ChevronDown } from 'lucide-react';
import { openProjectBoard, freeRefreshes, REFRESH_COST } from './officeProjects.js';
import { generateOfficeProjectBoard } from './officeProjectGeneration.js';
import { useOfficeWork } from './OfficeWorkContext.jsx';
import { alreadyAccepted, availableAccepts, jobCountdown, remainingJobMs } from './officeJobs.js';
import { readWalletData, withWalletLock } from './walletStore.js';
const money=n=>n.toLocaleString('zh-CN');
export function OfficeProjects({storage,onBack,onCountdown}){
 const work=useOfficeWork();
 const [board,setBoard]=useState(null),[balance,setBalance]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[recovery,setRecovery]=useState(false);
 const working=useRef(false),mounted=useRef(false),controller=useRef(null);
 const display=next=>{setBoard(next);setBalance(readWalletData(storage,{strict:true}).balance);};
 const load=async()=>{
  if(working.current)return;working.current=true;setBusy(true);
  try{await withWalletLock(()=>{if(!mounted.current)return;display(openProjectBoard(storage));setError('');setRecovery(false);});}
  catch(e){if(mounted.current){setError(e.message);setRecovery(true);}}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 };
 const generate=async()=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');setNotice('正在构思 5 个新项目…');
  const abort=new AbortController();controller.current=abort;let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;abort.abort();},60000);
  try{
   const next=await generateOfficeProjectBoard({storage,signal:abort.signal});
   if(mounted.current){display(next);setRecovery(false);setNotice('5 个新项目已就绪。');}
  }catch(e){if(mounted.current){setError(timedOut?'生成超时，请重试。未扣除刷新次数或费用。':e.name==='AbortError'?'生成已取消。':e.message);setRecovery(Boolean(e.needsRecovery));setNotice('');}}
  finally{clearTimeout(timeout);working.current=false;if(mounted.current)setBusy(false);}
 };
 useEffect(()=>{mounted.current=true;load();const update=()=>load();window.addEventListener('storage',update);return()=>{mounted.current=false;controller.current?.abort();window.removeEventListener('storage',update);};},[storage]);
 useEffect(()=>{const update=()=>{try{setBalance(readWalletData(storage,{strict:true}).balance);}catch(e){setError(e.message);setRecovery(true);}};window.addEventListener('ccat-wallet-change',update);return()=>window.removeEventListener('ccat-wallet-change',update);},[storage]);
 const isAI=board?.source==='ai',free=board?freeRefreshes(board,work.now):5,remaining=availableAccepts(work.jobs,work.now),active=work.jobs.find(j=>!j.paid);
 return <>
  <header className="ow-header ow-project-header"><button className="ow-icon" aria-label="返回办公室" onClick={onBack}><ArrowLeft size={23}/></button><h1>项目管理</h1><button className="ow-project-refresh" disabled={busy||!board||recovery} onClick={generate} aria-label={isAI?(free?`AI刷新项目，剩余 ${free} 次免费`:`AI刷新项目，扣除钱包 ${REFRESH_COST}`):'AI生成项目'}><RefreshCw size={17} className={busy?'ow-refresh-spin':''}/><span>{busy?'生成中':isAI?(free?'换一批':'200/次'):'生成'}</span></button></header>
  <main className="ow-projects ow-ai-board" aria-label="项目管理内容" aria-busy={busy}>
   <div className="ow-board-heading"><div><span className="ow-project-eyebrow">新的机会，从这里开始</span><h2>找到下一项<br/>值得投入的工作<span>。</span></h2></div><span className="ow-ai-label"><Sparkles size={13}/> AI 项目</span></div>
   <div className="ow-board-stats"><div><span>今日可接</span><strong>{remaining}<small> / 3</small></strong></div><div><span>免费刷新</span><strong>{free}<small> / 5</small></strong></div><div><span>钱包余额</span><strong><small>¥ </small>{balance===null?'—':money(balance)}</strong></div></div>
   {active?<button className="ow-current-project" onClick={onCountdown}><span className="ow-live-dot"/><span><small>当前项目 · 完成后可接下一项</small><strong>{active.name}</strong></span><span className="ow-current-time">{jobCountdown(remainingJobMs(active,work.now))}<ArrowUpRight size={16}/></span></button>:<p className="ow-board-rule">一次专注 1 个项目 · 按现实时间计时 · 完成自动入账</p>}
   {work.error&&<p role="alert" className="ow-error">{work.error}</p>}
   {error&&<div role="alert" className="ow-project-error"><p>{error}</p><button className="ow-outline" disabled={busy} onClick={recovery?load:generate}>{recovery?'重新读取':'重试生成'}</button></div>}
   <p className="ow-project-status" role="status">{notice}</p>
   {!isAI?<section className="ow-ai-empty"><Sparkles size={30} strokeWidth={1.3}/><h3>让新项目来找你</h3><p>由你设置的主 API 生成 5 份不同的项目委托，包含目标、交付要求和真实用时。</p><button className="ow-save" disabled={busy||!board||recovery} onClick={generate}>{busy?'正在生成…':'生成第一批项目'}</button><small>首次 AI 生成免费，不占刷新次数</small></section>:<><div className="ow-board-list-heading"><h3>可接取委托</h3><span>本批 {board.projects.length} 项</span></div><div className="ow-ai-project-list">{board.projects.map((p,index)=>{
    const accepted=alreadyAccepted(work.jobs,p.id,work.now),disabled=busy||work.busy||!work.ready||recovery||accepted||Boolean(active)||!remaining;
    return <article className="ow-ai-project" key={p.id}><div className="ow-ai-project-meta"><span>{String(index+1).padStart(2,'0')}<i/> {p.category||'项目委托'}</span><span><Clock3 size={12}/>{p.minutes} 分钟</span></div><div className="ow-ai-project-title"><h3>{p.name}</h3><div><small>项目报酬</small><strong><small>¥</small>{money(p.amount)}</strong></div></div><details className="ow-project-brief"><summary><span>{p.content}</span><ChevronDown size={14}/></summary><p>{p.content}</p></details><footer><span>到期自动结算</span><button disabled={disabled} onClick={async()=>{if(await work.accept(p.id))setNotice(`已接取「${p.name}」，倒计时已开始。`);}}>{accepted?'已接取':active?'当前有项目进行中':!remaining?'今日接取已满':'接取项目'}{!disabled&&<ArrowUpRight size={15}/>}</button></footer></article>;
   })}</div></>}
   <p className="ow-board-footnote">每日 5 次免费刷新，用完后 200 / 次。生成成功后计次或扣款，失败保留原项目。</p>
  </main>
 </>;
}
