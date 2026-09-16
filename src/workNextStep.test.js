import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkNextStep } from './workNextStep.js';
test('next step is start, optional collaboration, then finish; no writing gates',()=>{
 const p={accepted:false,researched:false,draft:'',reviewed:false,delivered:false,salaryPaid:false};
 assert.equal(getWorkNextStep(p,0).target,'ws-brief');p.accepted=true;
 assert.equal(getWorkNextStep(p,1000).target,'ws-support');
 assert.equal(getWorkNextStep(p,0).target,'ws-delivery');
 p.delivered=true;assert.match(getWorkNextStep(p,0).label,/结算/);
 p.salaryPaid=true;assert.equal(getWorkNextStep(p,0).target,'ws-next-day');
});
