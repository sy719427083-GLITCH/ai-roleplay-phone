import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/WorkCompanyOnboarding.jsx", "utf8");

test("onboarding preserves launch, create, and enter order", () => {
  assert.match(source, /useState\("launch"\)/);
  assert.match(source, /setPhase\("create"\)/);
  assert.match(source, /setPhase\("enter"\)/);
  assert.match(source, /onComplete\(createdCompany\)/);
});

test("company form exposes fixed suffix, validation, and accessible actions", () => {
  for (const text of ["创建公司", "有限公司", "公司名称最多 5 个字", "公司创建失败，请重试", "跳过动画"]) {
    assert.match(source, new RegExp(text));
  }
  assert.match(source, /aria-label="公司名称前缀"/);
  assert.match(source, /disabled=\{!normalizedPrefix \|\| submitting\}/);
});
