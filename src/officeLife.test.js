import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeLife, advanceOfficeLife, officeActorPosition, officeActorStatus, syncOfficeRoster, routeBetween, LOCATIONS } from './officeLife.js';
import { OFFICE_DESKS } from './officeSceneLayout.js';
const roster=OFFICE_DESKS.map((d,i)=>({id:d.id,name:`角色${i}`,identity:d.id}));
const step=(s,ms)=>{for(let n=0;n<ms;n+=100)s=advanceOfficeLife(s,Math.min(100,ms-n),roster);return s;};
test('travel follows walkways and never intersects desk interiors',()=>{
 for(const desk of OFFICE_DESKS){
  for(const target of ['coffee','coffee-1','coffee-2','printer','board','files','plant','report','chat-0','chat-1','chat-2',...OFFICE_DESKS.filter(d=>d.id!=='boss').flatMap(d=>[`visit-${d.id}`,`visit2-${d.id}`])]){
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
test('status shows concrete actions without category, assignment or participant decorations',()=>{
 let s=step(createOfficeLife(7),3000);const walking=s.actors.find(a=>a.phase==='walking');assert.ok(walking);
 assert.match(officeActorStatus(walking,s,roster),/前往|找同事|汇报|查找|照料/);
 for(let n=0;n<1200&&!s.actors.some(a=>a.task==='chat'&&a.phase==='active');n++)s=advanceOfficeLife(s,100,roster);
 const chatting=s.actors.find(a=>a.task==='chat'&&a.phase==='active');assert.ok(chatting);
 const partner=s.actors.find(a=>a.group===chatting.group&&a.id!==chatting.id);
 assert.ok(!officeActorStatus(chatting,s,roster).includes(roster.find(r=>r.id===partner.id).name));
 assert.equal(officeActorStatus({phase:'working',workLine:'摸鱼：刷抖音'},s),'刷抖音');
 assert.equal(officeActorStatus({phase:'working',workLine:'主管安排：核对数据'},s),'核对数据');
 assert.equal(officeActorStatus({phase:'active',task:'chat',activity:{label:'工位闲聊 · 员工01工位'}},s),'闲聊');
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
  const a=s.actors.find(a=>a.id===member.id);assert.equal(a.phase,a.id===member.location?'working':'returning');
  assert.deepEqual(officeActorPosition(a,s.now),before.get(a.id));
 }
});

test('home positions are centered on every desk, with a front exit into the aisle',()=>{
 for(const {id,box:[x,y,w,h]} of OFFICE_DESKS){
  assert.equal(LOCATIONS[id].point[0],x+w/2);
  assert.equal(LOCATIONS[id].point[1],y+h+35);
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

test('desk visits keep the host at their desk, start together, and return only the visitor',()=>{
 let s=createOfficeLife(991,roster),host,visitor,group;
 for(let i=0;i<12000;i++){
  s=advanceOfficeLife(s,100,roster);
  host=s.actors.find(a=>a.visitHostId===a.id&&a.phase==='waiting');
  if(host){group=host.group;visitor=s.actors.find(a=>a.group===group&&a.id!==host.id);break;}
 }
 assert.ok(host,'a desk visit should occur');assert.ok(visitor);
 assert.equal(visitor.phase,'walking');assert.deepEqual(officeActorPosition(host,s.now),LOCATIONS[host.id].point);
 assert.equal(visitor.destination,`visit-${host.id}`);
 for(let i=0;i<600&&s.actors.find(a=>a.id===visitor.id).phase!=='active';i++){
  s=advanceOfficeLife(s,100,roster);assert.deepEqual(officeActorPosition(s.actors.find(a=>a.id===host.id),s.now),LOCATIONS[host.id].point);
 }
 assert.ok(s.actors.filter(a=>a.group===group).every(a=>a.phase==='active'));
 for(let i=0;i<600;i++)s=advanceOfficeLife(s,100,roster,group);
 assert.ok(s.actors.filter(a=>a.group===group).every(a=>a.phase==='active'));
 assert.deepEqual(officeActorPosition(s.actors.find(a=>a.id===host.id),s.now),LOCATIONS[host.id].point);
 for(let i=0;i<400;i++){s=advanceOfficeLife(s,100,roster);if(s.actors.find(a=>a.id===visitor.id).phase==='returning')break;}
 assert.equal(s.actors.find(a=>a.id===host.id).phase,'working');
 assert.equal(s.actors.find(a=>a.id===visitor.id).phase,'returning');
});

test('only selected roster actors exist; removing a chatting participant cancels the group',()=>{
 let s=createOfficeLife(7,[]);assert.deepEqual(s.actors,[]);
 for(let n=0;n<100;n++)s=advanceOfficeLife(s,100,[]);assert.deepEqual(s.actors,[]);
 const chosen=roster.slice(1,3);s=syncOfficeRoster(s,chosen);assert.deepEqual(s.actors.map(a=>a.id),chosen.map(p=>p.id));
 s={...s,actors:s.actors.map(a=>({...a,phase:'active',task:'chat',group:'test',identity:a.id}))};
 const reduced=syncOfficeRoster(s,[chosen[0]]);assert.equal(reduced.actors.length,1);assert.equal(reduced.actors[0].cancelChat,true);
 const replaced=syncOfficeRoster(reduced,[{...chosen[0],identity:'replacement'}]);assert.equal(replaced.actors[0].identity,'replacement');assert.equal(replaced.actors[0].phase,'working');assert.equal(replaced.actors[0].group,null);
});
