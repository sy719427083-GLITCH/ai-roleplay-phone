import { readWalletData, subtractWalletOnce } from './walletStore.js';
export const PROJECTS_KEY='ccat-office-projects-v1';
export const REFRESH_COST=200;
const catalog=[
 ['新品发布企划',1800,45,'整理产品亮点与目标用户，设计发布节奏、宣传主题和渠道安排，交付一份完整的发布方案。'],
 ['客户需求调研',1200,30,'梳理客户反馈，归纳核心需求与常见问题，制作需求优先级清单和后续跟进建议。'],
 ['品牌视觉提案',2200,60,'确定品牌视觉方向，整理配色、字体和参考案例，制作三组设计提案并说明适用场景。'],
 ['社交媒体内容策划',1000,25,'策划一周的社交媒体内容，编写选题、标题与文案提纲，安排发布时间和互动话题。'],
 ['月度经营分析',1600,40,'汇总月度经营数据，对比收入与支出变化，分析异常项目，形成报告与改进建议。'],
 ['线上活动筹备',2000,50,'制定活动主题、流程和人员分工，准备宣传材料，列出预算、风险及应急方案。'],
 ['产品体验优化',1500,35,'检查产品使用流程，整理体验问题，提出可执行的优化建议并标注处理优先级。'],
 ['内部培训课件',1300,30,'整理培训目标与知识要点，设计案例练习，制作培训大纲、课件内容与验收题目。'],
 ['合作伙伴方案',2400,60,'研究合作目标与双方资源，拟定合作方式、里程碑和预算，准备可用于沟通的提案。'],
 ['用户反馈周报',800,20,'归类本周用户反馈，筛选高频问题，整理处理状态、责任人和下一步行动清单。'],
 ['网站内容更新',1100,25,'检查网站现有文案和内容结构，补充服务介绍、常见问题与更新说明，提交内容清单。'],
 ['季度项目复盘',1900,45,'回顾季度项目成果与延期原因，提炼协作经验，整理下一季度计划和资源需求。'],
 ['客户服务手册',1400,35,'整理常见服务场景，编写答复示例与升级处理流程，形成便于员工查阅的服务手册。'],
 ['市场竞品研究',1700,40,'对比同类产品的功能、定价和宣传方式，整理优势与差异，输出市场机会分析。'],
 ['办公资源盘点',700,15,'清点办公用品与设备，汇总耗材需求和待维修事项，制作采购建议与资源登记表。'],
];
const localDate=now=>{const d=new Date(now);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
const valid=b=>b && b.version===1 && typeof b.day==='string' && Number.isSafeInteger(b.used) && b.used>=0 && Array.isArray(b.projects) && b.projects.length>=5 && b.projects.every(p=>typeof p.id==='string' && typeof p.name==='string' && typeof p.content==='string' && Number.isFinite(p.amount) && p.amount>0 && Number.isFinite(p.minutes) && p.minutes>0);
function write(storage,board){try{storage.setItem(PROJECTS_KEY,JSON.stringify(board));}catch{throw new Error('项目保存失败，请重试；已扣款的刷新会自动恢复，不会重复扣款。');}}
function generate(previous=[]){
 const pool=catalog.map((row,index)=>({row,index}));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 // Guarantee at least one new title, even when randomness happens to repeat a batch.
 if(pool.slice(0,5).every(p=>previous.some(old=>old.name===p.row[0]))){const j=pool.findIndex(p=>!previous.some(old=>old.name===p.row[0]));if(j>=0)[pool[0],pool[j]]=[pool[j],pool[0]];}
 return pool.slice(0,5).map(({row:[name,amount,minutes,content],index})=>({id:`project-${index}`,name,amount:minutes*40,minutes,content}));
}
export function freeRefreshes(board,now=Date.now()){return Math.max(0,5-(board.day===localDate(now)?board.used:0));}
export function openProjectBoard(storage,now=Date.now()){
 let board;
 try{const raw=storage.getItem(PROJECTS_KEY);board=raw?JSON.parse(raw):null;if(raw&&!valid(board))throw Error();}catch{throw new Error('项目读取失败，请检查存储后重试。');}
 if(!board){board={version:1,day:localDate(now),used:0,projects:generate()};write(storage,board);}
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
export function refreshProjectBoard(storage,now=Date.now()){
 const current=openProjectBoard(storage,now);
 const next={version:1,day:localDate(now),used:(current.day===localDate(now)?current.used:0)+1,projects:generate(current.projects)};
 if(freeRefreshes(current,now)>0){write(storage,next);return next;}
 const wallet=readWalletData(storage,{strict:true});
 if(!Number.isFinite(wallet.balance)||wallet.balance<REFRESH_COST)throw new Error('钱包余额不足，需要 200 才能刷新');
 const id=`office-refresh:${globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`}`;
 write(storage,{...current,pending:{id,next}});
 subtractWalletOnce({id,amount:REFRESH_COST,desc:'工作 · 项目列表刷新'},storage);
 write(storage,next);
 return next;
}
