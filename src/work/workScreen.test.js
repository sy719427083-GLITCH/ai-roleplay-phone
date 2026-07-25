import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("work screen integrates project management and a real project countdown", () => {
  const source = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  for (const text of ["项目管理", "项目倒计时", "工作结束", "点击领取报酬", "员工管理", "工作设置"]) assert.match(source, new RegExp(text));
  assert.match(source, /import \{ ProjectManagementPreview \} from "\.\/ProjectManagementPreview\.jsx"/);
  assert.match(source, /ProjectCountdownView/);
  assert.match(source, /deriveProjectTimer/);
  assert.match(source, /addWalletIncomeOnce/);
  assert.match(source, /setInterval/);
  assert.match(source, /view === "projects"/);
  assert.doesNotMatch(source, /02:45:30|工作倒计时/);
});

test("countdown controls meet mobile touch targets", () => {
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(styles, /\.work-reward-claim-small\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.work-countdown-fixed-action\s*\{[^}]*min-height:\s*52px/s);
  assert.match(styles, /font-variant-numeric:\s*tabular-nums/);
});

test("office scene uses semantic object buttons", () => {
  const source = readFileSync("src/work/OfficeScene.jsx", "utf8");
  assert.match(source, /<button/);
  assert.match(source, /aria-label=/);
});

test("office screen uses full-bleed floating controls", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(screen, /work-office-shell/);
  assert.match(styles, /\.work-office-shell\s*\{[^}]*grid-template-rows:\s*1fr/s);
  assert.match(styles, /\.work-topbar\s*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /\.work-bottom-nav\s*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /\.office-object\.desk\.boss\s*\{[^}]*top:\s*23%/s);
  assert.match(styles, /\.office-object\.tea\s*\{[^}]*top:\s*9%;[^}]*right:\s*0;[^}]*width:\s*54%;[^}]*height:\s*16%/s);
  assert.match(styles, /--walk-duration/);
  assert.doesNotMatch(styles, /\.office-object\.door|\.left-door|\.right-top-door|\.right-mid-door/);
});

test("office screen measures the scene and advances timed A star segments", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const scene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  assert.match(screen, /sceneRef/);
  assert.match(screen, /createOfficeRoute/);
  assert.match(screen, /durationMs/);
  assert.doesNotMatch(screen, /430/);
  assert.match(scene, /getOfficePoint/);
  assert.doesNotMatch(scene, /OFFICE_NODES/);
});

test("work app gates the office behind one-time company creation", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(screen, /WORK_COMPANY_STORAGE_KEY/);
  assert.match(screen, /restoreWorkCompany/);
  assert.match(screen, /<WorkCompanyOnboarding/);
  assert.match(screen, /window\.localStorage\.setItem\(WORK_COMPANY_STORAGE_KEY/);
  assert.match(styles, /\.work-company-onboarding/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.work-company-skip\s*\{[^}]*min-height:\s*44px/s);
});
