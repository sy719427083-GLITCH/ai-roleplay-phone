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
  assert.match(styles, /\.office-object\.print-station\s*\{[^}]*top:\s*11%;[^}]*right:\s*0;[^}]*width:\s*48%;[^}]*height:\s*14%/s);
  assert.match(styles, /\.office-object\.print-station\s*\{[^}]*transform-origin:\s*left bottom;[^}]*transform:\s*rotate\(3deg\)/s);
  assert.match(styles, /\.office-object\.print-station:active\s*\{[^}]*transform:\s*rotate\(3deg\) scale\(\.975\)/s);
  assert.match(styles, /--walk-duration/);
  assert.doesNotMatch(styles, /\.office-object\.door|\.left-door|\.right-top-door|\.right-mid-door/);
});

test("office screen delegates timed A star segments to the simulation hook", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const simulation = readFileSync("src/work/useOfficeSimulation.js", "utf8");
  const scene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  assert.match(screen, /sceneRef/);
  assert.match(simulation, /createOfficeRoute/);
  assert.match(simulation, /durationMs/);
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

test("work settings clears cache through a clean app remount", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  assert.match(screen, /import \{ WorkSettings \} from "\.\/WorkSettings\.jsx"/);
  assert.match(screen, /view === "settings"/);
  assert.match(screen, /<WorkSettings/);
  assert.match(screen, /onBack=\{\(\) => setView\("office"\)\}/);
  assert.match(screen, /onCleared=\{onClose\}/);
});

test("office has no breakroom entry or scene switching", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const officeScene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  for (const source of [screen, officeScene, styles]) {
    assert.doesNotMatch(source, /breakroom|茶水间/i);
  }
  assert.match(screen, /<OfficeScene/);
  assert.match(screen, /aria-label="返回主页"/);
  assert.doesNotMatch(officeScene, /ChevronRight|onEnterBreakroom/);
});

test("scene targets carry their approved arrival messages", () => {
  const officeScene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  const screen = readFileSync("src/work/useOfficeSimulation.js", "utf8");
  assert.match(officeScene, /onObjectClick\(item\)/);
  assert.match(screen, /target\.message/);
  assert.match(screen, /window\.setTimeout\(.*2000/s);
});

test("work screen runs autonomous office simulation and mode settings", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  assert.match(screen, /useOfficeSimulation/);
  assert.match(screen, /simulationMode/);
  assert.match(screen, /onSimulationModeChange/);
  assert.match(screen, /characterStates/);
});

test("work settings tests the real main AI director endpoint", () => {
  const settings = readFileSync("src/work/WorkSettings.jsx", "utf8");
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(settings, /测试 AI 导演/);
  assert.match(settings, /测试中…/);
  assert.match(settings, /AI 导演连接成功，可以使用。/);
  assert.match(settings, /role="status"/);
  assert.match(settings, /role="alert"/);
  assert.match(screen, /testOfficeAiDirector/);
  assert.match(screen, /buildOfficeAiContext/);
  assert.match(screen, /formatOfficeAiError/);
  assert.match(screen, /parseConfigs/);
  assert.match(screen, /projectTimer\.project\?\.name/);
  assert.match(screen, /testOfficeAiDirector\(\{ apiState, context \}\)/);
  assert.match(styles, /\.work-ai-test-button\s*\{[^}]*min-height:\s*44px/s);
});

test("simulation enforces distinct chatters and a resettable ten-second Me timer", () => {
  const simulation = readFileSync("src/work/useOfficeSimulation.js", "utf8");
  assert.match(simulation, /getRuntimeConversationParticipants/);
  assert.match(simulation, /ME_MANUAL_IDLE_MS\s*=\s*10_000/);
  assert.match(simulation, /manualRun/);
  assert.match(simulation, /manualTimer/);
  assert.match(simulation, /END_MANUAL_ME/);
  assert.match(simulation, /clearTimeout\(manualTimer\.current\)/);
});

test("characters render activity below avatars and compact bubbles above them", () => {
  const character = readFileSync("src/work/OfficeCharacter.jsx", "utf8");
  const scene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(character, /office-character-bubble/);
  assert.match(character, /office-character-activity/);
  assert.match(character, /role="status"/);
  assert.match(character, /has-bubble/);
  assert.match(scene, /characterStates/);
  assert.match(styles, /\.office-character-bubble\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*112px[^}]*white-space:\s*nowrap/s);
  assert.doesNotMatch(styles, /\.office-character-bubble\s*\{[^}]*max-width:\s*126px/s);
  assert.match(character, /is-near-left/);
  assert.match(character, /is-near-right/);
  assert.match(styles, /\.office-character\.is-near-left \.office-character-bubble/);
  assert.match(styles, /\.office-character\.is-near-right \.office-character-bubble/);
  assert.match(styles, /\.office-character-activity\s*\{[^}]*text-overflow:\s*ellipsis/s);
});
