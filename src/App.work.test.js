import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("work launcher opens the blank cache-clearing placeholder", () => {
  const source = readFileSync("src/App.jsx", "utf8");
  const placeholder = readFileSync("src/WorkPlaceholder.jsx", "utf8");
  assert.match(source, /import \{ WorkPlaceholder \} from "\.\/WorkPlaceholder\.jsx"/);
  assert.match(source, /if \(isWork\) return <WorkPlaceholder onClose=\{onClose\} \/>/);
  assert.match(placeholder, /clearWorkAppCache\(window\.localStorage\)/);
  assert.match(placeholder, /aria-label="返回桌面"/);
  assert.doesNotMatch(placeholder, /项目|员工|倒计时|办公室|AI 导演/);
});
