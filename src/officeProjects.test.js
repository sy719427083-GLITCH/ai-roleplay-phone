import test from 'node:test';
import assert from 'node:assert/strict';
import { openProjectBoard, refreshProjectBoard, freeRefreshes, PROJECTS_KEY } from './officeProjects.js';
import { readWalletData, writeWalletData } from './walletStore.js';
const day = new Date(2026,8,21,12).getTime();
function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('initial five complete unique projects persist without using free quota',()=>{
 const s=memory(),b=openProjectBoard(s,day);assert.equal(b.projects.length,5);assert.equal(new Set(b.projects.map(p=>p.name)).size,5);
 for(const p of b.projects){assert.ok(p.amount>0 && p.minutes>0 && p.content.length>20);}
 assert.deepEqual(openProjectBoard(s,day),b);assert.equal(freeRefreshes(b,day),5);
});
test('five free refreshes then debit exactly 200 with a wallet expense',()=>{
 const s=memory();writeWalletData({balance:450,transactions:[],incomeReceiptIds:['old']},s);let b=openProjectBoard(s,day);
 for(let i=0;i<5;i++){const old=b;b=refreshProjectBoard(s,day);assert.notDeepEqual(b.projects.map(p=>p.name),old.projects.map(p=>p.name));assert.equal(readWalletData(s).balance,450);}
 assert.equal(freeRefreshes(b,day),0);b=refreshProjectBoard(s,day);assert.equal(readWalletData(s).balance,250);assert.equal(readWalletData(s).transactions[0].amount,200);assert.deepEqual(readWalletData(s).incomeReceiptIds,['old']);
 b=refreshProjectBoard(s,day);assert.equal(readWalletData(s).balance,50);const before=s.getItem(PROJECTS_KEY);assert.throws(()=>refreshProjectBoard(s,day),/余额不足/);assert.equal(s.getItem(PROJECTS_KEY),before);
});
test('next local date restores quota without silently replacing projects',()=>{
 const s=memory();openProjectBoard(s,day);for(let i=0;i<5;i++)refreshProjectBoard(s,day);const b=openProjectBoard(s,day+86400000);assert.equal(freeRefreshes(b,day+86400000),5);refreshProjectBoard(s,day+86400000);assert.equal(readWalletData(s).balance,0);
});
test('paid refresh recovery cannot charge twice even after clearing wallet history',()=>{
 const base=memory();writeWalletData({balance:600,transactions:[]},base);openProjectBoard(base,day);for(let i=0;i<5;i++)refreshProjectBoard(base,day);
 let writes=0;const s={...base,setItem:(k,v)=>{if(k===PROJECTS_KEY && ++writes===2)throw Error('quota');base.setItem(k,v);}};
 assert.throws(()=>refreshProjectBoard(s,day),/保存/);assert.equal(readWalletData(base).balance,400);
 const w=readWalletData(base);writeWalletData({...w,transactions:[]},base);const recovered=openProjectBoard(base,day);assert.equal(recovered.used,6);assert.equal(readWalletData(base).balance,400);assert.deepEqual(openProjectBoard(base,day),recovered);
});
test('failed journal write never debits wallet and corrupt data does not reset quota',()=>{
 const base=memory();writeWalletData({balance:600,transactions:[]},base);openProjectBoard(base,day);for(let i=0;i<5;i++)refreshProjectBoard(base,day);
 const s={...base,setItem:()=>{throw Error('quota');}};assert.throws(()=>refreshProjectBoard(s,day),/保存/);assert.equal(readWalletData(base).balance,600);
 base.setItem(PROJECTS_KEY,'bad');assert.throws(()=>openProjectBoard(base,day),/读取/);
});
test('wallet write failure never exposes the unpaid batch and reopen restores original',()=>{
 const base=memory();writeWalletData({balance:600,transactions:[]},base);openProjectBoard(base,day);for(let i=0;i<5;i++)refreshProjectBoard(base,day);const before=openProjectBoard(base,day);
 const s={...base,setItem:(k,v)=>{if(k==='roleplayWallet')throw Error('quota');base.setItem(k,v);}};
 assert.throws(()=>refreshProjectBoard(s,day),/钱包写入失败/);assert.equal(readWalletData(base).balance,600);assert.deepEqual(openProjectBoard(base,day),before);
});
