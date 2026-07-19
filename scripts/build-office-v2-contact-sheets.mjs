import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  OFFICE_CHARACTER_IDS,
  OFFICE_CLIP_IDS,
  OFFICE_CLIP_METADATA,
} from "../src/work/pixi/officeCharacterClips.js";
import {
  CHARACTER_COHORTS,
  decodeWebPDataUrl,
  writeValidatedWebPDataUrl,
} from "./office-v2-character-art.mjs";

const ROOT = path.resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHARACTER_ROOT = path.join(ROOT, "public", "work-office-v2", "characters");
const INSPECTION_SIZE = 192;
const FRAME_COLUMNS = 8;
const FRAME_TILE_WIDTH = 208;
const FRAME_TILE_HEIGHT = 226;
const PAGE_MARGIN = 24;
const PAGE_HEADER_HEIGHT = 500;

export const CONTACT_SHEET_MAX_DIMENSION = 8192;

function parseArguments(argv) {
  const charactersIndex = argv.indexOf("--characters");
  const characters = charactersIndex >= 0 ? argv[charactersIndex + 1] : "all";
  if (!characters || (!CHARACTER_COHORTS.includes(characters) && characters !== "all")) {
    throw new Error(`--characters must be one of: ${[...CHARACTER_COHORTS, "all"].join(", ")}`);
  }
  return {
    characters,
    allowMissing: argv.includes("--allow-missing"),
    dryRun: argv.includes("--dry-run"),
  };
}

const getCohort = (characterId) => characterId.replace(/-\d+$/, "");

const getPageOutput = (cohort, cohortIndex) => (
  cohortIndex === 0
    ? `docs/superpowers/qa/office-v2-${cohort}-contact-sheet.webp`
    : `docs/superpowers/qa/office-v2-${cohort}-contact-sheet-page-${cohortIndex + 1}.webp`
);

function createFrameEntries(characterId) {
  return OFFICE_CLIP_IDS.flatMap((clipId) => {
    const metadata = OFFICE_CLIP_METADATA[clipId];
    const facingByRow = metadata.rowByFacing
      ? Object.fromEntries(Object.entries(metadata.rowByFacing).map(([facing, row]) => [row, facing]))
      : {};
    return Array.from({ length: metadata.rows }, (_, row) => (
      Array.from({ length: metadata.columns }, (_, column) => ({
        characterId,
        clipId,
        row,
        column,
        facing: facingByRow[row] || metadata.legalFacings.join("/"),
        source: path.join(CHARACTER_ROOT, characterId, `${clipId}.webp`),
      }))
    )).flat();
  });
}

export function createContactSheetPlan(characters = "all") {
  if (!CHARACTER_COHORTS.includes(characters) && characters !== "all") {
    throw new Error(`Unknown character cohort: ${characters}`);
  }
  const characterIds = characters === "all"
    ? [...OFFICE_CHARACTER_IDS]
    : OFFICE_CHARACTER_IDS.filter((id) => id.startsWith(`${characters}-`));
  const missing = characterIds.flatMap((characterId) => OFFICE_CLIP_IDS
    .map((clipId) => path.join(CHARACTER_ROOT, characterId, `${clipId}.webp`))
    .filter((source) => !existsSync(source))
    .map((source) => path.relative(ROOT, source)));
  const pageIndexByCohort = new Map();
  const pages = characterIds.map((characterId) => {
    const cohort = getCohort(characterId);
    const cohortIndex = pageIndexByCohort.get(cohort) || 0;
    pageIndexByCohort.set(cohort, cohortIndex + 1);
    const frames = createFrameEntries(characterId);
    const frameRows = Math.ceil(frames.length / FRAME_COLUMNS);
    const width = (PAGE_MARGIN * 2) + (FRAME_COLUMNS * FRAME_TILE_WIDTH);
    const height = (PAGE_MARGIN * 2) + PAGE_HEADER_HEIGHT + (frameRows * FRAME_TILE_HEIGHT);
    if (width > CONTACT_SHEET_MAX_DIMENSION || height > CONTACT_SHEET_MAX_DIMENSION) {
      throw new Error(`${characterId}: planned contact sheet ${width}x${height} exceeds ${CONTACT_SHEET_MAX_DIMENSION}px`);
    }
    return {
      characterId,
      cohort,
      output: getPageOutput(cohort, cohortIndex),
      width,
      height,
      frameCount: frames.length,
      frames,
      representativePairs: [
        { family: "locomotion", clipId: "locomotion", row: 0, column: 0, sizes: [384, 104] },
        { family: "action", clipId: "idle-standing", row: 0, column: 0, sizes: [384, 104] },
      ],
    };
  });
  return {
    characterIds,
    clipIds: [...OFFICE_CLIP_IDS],
    missing,
    pages,
    output: characters === "all" ? pages[0]?.output : getPageOutput(characters, 0),
  };
}

