import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const assets = readFileSync("src/work/breakroomAssets.js", "utf8");
const scene = readFileSync("src/work/BreakroomScene.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

test("renders all approved chairless clickable facilities", () => {
  for (const text of [
    "饮品吧台", "咖啡机", "冰箱", "微波炉", "零食柜", "员工餐桌",
    "正在挑选饮品", "正在制作咖啡", "正在查看冰箱",
    "正在加热餐食", "正在挑选零食", "正在用餐",
  ]) assert.match(assets, new RegExp(text));
  assert.doesNotMatch(assets, /椅子|chair/i);
  assert.match(scene, /BREAKROOM_FACILITIES\.map/);
  assert.match(scene, /<button/);
  assert.match(scene, /<OfficeCharacter/);
  assert.match(scene, /aria-label="返回办公室"/);
});

test("breakroom layout follows the approved zones and touch sizes", () => {
  assert.match(styles, /\.breakroom-scene\s*\{/);
  assert.match(styles, /\.breakroom-object\.drink-counter\s*\{[^}]*top:\s*7%;[^}]*left:\s*0;[^}]*width:\s*55%;[^}]*height:\s*18%/s);
  assert.match(styles, /\.breakroom-object\.dining-table\s*\{[^}]*top:\s*57%;[^}]*left:\s*15%;[^}]*width:\s*70%;[^}]*height:\s*16%/s);
  assert.match(styles, /\.breakroom-back\s*\{[^}]*width:\s*46px;[^}]*height:\s*46px/s);
});
