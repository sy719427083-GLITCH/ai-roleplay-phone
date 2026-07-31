import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("opens the blank Work placeholder from the launcher", () => {
  assert.match(app, /\{ title: "工作", icon: Briefcase, variant: "line" \}/);
  assert.match(app, /import \{ WorkPlaceholder \} from "\.\/WorkPlaceholder\.jsx";/);
  assert.match(app, /if \(isWork\) return <WorkPlaceholder onClose=\{onClose\} \/>/);
});

test("publishes the 0.3.28 release markers", () => {
  assert.equal(packageJson.version, "0.3.28");
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.3\.28/);
  assert.match(app, /Ccat OS V0\.3\.28/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.3\.28/);
});
