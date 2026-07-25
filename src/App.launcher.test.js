import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const workStyles = readFileSync(new URL("./work/office.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("opens the restored Work office from the launcher", () => {
  assert.match(app, /\{ title: "工作", icon: Briefcase, variant: "line" \}/);
  assert.match(app, /import \{ WorkAppScreen \} from "\.\/work\/WorkAppScreen\.jsx";/);
  assert.match(app, /if \(isWork\) return <WorkAppScreen onClose=\{onClose\} \/>/);
  assert.match(workStyles, /\.work-office-shell/);
});

test("publishes the 0.3.10 release markers", () => {
  assert.equal(packageJson.version, "0.3.10");
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.3\.10/);
  assert.match(app, /Ccat OS V0\.3\.10/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.3\.10/);
});
