import { openProjectBoard } from './officeProjects.js';
import { addWalletIncomeOnce } from './walletStore.js';
export const JOBS_KEY='ccat-office-jobs-v1';
export const officeDay=now=>{const d=new Date(now);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
export function readOfficeJobs(storage){
 try{
  const raw=storage.getItem(JOBS_KEY);if(!raw)return [];
  const jobs=JSON.parse(raw);
  if(!Array.isArray(jobs)||!jobs.every(j=>typeof j.id==='string'&&typeof j.projectId==='string'&&typeof j.name==='string'&&typeof j.content==='string'&&typeof j.acceptedDay==='string'&&typeof j.paid==='boolean'&&Number.isFinite(j.startedAt)&&Number.isFinite(j.endsAt)&&j.endsAt>j.startedAt&&Number.isFinite(j.minutes)&&j.minutes>0&&Number.isFinite(j.amount)&&j.amount>0)||new Set(jobs.map(j=>j.id)).size!==jobs.length)throw Error();
  return jobs;
 }catch{throw new Error('工作记录读取失败，请检查存储后重试。');}
}
function save(storage,jobs){try{storage.setItem(JOBS_KEY,JSON.stringify(jobs));}catch{throw new Error('工作记录保存失败，请重试；已入账的报酬不会重复发放。');}}
export const availableAccepts=(jobs,now=Date.now())=>Math.max(0,3-jobs.filter(j=>j.acceptedDay===officeDay(now)).length);
export const alreadyAccepted=(jobs,id,now=Date.now())=>jobs.some(j=>j.projectId===id&&(!j.paid||j.acceptedDay===officeDay(now)));
export const remainingJobMs=(job,now=Date.now())=>Math.max(0,Math.min(job.endsAt-job.startedAt,job.endsAt-now));
export function jobCountdown(ms){const sec=Math.max(0,Math.ceil(ms/1000));return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':');}
// Caller holds the same cross-tab project lock used by refresh and settlement.
export function acceptOfficeProject(storage,projectId,now=Date.now()){
 const jobs=readOfficeJobs(storage);
 if(alreadyAccepted(jobs,projectId,now))throw new Error('这个项目已接取，请查看工作倒计时。');
 if(!availableAccepts(jobs,now))throw new Error('每天最多接取 3 个项目，明天再来。');
 const project=openProjectBoard(storage,now).projects.find(p=>p.id===projectId);
 if(!project)throw new Error('项目列表已刷新，请重新查看后接取。');
 const id=`office-job:${globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`}`;
 const job={...project,id,projectId,acceptedDay:officeDay(now),startedAt:now,endsAt:now+project.minutes*60000,paid:false};
 const next=[...jobs,job];save(storage,next);return next;
}
export function settleOfficeJobs(storage,now=Date.now()){
 let jobs=readOfficeJobs(storage);
 for(const job of jobs){
  if(job.paid||remainingJobMs(job,now)>0)continue;
  addWalletIncomeOnce({id:`salary:${job.id}`,amount:job.amount,desc:`项目报酬 · ${job.name}`},storage);
  jobs=jobs.map(j=>j.id===job.id?{...j,paid:true,settledAt:now}:j);
  save(storage,jobs);
 }
 return jobs;
}
