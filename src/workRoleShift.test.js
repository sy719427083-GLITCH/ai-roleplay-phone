import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, transition } from './workSimulation.js';
import { makeRoleWorkPrompt } from './workRoleShift.js';
const person={id:'p',name:'林',identity:'协调员'};
const start=()=>transition({...createCareer({id:'w',name:'星港'},[person],'project'),payrollId:'shift-1',workDurationMs:60000},{type:'brief',now:1000});
test('accepted work can finish after countdown without writing or checking',()=>{
 const s=start();assert.equal(s.project.draft,'');assert.equal(s.project.reviewed,false);
 assert.equal(transition(s,{type:'deliver',now:50000}),s);
 const done=transition(s,{type:'deliver',now:61000});assert.equal(done.project.delivered,true);
});
test('successful character assistance shortens time once and leaves a shared record',()=>{
 const s=start();const action={type:'roleScene',phase:'support',choice:'delegate',personId:'p',personName:'林',reply:'我来核实资料，你负责通知。',now:11000};
 const helped=transition(s,action);assert.equal(helped.project.timeSavedMs,12000);assert.equal(helped.relations.p,1);
 assert.equal(transition(helped,action),helped);assert.equal(helped.project.scenes.length,1);
 assert.equal(transition(helped,{type:'deliver',now:49000}).project.delivered,true);
});
test('unknown characters, empty replies and assistance before starting have no effect',()=>{
 const s=start();assert.equal(transition(s,{type:'roleScene',phase:'support',choice:'delegate',personId:'other',reply:'hello'}),s);
 assert.equal(transition(s,{type:'roleScene',phase:'support',choice:'delegate',personId:'p',reply:''}),s);
});
test('character feedback can arrive after payment without changing salary or completion',()=>{
 const s=transition(start(),{type:'deliver',now:61000});
 const updated=transition(s,{type:'roleScene',phase:'finish',personId:'p',personName:'林',reply:'这次合作很顺利。'});
 assert.equal(updated.completed,1);assert.match(updated.history[0].draft,/这次合作/);
});
test('scene prompt includes the chosen approach and actual work record',()=>{
 const s=start();s.project.scenes=[{personId:'p',phase:'support',reply:'我来核实',choice:'delegate'}];
 assert.match(makeRoleWorkPrompt('finish',s,person),/我来核实/);
 assert.match(makeRoleWorkPrompt('support',s,person,'delegate'),/分工/);
});
test('remaining timer cannot briefly exceed duration before the next UI clock tick',async()=>{
 const {remainingWorkMs}=await import('./workPayroll.js');assert.equal(remainingWorkMs(start(),500),60000);
});
