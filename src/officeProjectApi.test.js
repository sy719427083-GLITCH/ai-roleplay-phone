import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeneratedProjects, requestOfficeProjects } from './officeProjectApi.js';
import { generateOfficeProjectBoard } from './officeProjectGeneration.js';
import { openProjectBoard, refreshProjectBoard, PROJECTS_KEY } from './officeProjects.js';
import { readWalletData, writeWalletData } from './walletStore.js';
import { STORAGE_KEY } from './apiConfig.js';
import { generatedFixture } from './officeProjectFixtures.test-helper.js';
const config={mainConfigs:[{id:'main',baseUrl:'https://example.test/v1',apiKey:'test-key',modelMode:'manual',customModel:'test-model'}],selectedMainId:'main'};
const memory=()=>{const m=new Map([[STORAGE_KEY,JSON.stringify(config)]]);return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
const reply=projects=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({projects})}}]})});
test('AI projects validate all fields, compute rewards, reject repeated or malformed items',()=>{
 const items=generatedFixture();assert.equal(parseGeneratedProjects(JSON.stringify({projects:items}))[0].amount,600);
 assert.throws(()=>parseGeneratedProjects(JSON.stringify({projects:items}),items),/重复/);
 assert.throws(()=>parseGeneratedProjects(JSON.stringify({projects:[...items.slice(0,4),items[0]]})),/重复/);
 assert.throws(()=>parseGeneratedProjects(JSON.stringify({projects:items.map(p=>({...p,minutes:0}))})),/时间/);
 assert.throws(()=>parseGeneratedProjects('{}'),/5/);
});
test('request uses selected main API and retries duplicate response once',async()=>{
 const storage=memory(),old=generatedFixture(),fresh=generatedFixture();let calls=0;
 const result=await requestOfficeProjects({storage,history:old,fetchImpl:async(url,init)=>{assert.equal(url,'https://example.test/v1/chat/completions');const body=JSON.parse(init.body);assert.equal(body.model,'test-model');assert.ok(body.messages[1].content.includes(old[0].name));return reply(++calls===1?old:fresh);}});
 assert.equal(calls,2);assert.equal(result[0].name,fresh[0].name);
});
test('missing API never falls back to local projects or consumes allowance',async()=>{
 const storage=memory();storage.setItem(STORAGE_KEY,'{}');await assert.rejects(generateOfficeProjectBoard({storage}),/主 API/);assert.equal(openProjectBoard(storage).projects.length,0);assert.equal(openProjectBoard(storage).used,0);
});
test('HTTP failure, repeated responses and aborted response preserve board and wallet',async()=>{
 const storage=memory();refreshProjectBoard(storage,Date.now(),generatedFixture());writeWalletData({balance:1000,transactions:[]},storage);const before=storage.getItem(PROJECTS_KEY);
 await assert.rejects(generateOfficeProjectBoard({storage,fetchImpl:async()=>({ok:false,status:500})}),/HTTP 500/);
 const old=openProjectBoard(storage).projects;let calls=0;await assert.rejects(generateOfficeProjectBoard({storage,fetchImpl:async()=>{calls++;return reply(old);}}),/重复/);assert.equal(calls,2);
 const c=new AbortController();await assert.rejects(generateOfficeProjectBoard({storage,signal:c.signal,fetchImpl:async()=>{c.abort();return reply(generatedFixture());}}),{name:'AbortError'});
 assert.equal(storage.getItem(PROJECTS_KEY),before);assert.equal(readWalletData(storage).balance,1000);
});
test('network generation does not hold wallet lock and stale results cannot charge',async()=>{
 const storage=memory();refreshProjectBoard(storage,Date.now(),generatedFixture());let inside=false;
 const lock=async action=>{inside=true;try{return action();}finally{inside=false;}};
 await assert.rejects(generateOfficeProjectBoard({storage,lock,fetchImpl:async()=>{assert.equal(inside,false);refreshProjectBoard(storage,Date.now(),generatedFixture());return reply(generatedFixture());}}),/其他页面/);
 assert.equal(openProjectBoard(storage).used,1);
});
test('first AI batch is free, successful replacement counts once and longer time pays more',async()=>{
 const storage=memory();const generate=()=>generateOfficeProjectBoard({storage,fetchImpl:async()=>reply(generatedFixture())});
 const first=await generate();assert.equal(first.source,'ai');assert.equal(first.used,0);const second=await generate();assert.equal(second.used,1);assert.notEqual(first.batchId,second.batchId);assert.equal(second.history.length,5);
 const sorted=second.projects.sort((a,b)=>a.minutes-b.minutes);for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].amount>sorted[i-1].amount);
});
