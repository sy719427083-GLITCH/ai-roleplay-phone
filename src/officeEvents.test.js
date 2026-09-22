import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeEvent, resolveOfficeEvent, readOfficeEvents, writeOfficeEvents, officeMemories, OFFICE_EVENTS_KEY, officeRelationship } from './officeEvents.js';
import { createOfficeLife, inviteOfficeEvent, releaseOfficeEvent, advanceOfficeLife, syncOfficeRoster, officeActorStatus } from './officeLife.js';
const person={id:'employee-1',sourceKey:'character:a',identity:'character:a',name:'甲'};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}};
test('choices persist once, cooldown survives reopen and only matching character memories are exposed',()=>{
 const db=storage();let s=createOfficeEvent(readOfficeEvents(db),person,1000,()=>0);const id=s.active.id;
 s=resolveOfficeEvent(s,id,0,2000);assert.equal(s.history.length,1);assert.equal(resolveOfficeEvent(s,id,1),s);assert.equal(s.nextAt,122000);
 assert.equal(writeOfficeEvents(db,s),'');assert.deepEqual(readOfficeEvents(db),s);assert.equal(officeMemories(db,person.sourceKey).length,1);assert.deepEqual(officeMemories(db,'character:b'),[]);assert.deepEqual(officeRelationship(s.history,person.sourceKey),{mood:2,trust:2});
 const next=createOfficeEvent(s,person,3000,()=>0);assert.notEqual(next.active.type,s.history[0].type);
});
test('invalid choices and save failures cannot claim success',()=>{const s=createOfficeEvent({history:[]},person,1,()=>0);assert.equal(resolveOfficeEvent(s,s.active.id,99),s);assert.match(writeOfficeEvents({setItem(){throw Error();}},s),/失败/);assert.deepEqual(readOfficeEvents({getItem:()=>'{oops'}).history,[]);});
test('employee approaches boss desk, waits through time, returns after response, and can be removed',()=>{
 let s=createOfficeLife(7,[]);s=syncOfficeRoster(s,[person]);s=inviteOfficeEvent(s,person.id);assert.equal(s.actors[0].task,'event');assert.equal(s.actors[0].destination,'report');
 for(let i=0;i<800;i++)s=advanceOfficeLife(s,250,[person]);assert.equal(s.actors[0].phase,'active');assert.equal(s.actors[0].location,'report');
 s=releaseOfficeEvent(s,person.id);assert.equal(officeActorStatus(s.actors[0],s),'返回工位');s=advanceOfficeLife(s,100,[person]);assert.equal(s.actors[0].phase,'returning');assert.deepEqual(syncOfficeRoster(s,[]).actors,[]);
});
test('history is bounded and does not write source records',()=>{const db=storage();let s={history:[],active:null};for(let i=0;i<70;i++){s=createOfficeEvent(s,person,i,()=>0);s=resolveOfficeEvent(s,s.active.id,1,i);}assert.equal(s.history.length,60);writeOfficeEvents(db,s);assert.equal(db.getItem('apiCharacters'),undefined);assert.ok(db.getItem(OFFICE_EVENTS_KEY));});
