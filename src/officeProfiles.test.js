import test from 'node:test';
import assert from 'node:assert/strict';
import { readOfficeSources, readOfficeAvatars, resolveSeat, saveOfficeAvatar, validateAvatarUrl, OFFICE_AVATARS_KEY } from './officeProfiles.js';
const storage = (records = {}) => { const data = new Map(Object.entries(records)); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), data }; };
test('seats use Me for boss and six Characters without requiring a worldbook', () => {
 const s=storage({ apiMeProfiles: JSON.stringify({me:{name:'我',avatar:'https://example.com/me.png'}}),apiCharacters:JSON.stringify({a:{name:'甲',avatar:'https://example.com/a.png'},b:{name:'乙'}})});
 const sources=readOfficeSources(s);
 assert.equal(resolveSeat('boss',{},sources).name,'我');
 assert.equal(resolveSeat('employee-1',{},sources).name,'甲');
 assert.equal(resolveSeat('employee-6',{},sources).avatar,'');
});
test('upload and URL overrides persist only inside Work, retaining selected identity', () => {
 const original=JSON.stringify({a:{name:'甲',avatar:'https://example.com/original.png'}});
 const s=storage({apiCharacters:original});const sources=readOfficeSources(s);
 const result=saveOfficeAvatar(s,{},'employee-1',{sourceKey:'character:a',avatar:'https://example.com/new.png'});
 assert.equal(result.ok,true); assert.equal(s.getItem('apiCharacters'),original);
 assert.equal(s.data.size,2);assert.ok(s.getItem(OFFICE_AVATARS_KEY));
 const reloaded=readOfficeAvatars(s);assert.equal(resolveSeat('employee-1',reloaded,sources).avatar,'https://example.com/new.png');
 assert.equal(resolveSeat('employee-2',reloaded,sources).avatar,'');
});
test('malformed records and deleted source profiles degrade safely', () => {
 const s=storage({apiMeProfiles:'null',apiCharacters:'[]',[OFFICE_AVATARS_KEY]:'{"version":1,"seats":{"boss":false}}'});
 assert.deepEqual(readOfficeSources(s),[]);assert.deepEqual(readOfficeAvatars(s),{});
 assert.equal(resolveSeat('boss',{boss:{sourceKey:'me:deleted'}},[]).avatar,'');
});
test('rejects unsafe avatar URLs and unknown seats; reports storage failure without replacing state',()=>{
 for(const u of ['javascript:alert(1)','file:///a','data:text/html,x','not a url','https://u:p@example.com/a']) assert.equal(validateAvatarUrl(u),'');
 assert.equal(validateAvatarUrl(' https://example.com/a.png '),'https://example.com/a.png');
 const s=storage();assert.equal(saveOfficeAvatar(s,{},'other',{avatar:'https://example.com/a'}).ok,false);
 const broken={setItem(){throw new Error('quota');}};assert.equal(saveOfficeAvatar(broken,{},'boss',{avatar:'https://example.com/a'}).ok,false);
});
test('restoring default removes only this seat override',()=>{
 const s=storage(); const entries={boss:{avatar:'https://example.com/b'},'employee-1':{avatar:'https://example.com/a'}};
 const result=saveOfficeAvatar(s,entries,'boss',null);assert.equal(result.ok,true);assert.deepEqual(result.seats,{'employee-1':entries['employee-1']});
});
test('explicitly unlinked seat does not fall back to the default source',()=>{
 const sources=[{key:'me:one',kind:'me',name:'我',avatar:'https://example.com/me.png'}];
 assert.equal(resolveSeat('boss',{boss:{sourceKey:'',avatar:''}},sources).avatar,'');
});
test('saving a pending URL validates and loads it instead of silently saving the old avatar',async()=>{
 const {prepareOfficeAvatar}=await import('./officeProfiles.js');let loaded='';
 assert.deepEqual(await prepareOfficeAvatar({sourceKey:'me:a',avatar:'https://example.com/old',url:'https://example.com/new'},async u=>{loaded=u;}),{sourceKey:'me:a',avatar:'https://example.com/new'});
 assert.equal(loaded,'https://example.com/new');
 await assert.rejects(prepareOfficeAvatar({url:'javascript:alert(1)'},async()=>{}),/有效/);
 await assert.rejects(prepareOfficeAvatar({url:'https://example.com/broken'},async()=>{throw new Error('unavailable');}),/unavailable/);
});
