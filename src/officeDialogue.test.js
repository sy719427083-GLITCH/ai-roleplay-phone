import test from 'node:test';
import assert from 'node:assert/strict';
import { requestOfficeDialogue,parseOfficeDialogue,localOfficeDialogue } from './officeDialogue.js';
const participants=[{id:'employee-1',name:'甲',sourceKey:'character:a',role:'supervisor'},{id:'employee-2',name:'乙',sourceKey:'character:b',role:'employee',managerId:'employee-1',currentTask:'主管安排：核对数据'}];
const messages=[{speaker:'employee-1',text:'资料确认了吗？'},{speaker:'employee-2',text:'我正在核对。'}];
const storage={getItem:key=>JSON.stringify(key==='ccat-ai-api-configs'?{mainConfigs:[{id:'main',apiKey:'fake-test-key',baseUrl:'https://example.test/v1',model:'old',customModel:'chosen',modelMode:'manual'}],selectedMainId:'main'}:key==='apiCharacters'?{a:{personality:'严谨'},b:{personality:'细心'},c:{personality:'DO-NOT-SEND'}}:{secret:'PRIVATE-CHAT'})};
test('AI uses selected configuration and only participant context; returned speech is actual API output',async()=>{
 let called=false;const signal=new AbortController().signal;
 const result=await requestOfficeDialogue({storage,participants,topic:'交流进度',signal,fetchImpl:async(url,options)=>{called=true;assert.equal(url,'https://example.test/v1/chat/completions');assert.equal(options.signal,signal);const body=JSON.parse(options.body);assert.equal(body.model,'chosen');assert.match(options.body,/严谨/);assert.match(options.body,/主管安排：核对数据/);assert.doesNotMatch(options.body,/DO-NOT-SEND|PRIVATE-CHAT/);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({messages})}}]})};}});
 assert.ok(called);assert.deepEqual(result,messages);
});
test('API errors and malformed or foreign-speaker replies never silently become local dialogue',async()=>{
 await assert.rejects(requestOfficeDialogue({storage:{getItem:()=>null},participants,fetchImpl:()=>{throw Error('should not fetch');}}),/API/);
 await assert.rejects(requestOfficeDialogue({storage,participants,fetchImpl:async()=>({ok:false,status:401})}),/401/);
 for(const content of ['hello',JSON.stringify({messages:[messages[0],messages[0]]}),JSON.stringify({messages:[...messages,{speaker:'outsider',text:'hello'}]})])assert.throws(()=>parseOfficeDialogue(content,participants));
 assert.equal(localOfficeDialogue(participants,'项目方案').length,4);
});

test('later local speakers recall only their own stored event',()=>{
 const history=[{sourceKey:'character:b',choice:'一起帮忙',reply:'你帮我理清了思路。'}];
 const db={getItem:key=>key==='ccat-office-events-v1'?JSON.stringify({history}):null};
 const lines=localOfficeDialogue(participants,'进度',db);assert.doesNotMatch(lines[0].text,/理清/);assert.match(lines[1].text,/理清/);assert.equal(lines[1].speaker,'employee-2');
});

test('AI receives participating character memories only',async()=>{
 const db={getItem:key=>key==='ccat-office-events-v1'?JSON.stringify({history:[{sourceKey:'character:b',reply:'你陪我整理过资料',choice:'一起整理',mood:2,trust:1},{sourceKey:'character:c',reply:'UNRELATED-EVENT',choice:'private'}]}):storage.getItem(key)};
 await requestOfficeDialogue({storage:db,participants,topic:'进度',fetchImpl:async(url,options)=>{assert.match(options.body,/你陪我整理过资料/);assert.doesNotMatch(options.body,/UNRELATED-EVENT/);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({messages})}}]})};}});
});