async function renderContactSheetPage(pagePlan, page) {
  const sourceByClip = {};
  for (const clipId of OFFICE_CLIP_IDS) {
    const file = path.join(CHARACTER_ROOT, pagePlan.characterId, `${clipId}.webp`);
    const dataUrl = `data:image/webp;base64,${(await readFile(file)).toString("base64")}`;
    decodeWebPDataUrl(dataUrl);
    sourceByClip[clipId] = dataUrl;
  }

  const dataUrl = await page.evaluate(async ({
    plan,
    sources,
    inspectionSize,
    columns,
    tileWidth,
    tileHeight,
    margin,
    headerHeight,
  }) => {
    const images = {};
    for (const [clipId, source] of Object.entries(sources)) {
      const image = new Image();
      image.src = source;
      await image.decode();
      images[clipId] = image;
    }
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f5f6f7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#202428";
    context.font = "600 28px ui-sans-serif, system-ui, sans-serif";
    context.fillText(`OFFICE V2 CHARACTER QA: ${plan.characterId}`, margin, 38);
    context.fillStyle = "#6b7178";
    context.font = "500 15px ui-sans-serif, system-ui, sans-serif";
    context.fillText("All 196 source frames at 192 px, plus 384 px and 104 px family representatives", margin, 64);

    plan.representativePairs.forEach((representative, index) => {
      const image = images[representative.clipId];
      const x = margin + (index * 760);
      const y = 88;
      context.fillStyle = "#ffffff";
      context.fillRect(x, y, 720, 390);
      context.strokeStyle = "#d7dbe0";
      context.strokeRect(x + 0.5, y + 0.5, 719, 389);
      context.fillStyle = "#4e555d";
      context.font = "600 15px ui-sans-serif, system-ui, sans-serif";
      context.fillText(`${representative.family.toUpperCase()} / ${representative.clipId}`, x + 12, y + 24);
      const sourceX = representative.column * 384;
      const sourceY = representative.row * 384;
      context.drawImage(image, sourceX, sourceY, 384, 384, x + 12, y + 4, 384, 384);
      context.drawImage(image, sourceX, sourceY, 384, 384, x + 430, y + 44, 104, 104);
      context.fillStyle = "#747a81";
      context.font = "500 12px ui-sans-serif, system-ui, sans-serif";
      context.fillText("384 px", x + 310, y + 376);
      context.fillText("104 px runtime", x + 430, y + 168);
    });

    plan.frames.forEach((frame, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + (column * tileWidth);
      const y = margin + headerHeight + (row * tileHeight);
      context.fillStyle = "#ffffff";
      context.fillRect(x, y, tileWidth - 8, tileHeight - 8);
      context.strokeStyle = "#d9dde1";
      context.strokeRect(x + 0.5, y + 0.5, tileWidth - 9, tileHeight - 9);
      context.drawImage(
        images[frame.clipId],
        frame.column * 384,
        frame.row * 384,
        384,
        384,
        x + 4,
        y + 4,
        inspectionSize,
        inspectionSize,
      );
      context.fillStyle = "#515860";
      context.font = "600 10px ui-sans-serif, system-ui, sans-serif";
      context.fillText(frame.clipId, x + 4, y + inspectionSize + 17);
      context.fillStyle = "#7a8087";
      context.font = "500 10px ui-sans-serif, system-ui, sans-serif";
      context.fillText(`r${frame.row + 1} c${frame.column + 1} ${frame.facing}`, x + 4, y + inspectionSize + 31);
    });
    return canvas.toDataURL("image/webp", 0.95);
  }, {
    plan: pagePlan,
    sources: sourceByClip,
    inspectionSize: INSPECTION_SIZE,
    columns: FRAME_COLUMNS,
    tileWidth: FRAME_TILE_WIDTH,
    tileHeight: FRAME_TILE_HEIGHT,
    margin: PAGE_MARGIN,
    headerHeight: PAGE_HEADER_HEIGHT,
  });

  const output = path.join(ROOT, pagePlan.output);
  await writeValidatedWebPDataUrl(output, dataUrl, {
    expectedWidth: pagePlan.width,
    expectedHeight: pagePlan.height,
    page,
  });
  return output;
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
      `Skipped contact sheets: ${plan.missing.length} character strips are still deferred to Tasks 7-10.\n`,
    );
    return;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const pagePlan of plan.pages) {
      const output = await renderContactSheetPage(pagePlan, page);
      process.stdout.write(`${output}\n`);
    }
  } finally {
    await browser.close();
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
