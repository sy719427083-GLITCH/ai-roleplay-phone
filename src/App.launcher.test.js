import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("opens the Work office from the launcher", () => {
  assert.match(app, /\{ title: "工作", icon: Briefcase, variant: "line" \}/);
  assert.match(app, /import \{ WorkOffice \} from "\.\/WorkOffice\.jsx";/);
  assert.match(app, /if \(isWork\) return <WorkOffice onClose=\{onClose\} \/>/);
});

test("settings version follows the package release version", () => {
  assert.equal(packageJson.version, JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")).version);
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.3\.30/);
  assert.match(app, /Ccat OS V\{appVersion\}/);
  assert.match(app, /import \{ version as appVersion \} from "\.\.\/package\.json"/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.3\.30/);
});
