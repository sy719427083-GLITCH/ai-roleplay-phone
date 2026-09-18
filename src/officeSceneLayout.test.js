import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_FRAME, OFFICE_OBJECTS, OFFICE_DESKS, objectStyle, avatarStyle } from './officeSceneLayout.js';
import { OFFICE_SEATS } from './officeProfiles.js';
test('approved scene excludes raster UI strips and contains all editable seats',()=>{
 assert.equal(OFFICE_FRAME.top,96);
 assert.equal(OFFICE_FRAME.top + OFFICE_FRAME.sceneHeight,1702);
 assert.deepEqual(OFFICE_DESKS.map(d=>d.id),OFFICE_SEATS);
 for(const object of [...OFFICE_OBJECTS,...OFFICE_DESKS]){
  const [x,y,w,h]=object.box;
  assert.ok(x>=0&&y>=96&&x+w<=853&&y+h<=1702,object.id);
  for(const value of Object.values(objectStyle(object)).filter(v=>typeof v==='string')) assert.ok(!value.includes('NaN')&&!value.includes('Infinity'),object.id);
 }
});
test('avatars track their own desk under uniform scene scaling',()=>{
 for(const desk of OFFICE_DESKS){
  const [x,y,w,h]=desk.box;const [ax,ay]=desk.avatar;
  assert.ok(ax>=x && ax+80<=x+w && ay>=y && ay+80<=y+h,desk.id);
  const style=avatarStyle(desk.avatar);
  for(const scale of [.3,.457,.6]){
   assert.ok(Math.abs(parseFloat(style.left)/100*853*scale-ax*scale)<.01);
   assert.ok(Math.abs(parseFloat(style.top)/100*1606*scale-(ay-96)*scale)<.01);
  }
 }
});
