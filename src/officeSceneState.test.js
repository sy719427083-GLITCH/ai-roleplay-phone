import test from 'node:test';
import assert from 'node:assert/strict';
import { officeMode, officeCast } from './officeSceneState.js';
test('scene follows actual shift and prioritizes delivery over a break', () => {
 assert.equal(officeMode({accepted:false}, 'work'), 'arriving');
 assert.equal(officeMode({accepted:true}, 'work'), 'typing');
 assert.equal(officeMode({accepted:true}, 'coffee'), 'coffee');
 assert.equal(officeMode({accepted:true}, 'work', 'support'), 'talking');
 assert.equal(officeMode({accepted:true,delivered:true}, 'coffee'), 'leaving');
});
test('cast includes selected partner with at most three unique colleagues', () => {
 const people=Array.from({length:5},(_,i)=>({id:String(i),name:`角色${i}`}));
 assert.deepEqual(officeCast(people,'4').map(p=>p.id),['4','0','1']);
 assert.deepEqual(officeCast([],''),[]);
 assert.equal(people[0].id,'0');
});
