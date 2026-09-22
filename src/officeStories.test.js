import test from 'node:test';
import assert from 'node:assert/strict';
import { followOfficeStory, advanceOfficeLife, officeActorStatus, LOCATIONS } from './officeLife.js';
import { localOfficeStory, saveOfficeStory, readOfficeStories, storyMemories } from './officeStories.js';
const people=[1,2,3].map(n=>({id:`employee-${n}`,name:`同事${n}`,sourceKey:`character:${n}`}));
function scene(){return {now:100,seed:4,nextEventAt:1e9,actors:people.map((p,i)=>({id:p.id,phase:'active',task:'chat',group:'g',location:`chat-${i}`,activity:{label:'闲聊'},until:1e6}))};}
test('autonomous coffee visits separate anchors, holds until all arrive and returns without input',()=>{
 const result=followOfficeStory(scene(),'g','coffee','story');assert.equal(result.action,'coffee');let s=result.state;
 assert.equal(new Set(s.actors.map(a=>a.destination)).size,3);assert.ok(s.actors.every(a=>a.task==='story'));
 const lastArrival=Math.max(...s.actors.map(a=>a.arriveAt));
 while(s.now<lastArrival+1000)s=advanceOfficeLife(s,250,people);
 assert.ok(s.actors.every(a=>a.phase==='active'));assert.ok(s.actors.every(a=>officeActorStatus(a,s)==='一起喝咖啡'));
 for(let i=0;i<500;i++)s=advanceOfficeLife(s,250,people);
 assert.ok(s.actors.every(a=>a.phase==='working'&&!a.storyId));
});
test('three-person cooperation uses distinct desk anchors and rejects invalid or stale group actions',()=>{
 const result=followOfficeStory(scene(),'g','cooperate','story');assert.equal(new Set(result.state.actors.map(a=>a.destination)).size,3);
 result.state.actors.forEach(a=>assert.ok(LOCATIONS[a.destination]));
 assert.equal(followOfficeStory(scene(),'missing','coffee','s'),null);assert.equal(followOfficeStory(scene(),'g','pay','s'),null);
});
test('occupied coffee station yields truthful return-to-work decision',()=>{
 const state=scene();state.actors.push({id:'boss',task:'coffee',phase:'active'});const r=followOfficeStory(state,'g','coffee','s');assert.equal(r.action,'work');assert.match(r.reason,/茶水吧/);
});
test('local story carries an executable decision and every person speaks',()=>{
 const p=localOfficeStory(people,'工位合作',undefined,()=>0);assert.equal(p.action,'cooperate');people.forEach(x=>assert.ok(p.messages.some(m=>m.speaker===x.id)));assert.doesNotMatch(JSON.stringify(p),/等你|选择/);
});
test('bounded story log and memories belong to participating identities',()=>{
 let value;const storage={getItem:()=>value,setItem:(k,v)=>value=v};for(let i=0;i<45;i++)saveOfficeStory(storage,{id:String(i),participants:people,messages:[],action:'work',status:'已结束',topic:'讨论'});
 assert.equal(readOfficeStories(storage).length,40);assert.equal(storyMemories(storage,'character:1').length,5);assert.deepEqual(storyMemories(storage,'outsider'),[]);
});
