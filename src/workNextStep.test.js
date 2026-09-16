import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkNextStep } from './workNextStep.js';
test('timer expiry still guides through actual prerequisites',()=>{
 const p={accepted:false,researched:false,draft:'',reviewed:false,delivered:false,salaryPaid:false};
 assert.equal(getWorkNextStep(p,0).target,'ws-brief');p.accepted=true;
 assert.equal(getWorkNextStep(p,0).target,'ws-research');p.researched=true;
 assert.equal(getWorkNextStep(p,0).target,'ws-draft');assert.match(getWorkNextStep(p,0).hint,/30/);
 p.draft='已经填写三十字以上的工作方案，说明目标安排以及遇到异常时的处理方式。';
 assert.equal(getWorkNextStep(p,0).target,'ws-review');p.reviewed=true;
 assert.equal(getWorkNextStep(p,1000).target,null);
 assert.equal(getWorkNextStep(p,0).target,'ws-delivery');
 p.delivered=true;assert.match(getWorkNextStep(p,0).label,/结算/);
 p.salaryPaid=true;assert.equal(getWorkNextStep(p,0).target,'ws-next-day');
});
