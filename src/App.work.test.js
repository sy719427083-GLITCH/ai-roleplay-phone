import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
test('work launcher opens the office without clearing work caches', () => {
 const source = readFileSync('src/App.jsx', 'utf8');
 const screen = readFileSync('src/WorkOffice.jsx', 'utf8');
 assert.match(source, /if \(isWork\) return <WorkOffice onClose=\{onClose\} \/>/);
 assert.doesNotMatch(screen, /clearWorkAppCache/);
 assert.match(screen, /'返回桌面'/);
 assert.doesNotMatch(screen, /WorkShift|settleCareer|callWorkChat/);
});
