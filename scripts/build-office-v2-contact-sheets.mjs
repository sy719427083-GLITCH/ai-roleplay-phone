import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  OFFICE_CHARACTER_IDS,
  OFFICE_CLIP_IDS,
  getCharacterClipSource,
} from "../src/work/pixi/officeCharacterClips.js";

const ROOT = path.resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHARACTER_ROOT = path.join(ROOT, "public", "work-office-v2", "characters");
const CHARACTER_GROUPS = Object.freeze(["employee-f", "employee-m", "boss-f", "boss-m"]);

function parseArguments(argv) {
  const charactersIndex = argv.indexOf("--characters");
  const characters = charactersIndex >= 0 ? argv[charactersIndex + 1] : "all";
  if (!characters || (!CHARACTER_GROUPS.includes(characters) && characters !== "all")) {
    throw new Error(`--characters must be one of: ${[...CHARACTER_GROUPS, "all"].join(", ")}`);
  }
  return {
    characters,
    allowMissing: argv.includes("--allow-missing"),
    dryRun: argv.includes("--dry-run"),
  };
}

const relativeOutput = (characters) => (
  `docs/superpowers/qa/office-v2-${characters}-contact-sheet.webp`
);

export function createContactSheetPlan(characters = "all") {
  const characterIds = characters === "all"
    ? [...OFFICE_CHARACTER_IDS]
    : OFFICE_CHARACTER_IDS.filter((id) => id.startsWith(`${characters}-`));
  const samplePairs = characterIds.flatMap((characterId) => OFFICE_CLIP_IDS.map((clipId) => {
    const descriptor = getCharacterClipSource(characterId, clipId);
    return {
      characterId,
      clipId,
      family: descriptor.family,
      source: path.join(CHARACTER_ROOT, characterId, `${clipId}.webp`),
      sampleSizes: [descriptor.cellSize, 104],
    };
  }));
  const missing = samplePairs.filter(({ source }) => !existsSync(source)).map(({ source }) => (
    path.relative(ROOT, source)
  ));
  return {
    characterIds,
    clipIds: [...OFFICE_CLIP_IDS],
    samplePairs,
    missing,
    output: relativeOutput(characters),
  };
}

async function renderContactSheet(plan) {
  const sources = await Promise.all(plan.samplePairs.map(async (sample) => ({
    ...sample,
    dataUrl: `data:image/webp;base64,${(await readFile(sample.source)).toString("base64")}`,
  })));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const dataUrl = await page.evaluate(async ({ characterIds, clipIds, samples }) => {
      const margin = 28;
      const headerHeight = 82;
      const rowHeight = 440;
      const labelWidth = 148;
      const clipWidth = 516;
      const canvas = document.createElement("canvas");
      canvas.width = (margin * 2) + labelWidth + (clipIds.length * clipWidth);
      canvas.height = headerHeight + (characterIds.length * rowHeight) + margin;
      const context = canvas.getContext("2d");
      context.fillStyle = "#f5f6f7";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#202428";
      context.font = "600 28px ui-sans-serif, system-ui, sans-serif";
      context.fillText("OFFICE V2 CHARACTER STRIP QA", margin, 38);
      context.fillStyle = "#6b7178";
      context.font = "500 15px ui-sans-serif, system-ui, sans-serif";
      context.fillText("Each source strip: one 384 px frame and one 104 px runtime sample", margin, 63);

      const byKey = new Map(samples.map((sample) => [`${sample.characterId}:${sample.clipId}`, sample]));
      for (let characterIndex = 0; characterIndex < characterIds.length; characterIndex += 1) {
        const characterId = characterIds[characterIndex];
        const y = headerHeight + (characterIndex * rowHeight);
        context.fillStyle = "#24282d";
        context.font = "600 16px ui-sans-serif, system-ui, sans-serif";
        context.fillText(characterId, margin, y + 28);

        for (let clipIndex = 0; clipIndex < clipIds.length; clipIndex += 1) {
          const clipId = clipIds[clipIndex];
          const sample = byKey.get(`${characterId}:${clipId}`);
          const x = margin + labelWidth + (clipIndex * clipWidth);
          context.fillStyle = "#ffffff";
          context.fillRect(x, y, clipWidth - 8, rowHeight - 12);
          context.strokeStyle = "#d9dde1";
          context.strokeRect(x + 0.5, y + 0.5, clipWidth - 9, rowHeight - 13);
          context.fillStyle = "#596068";
          context.font = "600 13px ui-sans-serif, system-ui, sans-serif";
          context.fillText(clipId, x + 12, y + 22);

          const image = new Image();
          image.src = sample.dataUrl;
          await image.decode();
          context.drawImage(image, 0, 0, 384, 384, x + 10, y + 34, 384, 384);
          context.drawImage(image, 0, 0, 384, 384, x + 400, y + 34, 104, 104);
          context.fillStyle = "#7a8087";
          context.font = "500 11px ui-sans-serif, system-ui, sans-serif";
          context.fillText(sample.family.toUpperCase(), x + 404, y + 158);
        }
      }
      return canvas.toDataURL("image/webp", 0.95);
    }, {
      characterIds: plan.characterIds,
      clipIds: plan.clipIds,
      samples: sources,
    });
    const output = path.join(ROOT, plan.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
    return output;
  } finally {
    await browser.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const plan = createContactSheetPlan(options.characters);
  if (plan.missing.length > 0 && !options.allowMissing) {
    throw new Error(
      `Missing ${plan.missing.length} required character strips; Tasks 7-10 must create them. `
      + `Use --allow-missing only to inspect the plan without generating placeholders.\n`
      + plan.missing.join("\n"),
    );
  }
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  if (plan.missing.length > 0) {
    process.stderr.write(
      `Skipped ${plan.output}: ${plan.missing.length} character strips are still deferred to Tasks 7-10.\n`,
    );
    return;
  }
  const output = await renderContactSheet(plan);
  process.stdout.write(`${output}\n`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
