import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import {
  OFFICE_V2_ART_SPEC,
  OFFICE_V2_FURNITURE_IDS,
  OFFICE_V2_PROP_IDS,
  OFFICE_V2_SCENE_IDS,
} from "./office-v2-art-spec.mjs";

const mode = process.argv.includes("--environment") || process.argv.includes("--all");
assert.ok(mode, "use --environment or --all");
const root = path.resolve("public/work-office-v2");

const files = [
  ...OFFICE_V2_SCENE_IDS.map((id) => path.join("scenes", `${id.replace("scene-", "")}.webp`)),
  ...OFFICE_V2_FURNITURE_IDS.map((id) => path.join("furniture", `${id}.webp`)),
  ...OFFICE_V2_PROP_IDS.map((id) => path.join("props", `${id}.webp`)),
  path.join("objects", "boss-desk.webp"),
  path.join("objects", "employee-desk.webp"),
  path.join("objects", "pantry.webp"),
];
const missing = files.filter((file) => !existsSync(path.join(root, file)));
assert.deepEqual(missing, [], `missing assets:\n${missing.join("\n")}`);

const names = readdirSync(root, { recursive: true }).map(String).map((name) => name.toLowerCase());
for (const banned of OFFICE_V2_ART_SPEC.constraints.bannedFilenameParts) {
  assert.equal(names.some((name) => name.includes(banned)), false, `forbidden asset name: ${banned}`);
}
assert.equal(names.filter((name) => name.endsWith("employee-desk-rear.webp")).length, 1);
assert.equal(names.filter((name) => name.endsWith("employee-desk-front.webp")).length, 1);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const inspect = async (file) => page.evaluate(async (source) => {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = 0;
  let useful = 0;
  let edgeOpaque = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha < 8) transparent += 1;
      if (alpha > 32) useful += 1;
      if (alpha > 12 && (x < 12 || y < 12 || x >= canvas.width - 12 || y >= canvas.height - 12)) edgeOpaque += 1;
    }
  }
  const total = canvas.width * canvas.height;
  return {
    width: canvas.width,
    height: canvas.height,
    transparentRatio: transparent / total,
    usefulRatio: useful / total,
    edgeOpaque,
  };
}, `data:image/webp;base64,${readFileSync(file).toString("base64")}`);

try {
  for (const id of OFFICE_V2_SCENE_IDS) {
    const file = path.join(root, "scenes", `${id.replace("scene-", "")}.webp`);
    const result = await inspect(file);
    assert.deepEqual([result.width, result.height], [2160, 3840], id);
    assert.equal(result.transparentRatio, 0, `${id} must be opaque`);
  }
  for (const relative of files.filter((file) => !file.startsWith(`scenes${path.sep}`))) {
    const result = await inspect(path.join(root, relative));
    assert.ok(result.transparentRatio >= 0.08, `${relative}: insufficient alpha ${result.transparentRatio}`);
    assert.ok(result.usefulRatio >= 0.015, `${relative}: insufficient coverage ${result.usefulRatio}`);
    assert.equal(result.edgeOpaque, 0, `${relative}: clipped alpha at canvas edge`);
  }
} finally {
  await browser.close();
}

console.log(`PASS environment: ${OFFICE_V2_SCENE_IDS.length} scenes, ${OFFICE_V2_FURNITURE_IDS.length} furniture layers, ${OFFICE_V2_PROP_IDS.length} props`);
console.log("PASS constraints: opaque 2160x3840 scenes, real alpha, clear gutters, zero rugs/carpets, one employee desk pair");
