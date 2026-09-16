import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, transition, SAVE_KEY } from './workSimulation.js';
import { initializePayroll, remainingWorkMs, completePaidWork } from './workPayroll.js';
import { readWalletData, writeWalletData, applyWalletTransaction } from './walletStore.js';
const memory = () => {const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const ready = () => {
 let s=initializePayroll(createCareer({id:'w',name:'世界'},[],'project'),{id:'career-1',now:1000,durationMs:60000});
 s=transition(s,{type:'brief',now:1000});s=transition(s,{type:'research'});
 s=transition(s,{type:'draft',text:'目标是完成工作任务，首先整理资料并确认人员安排，遇到延期时联系负责人核实替代方案。'});
 return transition(s,{type:'review'});
};
test('countdown is based on persisted wall time and clamps at zero',()=>{
 const s=ready();assert.equal(remainingWorkMs(s,31000),30000);assert.equal(remainingWorkMs(JSON.parse(JSON.stringify(s)),71000),0);
 assert.equal(transition(s,{type:'deliver',now:31000}),s);
});
test('salary is blocked before timer ends and paid once after delivery',()=>{
 const storage=memory(),s=ready();assert.throws(()=>completePaidWork(storage,s,31000),/倒计时/);
 const paid=completePaidWork(storage,s,61000);assert.equal(paid.project.salaryPaid,true);assert.equal(readWalletData(storage).balance,300);
 completePaidWork(storage,paid,62000);assert.equal(readWalletData(storage).balance,300);
 assert.equal(readWalletData(storage).transactions.length,1);
});
test('clearing wallet history and subsequent wallet spending preserves payroll receipts',()=>{
 const storage=memory();const paid=completePaidWork(storage,ready(),61000);
 writeWalletData({...readWalletData(storage),transactions:[]},storage);
 applyWalletTransaction({type:'sub',amount:20},storage);
 completePaidWork(storage,{...paid,project:{...paid.project,salaryPaid:false}},62000);
 assert.equal(readWalletData(storage).balance,280);
});
test('wallet failure keeps recoverable delivery without advancing to next day',()=>{
 const base=memory(); const storage={...base,setItem:(k,v)=>{if(k==='roleplayWallet')throw Error('quota');base.setItem(k,v);}};
 assert.throws(()=>completePaidWork(storage,ready(),61000),/钱包写入/);
 const pending=JSON.parse(base.getItem(SAVE_KEY));assert.equal(pending.project.delivered,true);assert.equal(pending.project.salaryPaid,false);
 assert.equal(transition(pending,{type:'nextDay'}),pending);
 const paid=completePaidWork(base,pending,61000);assert.equal(readWalletData(base).balance,300);assert.equal(transition(paid,{type:'nextDay'}).day,2);
});
test('legacy delivered saves are not paid retroactively; new day earns wages',()=>{
 const old=createCareer({id:'w',name:'世界'},[],'project');old.project.delivered=true;
 const migrated=initializePayroll(old,{id:'legacy',now:1000});assert.equal(migrated.project.salaryPaid,true);assert.equal(migrated.project.wage,0);
 const next=transition(migrated,{type:'nextDay'});assert.equal(next.project.wage,300);assert.equal(next.project.startedAt,null);
});
test('a failure after wallet credit is recoverable without crediting twice',()=>{
 const base=memory();let saves=0;
 const failing={...base,setItem:(k,v)=>{if(k===SAVE_KEY&&++saves===2)throw Error('quota');base.setItem(k,v);}};
 assert.throws(()=>completePaidWork(failing,ready(),61000),/进度保存失败/);
 assert.equal(readWalletData(base).balance,300);
 const pending=JSON.parse(base.getItem(SAVE_KEY));
 const recovered=completePaidWork(base,pending,62000);
 assert.equal(recovered.project.salaryPaid,true);assert.equal(readWalletData(base).balance,300);
});
