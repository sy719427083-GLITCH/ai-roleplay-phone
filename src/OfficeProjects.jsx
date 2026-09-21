import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Clock3, Wallet, FolderClosed } from 'lucide-react';
import { openProjectBoard, refreshProjectBoard, freeRefreshes, REFRESH_COST } from './officeProjects.js';
import { useOfficeWork } from './OfficeWorkContext.jsx';
import { alreadyAccepted, availableAccepts } from './officeJobs.js';
import { readWalletData, withWalletLock } from './walletStore.js';
const money=n=>n.toLocaleString('zh-CN');
export function OfficeProjects({storage,onBack,onCountdown}){
 const work=useOfficeWork();
 const [board,setBoard]=useState(null),[balance,setBalance]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now);
 const working=useRef(false),mounted=useRef(false);
 const run=async(refresh=false)=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');
  const action=()=>{
   if(!mounted.current)return;
   const previous=openProjectBoard(storage);
   const cost=refresh&&freeRefreshes(previous)===0?REFRESH_COST:0;
   const next=refresh?refreshProjectBoard(storage):previous;
   setBoard(next);setBalance(readWalletData(storage,{strict:true}).balance);setNow(Date.now());
   if(refresh)setNotice(cost?`已刷新 5 个项目，钱包扣除 ${cost}。`:'已刷新 5 个项目，本次免费。');
  };
  try{await withWalletLock(action);}
  catch(e){if(mounted.current){setError(e.message||'刷新失败，请重试');setNotice('');}}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 };
 useEffect(()=>{mounted.current=true;run();const update=()=>run();const timer=setInterval(()=>setNow(Date.now()),30000);window.addEventListener('storage',update);return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('storage',update);};},[storage]);
 useEffect(()=>{const update=()=>{try{setBalance(readWalletData(storage,{strict:true}).balance);}catch(e){setError(e.message);}};window.addEventListener('ccat-wallet-change',update);return()=>window.removeEventListener('ccat-wallet-change',update);},[storage]);
 const free=board?freeRefreshes(board,now):5;
 return <>
  <header className="ow-header ow-project-header"><button className="ow-icon" aria-label="返回办公室" onClick={onBack}><ArrowLeft size={23}/></button><h1>项目管理</h1><button className="ow-project-refresh" disabled={busy||!board||Boolean(error)} onClick={()=>run(true)} aria-label={free?`刷新项目，剩余 ${free} 次免费`:`刷新项目，扣除钱包 ${REFRESH_COST}`}><RefreshCw size={17}/><span>{free?'刷新':`${REFRESH_COST}/次`}</span></button></header>
  <main className="ow-projects" aria-label="项目管理内容" aria-busy={busy}>
   <div className="ow-project-intro"><div><span className="ow-project-eyebrow">PROJECT BOARD</span><h2>发现新的工作</h2><p>选题、策划、协作，每一次都有新机会。</p></div><FolderClosed size={28} strokeWidth={1.25}/></div>
   <div className="ow-project-quota"><span>今日免费刷新 <strong>{free} / 5</strong></span><span><Wallet size={14}/>余额 {balance===null?'—':money(balance)}</span></div>
   <p className="ow-project-note">每天免费刷新 5 次，用完后每次 200。首次生成不计次数。</p>
   <div className="ow-project-accept-quota"><span>今日还可接取 <strong>{availableAccepts(work.jobs,work.now)} / 3</strong></span><button className="ow-text-button" onClick={onCountdown}>工作倒计时 →</button></div>
   {work.error&&<p role="alert" className="ow-error">{work.error}</p>}
   {error&&<div role="alert" className="ow-project-error"><p>{error}</p><button className="ow-outline" disabled={busy} onClick={()=>run()}>重新读取</button></div>}
   <p className="ow-project-status" role="status">{notice}</p>
   {board&&<div className="ow-project-list">{board.projects.map((p,index)=><article className="ow-project-card" key={p.id}><div className="ow-project-card-top"><span className="ow-project-number">{String(index+1).padStart(2,'0')}</span><span className="ow-project-time"><Clock3 size={13}/>预计 {p.minutes} 分钟</span></div><h3>{p.name}</h3><p>{p.content}</p><div className="ow-project-reward"><span>项目金额</span><strong>¥ {money(p.amount)}</strong></div><button className="ow-project-accept" disabled={busy||work.busy||!work.ready||Boolean(error)||alreadyAccepted(work.jobs,p.id,work.now)||!availableAccepts(work.jobs,work.now)} onClick={async()=>{if(await work.accept(p.id))setNotice(`已接取「${p.name}」，倒计时已开始，到期自动入账。`);}}>{alreadyAccepted(work.jobs,p.id,work.now)?'已接取':!availableAccepts(work.jobs,work.now)?'今日接取已满':'接取项目'}</button></article>)}</div>}
  </main>
 </>;
}
