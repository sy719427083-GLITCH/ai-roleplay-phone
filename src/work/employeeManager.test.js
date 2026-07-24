import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("employee manager exposes one boss and six employee slots with all override actions", () => {
  const source = readFileSync("src/work/EmployeeManager.jsx", "utf8") + readFileSync("src/work/WorkAvatarEditor.jsx", "utf8");
  for (const text of ["老板", "员工 1", "员工 2", "员工 3", "员工 4", "员工 5", "员工 6", "上传图片", "图片 URL", "恢复原头像"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /为七个工位安排角色/);
});
