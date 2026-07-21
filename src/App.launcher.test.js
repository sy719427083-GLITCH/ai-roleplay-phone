import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("keeps the Work launcher without a dedicated Work implementation", () => {
  assert.match(app, /\{ title: "工作", icon: Briefcase, variant: "line" \}/);
  assert.doesNotMatch(app, /WorkAppScreen|\.\/work\//);
  assert.doesNotMatch(app, /work-opening/);
  assert.doesNotMatch(styles, /\.work-|--work-|@keyframes work/);
});

test("publishes the 0.2.99 release markers", () => {
  assert.equal(packageJson.version, "0.2.99");
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.2\.99/);
  assert.match(app, /Ccat OS V0\.2\.99/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.2\.99/);
});
