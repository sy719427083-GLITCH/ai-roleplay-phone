import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
test('work launcher opens the persistent simulation without clearing work caches', () => {
 const source = readFileSync('src/App.jsx', 'utf8');
 const screen = readFileSync('src/WorkSimulation.jsx', 'utf8');
 assert.match(source, /if \(isWork\) return <WorkSimulation onClose=\{onClose\} \/>/);
 assert.doesNotMatch(screen, /clearWorkAppCache/);
 assert.match(screen, /aria-label="返回桌面"/);
});
