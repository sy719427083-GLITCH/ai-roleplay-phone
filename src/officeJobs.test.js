import test from 'node:test';
import assert from 'node:assert/strict';
import { readOfficeJobs, acceptOfficeProject, settleOfficeJobs, remainingJobMs, availableAccepts, JOBS_KEY } from './officeJobs.js';
import { openProjectBoard, refreshProjectBoard } from './officeProjects.js';
import { readWalletData, writeWalletData } from './walletStore.js';
import { generatedFixture } from './officeProjectFixtures.test-helper.js';
const now=new Date(2026,8,21,12).getTime();
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
const setup=()=>{const s=memory();openProjectBoard(s,now);return {s,board:refreshProjectBoard(s,now,generatedFixture())};};
test('accept saves real start/deadline and immutable reward; three accepts per day',()=>{
 const {s,board}=setup();for(let i=0;i<3;i++){acceptOfficeProject(s,board.projects[i].id,now+i*4000000);settleOfficeJobs(s,now+(i+1)*4000000);}
 const jobs=readOfficeJobs(s);assert.equal(jobs.length,3);assert.equal(availableAccepts(jobs,now),0);
 assert.equal(jobs[0].endsAt,now+jobs[0].minutes*60000);assert.equal(jobs[0].amount,jobs[0].minutes*40);
 assert.throws(()=>acceptOfficeProject(s,board.projects[3].id,now),/最多/);assert.equal(readOfficeJobs(s).length,3);
});
test('double click cannot accept same project twice and stale offers are rejected',()=>{
 const {s,board}=setup();acceptOfficeProject(s,board.projects[0].id,now);assert.throws(()=>acceptOfficeProject(s,board.projects[0].id,now),/已接取/);settleOfficeJobs(s,now+4000000);assert.throws(()=>acceptOfficeProject(s,'missing',now+4000000),/刷新/);assert.equal(readOfficeJobs(s).length,1);
});
test('refresh does not lose active work; timer reflects real elapsed time after reload',()=>{
 const {s,board}=setup();acceptOfficeProject(s,board.projects[0].id,now);const job=readOfficeJobs(s)[0];refreshProjectBoard(s,now,generatedFixture());assert.deepEqual(readOfficeJobs(s)[0],job);assert.equal(remainingJobMs(readOfficeJobs(s)[0],now+60000),job.minutes*60000-60000);assert.equal(remainingJobMs(job,job.endsAt+123),0);
});
test('expiry auto credits exactly once including reopening after offline elapsed time',()=>{
 const {s,board}=setup();acceptOfficeProject(s,board.projects[0].id,now);const job=readOfficeJobs(s)[0];settleOfficeJobs(s,job.endsAt-1);assert.equal(readWalletData(s).balance,0);settleOfficeJobs(s,job.endsAt+999);assert.equal(readWalletData(s).balance,job.amount);assert.equal(readOfficeJobs(s)[0].paid,true);settleOfficeJobs(s,job.endsAt+1000);assert.equal(readWalletData(s).transactions.length,1);
});
test('next local day restores allowance; completion does not replenish same-day quota',()=>{
 const {s,board}=setup();for(let i=0;i<3;i++){acceptOfficeProject(s,board.projects[i].id,now+i*4000000);settleOfficeJobs(s,now+(i+1)*4000000);}settleOfficeJobs(s,now+86400000);assert.equal(availableAccepts(readOfficeJobs(s),now),0);assert.equal(availableAccepts(readOfficeJobs(s),now+86400000),3);acceptOfficeProject(s,board.projects[0].id,now+86400000);assert.equal(readOfficeJobs(s).length,4);
});
test('wallet failure preserves pending job and retries without losing wage',()=>{
 const {s,board}=setup();acceptOfficeProject(s,board.projects[0].id,now);const job=readOfficeJobs(s)[0];const failing={...s,setItem:(k,v)=>{if(k==='roleplayWallet')throw Error();s.setItem(k,v);}};assert.throws(()=>settleOfficeJobs(failing,job.endsAt),/钱包写入/);assert.equal(readOfficeJobs(s)[0].paid,false);settleOfficeJobs(s,job.endsAt);assert.equal(readWalletData(s).balance,job.amount);
});
test('ledger failure after credit survives history clearing and retries without double credit',()=>{
 const {s,board}=setup();acceptOfficeProject(s,board.projects[0].id,now);const job=readOfficeJobs(s)[0];const failing={...s,setItem:(k,v)=>{if(k===JOBS_KEY)throw Error();s.setItem(k,v);}};assert.throws(()=>settleOfficeJobs(failing,job.endsAt),/保存/);const w=readWalletData(s);assert.equal(w.balance,job.amount);writeWalletData({...w,transactions:[]},s);settleOfficeJobs(s,job.endsAt);assert.equal(readWalletData(s).balance,job.amount);assert.equal(readOfficeJobs(s)[0].paid,true);
});
test('failed acceptance saves no job or allowance; corrupt ledger never silently resets',()=>{
 const {s,board}=setup();const failing={...s,setItem:()=>{throw Error();}};assert.throws(()=>acceptOfficeProject(failing,board.projects[0].id,now),/保存/);assert.equal(readOfficeJobs(s).length,0);s.setItem(JOBS_KEY,'bad');assert.throws(()=>readOfficeJobs(s),/读取/);
});
test('simultaneous settlements and wallet edit share a lock and preserve salary receipts',async()=>{
 const {withWalletLock,applyWalletTransaction}=await import('./walletStore.js');
 const {s,board}=setup();acceptOfficeProject(s,board.projects[0].id,now);const job=readOfficeJobs(s)[0];let queue=Promise.resolve();const names=[];
 const locks={request:(name,action)=>{names.push(name);const next=queue.then(action);queue=next.catch(()=>{});return next;}};
 await Promise.all([withWalletLock(()=>settleOfficeJobs(s,job.endsAt),locks),withWalletLock(()=>applyWalletTransaction({type:'sub',amount:100,desc:'测试支出'},s),locks),withWalletLock(()=>settleOfficeJobs(s,job.endsAt),locks)]);
 assert.equal(new Set(names).size,1);assert.equal(readWalletData(s).balance,job.amount-100);assert.equal(readWalletData(s).incomeReceiptIds.length,1);assert.equal(readWalletData(s).transactions.length,2);
});

test('one active project blocks every other offer until settlement',()=>{const {s,board}=setup();acceptOfficeProject(s,board.projects[0].id,now);assert.throws(()=>acceptOfficeProject(s,board.projects[1].id,now),/一次只能/);assert.equal(readOfficeJobs(s).length,1);settleOfficeJobs(s,now+4000000);acceptOfficeProject(s,board.projects[1].id,now+4000000);assert.equal(readOfficeJobs(s).filter(j=>!j.paid).length,1);});
