import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("WorkMap renders authored SVG route segments and keeps samples for traveler motion", () => {
  assert.match(appSource, /navigationJob\?\.routeSegments/);
  assert.match(appSource, /routeSegments\.map\(\(segment/);
  assert.match(appSource, /<path[^>]+d=\{segment\}/);
  assert.doesNotMatch(appSource, /<polyline\s+points=\{route\.map/);
  assert.match(appSource, /interpolateWorkRoute\(routeSamples, sessionState\.progress\)/);
  assert.match(stylesSource, /\.work-road-route path\s*\{/);
});

test("work travel and work labels use the shared second-accurate formatter", () => {
  assert.match(appSource, /formatWorkDuration,/);
  assert.doesNotMatch(appSource, /const formatWorkTime\s*=/);
  assert.match(appSource, /`前往 \$\{formatWorkDuration\(activeRemainingMs\)\}`/);
  assert.match(appSource, /formatWorkDuration\(activeRemainingMs\)/);
  assert.match(appSource, /formatWorkDuration\(job\.durationMinutes \* 60 \* 1000\)/);
});

