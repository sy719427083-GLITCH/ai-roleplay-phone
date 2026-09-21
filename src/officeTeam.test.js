import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOfficeTeam, readOfficeTeam, saveOfficeTeam, OFFICE_TEAM_KEY } from './officeTeam.js';
import { createOfficeLife, advanceOfficeLife, assignOfficeTask } from './officeLife.js';
test('team persists separately and invalid/demoted supervisors cannot retain reports',()=>{
 const writes=new Map();const storage={getItem:k=>writes.get(k),setItem:(k,v)=>writes.set(k,v)};
 let team=normalizeOfficeTeam({mode:'ai',roles:{'employee-1':'supervisor'},managers:{'employee-2':'employee-1'}});
 assert.equal(saveOfficeTeam(storage,team).ok,true);assert.equal(readOfficeTeam(storage).managers['employee-2'],'employee-1');
 team=normalizeOfficeTeam({...team,roles:{'employee-1':'employee'}});assert.equal(team.managers['employee-2'],'boss');
 assert.deepEqual([...writes.keys()],[OFFICE_TEAM_KEY]);assert.equal(readOfficeTeam({getItem:()=>'{'}).mode,'local');
 assert.equal(saveOfficeTeam({setItem:()=>{throw Error();}},team).ok,false);
});
test('only direct supervisors can assign work and travelling staff retain a queued task until home',()=>{
 const roster=[{id:'boss',role:'boss',name:'老板'},{id:'employee-1',role:'supervisor',name:'主管',managerId:'boss'},{id:'employee-2',role:'employee',name:'员工',managerId:'employee-1'}];
 let s=createOfficeLife(33,roster);assert.equal(assignOfficeTask(s,'boss','employee-2','核对报表',roster),s);
 s=assignOfficeTask(s,'employee-1','employee-2','核对报表',roster);
 assert.ok(s.actors.find(a=>a.id==='employee-2').pendingTask);
 let done=false;for(let i=0;i<2000;i++){s=advanceOfficeLife(s,100,roster);if(s.actors.find(a=>a.id==='employee-2').workLine==='主管安排：核对报表'){done=true;break;}}
 assert.ok(done);
});
test('dialogue hold keeps the group together until playback completes',()=>{
 let s=createOfficeLife(55);for(let i=0;i<3000&&!s.actors.some(a=>a.group&&a.phase==='active');i++)s=advanceOfficeLife(s,100);
 const group=s.actors.find(a=>a.group&&a.phase==='active').group;
 for(let i=0;i<600;i++)s=advanceOfficeLife(s,100,[],group);
 assert.ok(s.actors.filter(a=>a.group===group).every(a=>a.phase==='active'));
 s=advanceOfficeLife(s,100);assert.ok(s.actors.filter(a=>a.group===group).every(a=>a.phase==='returning'));
});
