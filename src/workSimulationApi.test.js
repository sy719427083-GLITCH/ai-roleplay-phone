import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWorkReply } from './workSimulationApi.js';
import { createCareer } from './workSimulation.js';
const world = { id: 'w', name: '测试世界', tone: '测试背景' };
const character = { id: 'a', name: '甲', persona: '测试人物' };
const career = createCareer(world, [character], 'project');
test('missing API does not manufacture a character reply', async () => {
 await assert.rejects(requestWorkReply({ storage: {getItem: () => null}, world, character, career, text: '你好' }), /保存主 API/);
});
test('API sends only selected person history and handles failed/empty responses', async t => {
 const config = {mainConfigs:[{id:'main',apiKey:'test-only',baseUrl:'https://example.invalid/v1',model:'test'}],selectedMainId:'main'};
 const storage = {getItem: () => JSON.stringify(config)};
 const c = {...career,chats:{a:[{from:'me',text:'属于甲的对话'}],b:[{from:'me',text:'PRIVATE_SENTINEL_B_98421'}]}};
 let sent;
 t.mock.method(globalThis, 'fetch', async (url, options) => {sent={url,options};return {ok:true,json:async()=>({choices:[{message:{content:'一起核对资料。'}}]})};});
 assert.equal(await requestWorkReply({storage,world,character,career:c,text:'请协助'}), '一起核对资料。');
 assert.equal(sent.url, 'https://example.invalid/v1/chat/completions');
 assert.match(sent.options.body,/属于甲的对话/);assert.doesNotMatch(sent.options.body,/PRIVATE_SENTINEL_B_98421/);
 globalThis.fetch.mock.mockImplementation(async()=>({ok:false,status:503}));
 await assert.rejects(requestWorkReply({storage,world,character,career:c,text:'请协助'}), /503/);
 globalThis.fetch.mock.mockImplementation(async()=>({ok:true,json:async()=>({choices:[]})}));
 await assert.rejects(requestWorkReply({storage,world,character,career:c,text:'请协助'}), /没有返回/);
});
