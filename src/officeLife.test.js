import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeLife, advanceOfficeLife, officeActorPosition, officeActorStatus, routeBetween, LOCATIONS } from './officeLife.js';
import { OFFICE_DESKS } from './officeSceneLayout.js';
const roster=OFFICE_DESKS.map((d,i)=>({id:d.id,name:`角色${i}`,identity:d.id}));
const step=(s,ms)=>{for(let n=0;n<ms;n+=100)s=advanceOfficeLife(s,Math.min(100,ms-n),roster);return s;};
test('travel follows walkways and never intersects desk interiors',()=>{
 for(const desk of OFFICE_DESKS){
  for(const target of ['coffee','printer','chat-0','chat-1','chat-2']){
   const path=routeBetween(desk.id,target);
   for(let i=1;i<path.length;i++)for(let j=0;j<=30;j++){
    const x=path[i-1][0]+(path[i][0]-path[i-1][0])*j/30;
    const y=path[i-1][1]+(path[i][1]-path[i-1][1])*j/30;
    assert.ok(Number.isFinite(x)&&Number.isFinite(y));
    assert.ok(!OFFICE_DESKS.some(d=>x>d.box[0]&&x<d.box[0]+d.box[2]&&y>d.box[1]&&y<d.box[1]+d.box[3]),`${desk.id} -> ${target}: ${x},${y}`);
   }
  }
 }
});
test('autonomous timeline reserves coffee and printer, starts chats only after rendezvous and returns people home',()=>{
 let s=createOfficeLife(42);const seen=new Set();let returned=false;
 for(let n=0;n<3600;n++){
  const before=s;s=advanceOfficeLife(s,100,roster);
  for(const task of ['coffee','printer'])assert.ok(s.actors.filter(a=>a.task===task&&['walking','active'].includes(a.phase)).length<=1);
  for(const a of s.actors){
   seen.add(a.phase==='active'?a.task:a.phase);
   const p=officeActorPosition(a,s.now);assert.ok(p.every(Number.isFinite));
   if(a.phase==='active')assert.deepEqual(p,LOCATIONS[a.destination].point);
   if(a.phase==='working'&&before.actors.find(b=>b.id===a.id).phase==='returning'){returned=true;assert.deepEqual(p,LOCATIONS[a.id].point);}
   if(a.task==='chat'&&a.phase==='active')assert.ok(s.actors.filter(b=>b.group===a.group).every(b=>b.phase==='active'));
  }
 }
 assert.ok(seen.has('coffee'));assert.ok(seen.has('chat'));assert.ok(seen.has('printer'));assert.ok(returned);
});
test('status describes travelling separately from doing an activity and uses the actual participant names',()=>{
 let s=step(createOfficeLife(7),3000);const walking=s.actors.find(a=>a.phase==='walking');assert.ok(walking);
 assert.match(officeActorStatus(walking,s,roster),/前往/);
 for(let n=0;n<1200&&!s.actors.some(a=>a.task==='chat'&&a.phase==='active');n++)s=advanceOfficeLife(s,100,roster);
 const chatting=s.actors.find(a=>a.task==='chat'&&a.phase==='active');assert.ok(chatting);
 const partner=s.actors.find(a=>a.group===chatting.group&&a.id!==chatting.id);
 assert.ok(officeActorStatus(chatting,s,roster).includes(roster.find(r=>r.id===partner.id).name));
});
test('nonpositive time is inert and seeded schedules are reproducible',()=>{
 const s=createOfficeLife(123);assert.equal(advanceOfficeLife(s,0,roster),s);assert.equal(advanceOfficeLife(s,-1,roster),s);
 assert.deepEqual(step(s,60000),step(createOfficeLife(123),60000));
});

test('changing a participant identity safely ends a chat without teleporting',()=>{
 let s=createOfficeLife(7);
 for(let n=0;n<1200&&!s.actors.some(a=>a.task==='chat'&&a.phase==='active');n++)s=advanceOfficeLife(s,100,roster);
 const members=s.actors.filter(a=>a.phase==='active'&&a.task==='chat');assert.ok(members.length>=2);
 const changed=roster.map(p=>members.some(a=>a.id===p.id)?{...p,identity:'same-source'}:p);
 const before=new Map(members.map(a=>[a.id,officeActorPosition(a,s.now)]));
 s=advanceOfficeLife(s,100,changed);
 for(const member of members){
  const a=s.actors.find(a=>a.id===member.id);assert.equal(a.phase,'returning');
  assert.deepEqual(officeActorPosition(a,s.now),before.get(a.id));
 }
});
