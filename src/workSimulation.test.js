import test from 'node:test';
import assert from 'node:assert/strict';
import { readSources, createCareer, transition, buildWorkContext, loadCareer, SAVE_KEY } from './workSimulation.js';
const world = { id: 'w1', name: '星港', tone: '星际货运', memories: [{ text: '港口停航' }], characters: [{ id: 'a', name: '旧姓名' }] };
const people = [{ id: 'a', name: '林', worldId: 'w1', personality: '谨慎' }, { id: 'b', name: '周', worldview: 'w1' }];
const storage = values => ({ getItem: key => values[key] ?? null });
const start = () => createCareer(world, people, 'project', { a: '合作伙伴', b: '客户' });
test('sources merge linked characters without importing other worlds or duplicating', () => {
 const result = readSources(storage({ 'ccat-worldbook-worlds-v1': JSON.stringify([world]), apiCharacters: JSON.stringify({ a: people[0], z: { name: '外人', worldId: 'w2' } }) }));
 assert.equal(result[0].people.length, 1); assert.equal(result[0].people[0].name, '林');
});
test('malformed source data is recoverable', () => { assert.deepEqual(readSources(storage({ apiCharacters: '{' })), []); });
test('invalid saves are rejected rather than crashing UI', () => {
 for (const value of ['{', '{}', '{"version":1}', JSON.stringify({ ...start(), chats: null })]) assert.equal(loadCareer(storage({ [SAVE_KEY]: value })), null);
 assert.deepEqual(loadCareer(storage({ [SAVE_KEY]: JSON.stringify(start()) })), start());
});
test('task prerequisites and short drafts cannot be bypassed', () => {
 const s = start(); assert.equal(transition(s, { type: 'deliver' }), s);
 assert.equal(transition(s, { type: 'review' }), s);
 assert.equal(transition(s, { type: 'research' }), s);
});
test('project can be completed only once, and original sources stay unchanged', () => {
 const original = JSON.stringify(world); let s = start();
 for (const type of ['brief', 'research']) s = transition(s, { type });
 s = transition(s, { type: 'draft', text: '目标：完成星港交付。安排：先核对资料再协调运输。风险：停航时联系客户调整时间。' });
 s = transition(s, { type: 'review' }); assert.equal(s.project.reviewed, true);
 s = transition(s, { type: 'deliver' }); assert.equal(s.completed, 1);
 assert.equal(transition(s, { type: 'deliver' }), s); assert.equal(JSON.stringify(world), original);
 const next = transition(s, { type: 'nextDay' }); assert.equal(next.day, 2); assert.equal(next.project.delivered, false); assert.equal(next.completed, 1);
});
test('legacy optional notes no longer block delivery', () => {
 let s = start(); for (const type of ['brief', 'research']) s = transition(s, { type });
 s = transition(s, { type: 'draft', text: '目标明确，安排了三项工作，并且准备了延期时的处理方案和相关人员的沟通内容。' });
 s = transition(s, { type: 'review' }); s = transition(s, { type: 'draft', text: '重新修改' });
 assert.equal(s.project.reviewed, false); assert.equal(transition(s, { type: 'deliver' }).project.delivered, true);
});
test('context includes character and world detail but not another private chat', () => {
 const s = start(); s.chats.b = [{ from: 'me', text: '私人秘密' }];
 const context = buildWorkContext(world, people[0], s);
 assert.match(context, /谨慎/); assert.match(context, /港口停航/); assert.doesNotMatch(context, /私人秘密/);
});
test('unknown actions and next day before delivery do not consume time', () => { const s = start(); assert.equal(transition(s, { type: 'nextDay' }), s); assert.equal(transition(s, { type: 'unknown' }), s); });
