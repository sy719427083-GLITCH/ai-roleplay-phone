import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  OFFICE_V2_ART_SPEC,
  OFFICE_V2_FURNITURE_IDS,
  OFFICE_V2_PROP_IDS,
  OFFICE_V2_SCENE_IDS,
} from "./office-v2-art-spec.mjs";
import {
  CHARACTER_COHORTS,
  collectCharacterCohortInventory,
  inspectCharacterStrip,
} from "./office-v2-character-art.mjs";
import {
  OFFICE_CLIP_IDS,
  OFFICE_CLIP_METADATA,
} from "../src/work/pixi/officeCharacterClips.js";

const DEFAULT_ROOT = path.resolve("public/work-office-v2");

const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

const environmentFiles = () => [
  ...OFFICE_V2_SCENE_IDS.map((id) => path.join("scenes", `${id.replace("scene-", "")}.webp`)),
  ...OFFICE_V2_FURNITURE_IDS.map((id) => path.join("furniture", `${id}.webp`)),
  ...OFFICE_V2_PROP_IDS.map((id) => path.join("props", `${id}.webp`)),
  path.join("objects", "boss-desk.webp"),
  path.join("objects", "employee-desk.webp"),
  path.join("objects", "pantry.webp"),
];

export async function verifyEnvironment({ root = DEFAULT_ROOT } = {}) {
  const files = environmentFiles();
  const missing = files.filter((file) => !existsSync(path.join(root, file)));
  ensure(missing.length === 0, `Missing environment assets:\n${missing.join("\n")}`);

  const names = readdirSync(root, { recursive: true }).map(String).map((name) => name.toLowerCase());
  for (const banned of OFFICE_V2_ART_SPEC.constraints.bannedFilenameParts) {
    ensure(!names.some((name) => name.includes(banned)), `Forbidden asset name: ${banned}`);
  }
  ensure(names.filter((name) => name.endsWith("employee-desk-rear.webp")).length === 1, "Expected one employee desk rear layer");
  ensure(names.filter((name) => name.endsWith("employee-desk-front.webp")).length === 1, "Expected one employee desk front layer");

  const browser = await chromium.launch({ headless: true });
  try {
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
          const alpha = data[((y * canvas.width) + x) * 4 + 3];
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

    for (const id of OFFICE_V2_SCENE_IDS) {
      const file = path.join(root, "scenes", `${id.replace("scene-", "")}.webp`);
      const result = await inspect(file);
      ensure(result.width === 2160 && result.height === 3840, `${id}: expected 2160x3840`);
      ensure(result.transparentRatio === 0, `${id}: scene must be opaque`);
    }
    for (const relative of files.filter((file) => !file.startsWith(`scenes${path.sep}`))) {
      const result = await inspect(path.join(root, relative));
      ensure(result.transparentRatio >= 0.08, `${relative}: insufficient alpha ${result.transparentRatio}`);
      ensure(result.usefulRatio >= 0.015, `${relative}: insufficient coverage ${result.usefulRatio}`);
      ensure(result.edgeOpaque === 0, `${relative}: clipped alpha at canvas edge`);
    }
  } finally {
    await browser.close();
  }

  return {
    state: "complete",
    scenes: OFFICE_V2_SCENE_IDS.length,
    furniture: OFFICE_V2_FURNITURE_IDS.length,
    props: OFFICE_V2_PROP_IDS.length,
  };
}

export async function verifyCharacterCohort({
  root = DEFAULT_ROOT,
  cohort,
  allowAbsent = false,
  browserFactory = () => chromium.launch({ headless: true }),
  inspectStrip = inspectCharacterStrip,
} = {}) {
  const characterRoot = path.join(root, "characters");
  const inventory = await collectCharacterCohortInventory(characterRoot, cohort);
  if (inventory.state === "absent" && allowAbsent) return inventory;
  if (inventory.state !== "complete") {
    const details = [
      ...inventory.missing.map((item) => `missing: ${item}`),
      ...inventory.unexpected.map((item) => `unexpected: ${item}`),
    ];
    throw new Error(
      `Character cohort ${cohort} is ${inventory.state}; missing character directories/clips or invalid inventory:\n`
      + details.join("\n"),
    );
  }

  const browser = await browserFactory();
  try {
    const page = await browser.newPage();
    for (const characterId of inventory.characterIds) {
      const hashes = new Map();
      for (const clipId of OFFICE_CLIP_IDS) {
        const file = path.join(characterRoot, characterId, `${clipId}.webp`);
        const bytes = readFileSync(file);
        ensure(bytes.length > 0, `${characterId}/${clipId}.webp: empty strip`);
        const hash = createHash("sha256").update(bytes).digest("hex");
        ensure(!hashes.has(hash), `${characterId}: duplicate strips ${hashes.get(hash)} and ${clipId}`);
        hashes.set(hash, clipId);

        const result = await inspectStrip({
          page,
          dataUrl: `data:image/webp;base64,${bytes.toString("base64")}`,
          metadata: OFFICE_CLIP_METADATA[clipId],
          label: `${characterId}/${clipId}.webp`,
        });
        ensure(result.emptyFrames.length === 0, `${characterId}/${clipId}: empty frames ${result.emptyFrames.join(", ")}`);
        ensure(
          result.gutterViolations.length === 0,
          `${characterId}/${clipId}: frames violate 24px transparent gutter ${result.gutterViolations.join(", ")}`,
        );
        ensure(
          result.furnitureLikeFrames.length === 0,
          `${characterId}/${clipId}: furniture-like full-width or rectangular mass ${result.furnitureLikeFrames.join(", ")}`,
        );
        ensure(
          result.frames.every(({ transparentPixels, usefulPixels }) => transparentPixels > 0 && usefulPixels > 0),
          `${characterId}/${clipId}: every frame must contain alpha and populated pixels`,
        );
      }
    }
  } finally {
    await browser.close();
  }
  return { ...inventory, state: "complete", verifiedStrips: inventory.characterIds.length * OFFICE_CLIP_IDS.length };
}

function parseArguments(argv) {
  const characterIndex = argv.indexOf("--characters");
  const cohort = characterIndex >= 0 ? argv[characterIndex + 1] : null;
  if (cohort && !CHARACTER_COHORTS.includes(cohort)) {
    throw new Error(`--characters must be one of: ${CHARACTER_COHORTS.join(", ")}`);
  }
  const environment = argv.includes("--environment");
  const all = argv.includes("--all");
  if (!environment && !all && !cohort) {
    throw new Error(`Use --environment, --all, or --characters ${CHARACTER_COHORTS.join("|")}`);
  }
  return { environment, all, cohort };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.environment || options.all) {
    const result = await verifyEnvironment();
    console.log(`PASS environment: ${result.scenes} scenes, ${result.furniture} furniture layers, ${result.props} props`);
    console.log("PASS constraints: opaque 2160x3840 scenes, real alpha, clear gutters, zero rugs/carpets, one employee desk pair");
  }
  const cohorts = options.all ? CHARACTER_COHORTS : (options.cohort ? [options.cohort] : []);
  for (const cohort of cohorts) {
    const result = await verifyCharacterCohort({ cohort });
    console.log(`PASS characters ${cohort}: ${result.characterIds.length} identities, ${result.verifiedStrips} strips`);
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
