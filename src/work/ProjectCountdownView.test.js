import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/ProjectCountdownView.jsx", "utf8");

test("countdown detail exposes idle, running, finished, and claim content", () => {
  for (const text of ["项目倒计时", "暂无进行中的项目", "项目进行中", "工作结束", "点击领取报酬", "项目管理", "合同报酬", "预计结束"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /timer\.display/);
  assert.match(source, /timer\.project/);
  assert.match(source, /onClaim/);
  assert.match(source, /onOpenProjects/);
});
