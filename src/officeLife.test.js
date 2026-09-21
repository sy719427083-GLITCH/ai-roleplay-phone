import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeLife, advanceOfficeLife, officeActorPosition, officeActorStatus, routeBetween, LOCATIONS } from './officeLife.js';
import { OFFICE_DESKS } from './officeSceneLayout.js';
const roster=OFFICE_DESKS.map((d,i)=>({id:d.id,name:`角色${i}`,identity:d.id}));
const step=(s,ms)=>{for(let n=0;n<ms;n+=100)s=advanceOfficeLife(s,Math.min(100,ms-n),roster);return s;};
test('travel follows walkways and never intersects desk interiors',()=>{
 for(const desk of OFFICE_DESKS){
  for(const target of ['coffee','printer','board','files','plant','report','chat-0','chat-1','chat-2']){
   const path=routeBetween(desk.id,target);
   for(let i=1;i<path.length;i++)for(let j=0;j<=30;j++){
    const x=path[i-1][0]+(path[i][0]-path[i-1][0])*j/30;
    const y=path[i-1][1]+(path[i][1]-path[i-1][1])*j/30;
    assert.ok(Number.isFinite(x)&&Number.isFinite(y));
    assert.ok(!OFFICE_DESKS.some(d=>d.id!==desk.id&&x>d.box[0]&&x<d.box[0]+d.box[2]&&y>d.box[1]&&y<d.box[1]+d.box[3]),`${desk.id} -> ${target}: ${x},${y}`);
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
 assert.equal(officeActorStatus(walking,s,roster),walking.activity.go);
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

test('home positions are centered on every desk, with a front exit into the aisle',()=>{
 for(const {id,box:[x,y,w,h]} of OFFICE_DESKS){
  assert.equal(LOCATIONS[id].point[0],x+w/2);
  assert.equal(LOCATIONS[id].point[1]-65,y+h/2);
  assert.ok(LOCATIONS[id].via[1][1]>y+h);
 }
});
test('different visits have different initial activities and do not follow a fixed event cycle',()=>{
 const starts=new Set();const firstTasks=new Set();
 for(let seed=1;seed<=30;seed++){
  const s=createOfficeLife(seed*7919,roster);
  starts.add(JSON.stringify(s.actors.map(a=>[a.workLine,a.phase,a.activity?.id])));
  firstTasks.add(s.lastActivity);
 }
 assert.ok(starts.size>25);assert.ok(firstTasks.size>5);
});
test('long-running office includes all leisure actions and diverse chores without immediate desk repeats',()=>{
 let s=createOfficeLife(917,roster);const moods=new Set(),activities=new Set();
 for(let n=0;n<24000;n++){
  const before=s;s=advanceOfficeLife(s,250,roster);
  for(const a of s.actors){
   if(a.phase==='working')moods.add(a.mood);
   if(a.activity)activities.add(a.activity.id);
   const b=before.actors.find(p=>p.id===a.id);
   if(a.phase==='working'&&b.phase==='working'&&a.deskUntil!==b.deskUntil)assert.notEqual(a.workLine,b.workLine);
  }
  for(const task of ['coffee','printer','board','files','plant','report'])assert.ok(s.actors.filter(a=>a.task===task&&['walking','active'].includes(a.phase)).length<=1);
 }
 for(const mood of ['work','think','rest','tv','video','game'])assert.ok(moods.has(mood),mood);
 for(const id of ['coffee','tea','water','printer','copy','board','files','plant','report'])assert.ok(activities.has(id),id);
});
