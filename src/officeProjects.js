import { parseGeneratedProjects } from './officeProjectApi.js';
import { readWalletData, subtractWalletOnce } from './walletStore.js';
export const PROJECTS_KEY='ccat-office-projects-v1';
export const REFRESH_COST=200;
const localDate=now=>{const d=new Date(now);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
const valid=b=>b && b.version===1 && typeof b.day==='string' && Number.isSafeInteger(b.used) && b.used>=0 && Array.isArray(b.projects) && (b.projects.length===0||b.projects.length>=5) && b.projects.every(p=>typeof p.id==='string' && typeof p.name==='string' && typeof p.content==='string' && Number.isFinite(p.amount) && p.amount>0 && Number.isFinite(p.minutes) && p.minutes>0);
function write(storage,board){try{storage.setItem(PROJECTS_KEY,JSON.stringify(board));}catch{throw new Error('项目保存失败，请重试；已扣款的刷新会自动恢复，不会重复扣款。');}}
export function freeRefreshes(board,now=Date.now()){return Math.max(0,5-(board.day===localDate(now)?board.used:0));}
export function openProjectBoard(storage,now=Date.now()){
 let board;
 try{const raw=storage.getItem(PROJECTS_KEY);board=raw?JSON.parse(raw):null;if(raw&&!valid(board))throw Error();}catch{throw new Error('项目读取失败，请检查存储后重试。');}
 if(!board){board={version:1,day:localDate(now),used:0,projects:[],source:'empty',batchId:'empty',history:[]};write(storage,board);}
 if(board.pending){
  const {id,next}=board.pending;if(typeof id!=='string'||!valid(next)||next.pending)throw new Error('项目读取失败：刷新记录无效。');
  const wallet=readWalletData(storage,{strict:true});
  if(wallet.expenseReceiptIds?.includes(id))board=next;
  else {board={...board};delete board.pending;}
  write(storage,board);
 }
 // Update only unaccepted offers; accepted jobs retain their saved reward snapshots.
 const projects=board.projects.map(p=>({...p,amount:p.minutes*40}));
 if(projects.some((p,i)=>p.amount!==board.projects[i].amount)){board={...board,projects};write(storage,board);}
 return board;
}
export function refreshProjectBoard(storage,now=Date.now(),generated,expectedBatch){
 const current=openProjectBoard(storage,now);
 if(expectedBatch!==undefined&&expectedBatch!==(current.batchId||'legacy'))throw new Error('项目已在其他页面更新，请重新读取。');
 const history=[...(current.history||[]),...current.projects].slice(-50);
 if(!generated)throw new Error('请先通过 API 生成项目。');
 const validated=parseGeneratedProjects(JSON.stringify({projects:generated}),history);
 const batchId=globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`;
 const first=current.source!=='ai';
 const next={version:1,source:'ai',batchId,history:history.map(p=>({name:p.name,content:p.content})),day:localDate(now),used:(current.day===localDate(now)?current.used:0)+(first?0:1),projects:validated.map((p,i)=>({...p,id:`${batchId}:${i}`}))};
 if(first||freeRefreshes(current,now)>0){write(storage,next);return next;}
 const wallet=readWalletData(storage,{strict:true});
 if(!Number.isFinite(wallet.balance)||wallet.balance<REFRESH_COST)throw new Error('钱包余额不足，需要 200 才能刷新');
 const id=`office-refresh:${globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`}`;
 write(storage,{...current,pending:{id,next}});
 subtractWalletOnce({id,amount:REFRESH_COST,desc:'工作 · 项目列表刷新'},storage);
 write(storage,next);
 return next;
}
