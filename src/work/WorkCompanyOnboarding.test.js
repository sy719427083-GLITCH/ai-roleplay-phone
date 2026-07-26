import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/WorkCompanyOnboarding.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

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

test("reduced-motion detection tolerates browsers without matchMedia", () => {
  assert.ok(source.includes('window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches'));
});

test("launch and enter use fullscreen Orbit camera scenes", () => {
  assert.match(source, /WORK_COMPANY_SCENE_ASSETS/);
  assert.match(source, /const LAUNCH_DURATION_MS = 2200/);
  assert.match(source, /const ENTER_DURATION_MS = 2400/);
  assert.match(source, /work-company-scene is-launch-scene/);
  assert.match(source, /work-company-scene is-enter-scene/);
  assert.match(source, /work-company-camera/);
  assert.match(source, /work-company-door is-left/);
  assert.match(source, /work-company-door is-right/);
  assert.doesNotMatch(source, /work-company-launch-icon/);
  assert.doesNotMatch(source, /work-company-entry"/);
});

test("company animations fill the viewport and respect reduced motion", () => {
  assert.match(styles, /\.work-company-scene\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
  assert.match(styles, /background-image:\s*var\(--work-company-scene-image\)/);
  assert.match(styles, /@keyframes work-company-camera-launch/);
  assert.match(styles, /@keyframes work-company-camera-enter/);
  assert.match(styles, /@keyframes work-company-door-open-left/);
  assert.match(styles, /@keyframes work-company-door-open-right/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*\.15s/);
  assert.match(styles, /\.work-company-skip\s*\{[^}]*min-height:\s*44px/s);
});
