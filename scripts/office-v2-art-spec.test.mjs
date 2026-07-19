import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveOfficeV2ArtPaths } from "./office-v2-art-paths.mjs";
import { CHARACTER_COHORTS } from "./office-v2-character-art.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ROOT = path.join(ROOT, "public", "work-office-v2");

test("normalizer resolves only the repository office-v2 output", () => {
  assert.deepEqual(resolveOfficeV2ArtPaths({
    repoRoot: ROOT,
    cwd: ROOT,
    sourceArg: "tmp/office-v2-source",
    outputArg: "public/work-office-v2",
  }), {
    mode: "environment",
    sourceRoot: path.join(ROOT, "tmp", "office-v2-source"),
    outputRoot: PUBLIC_ROOT,
  });
});

test("normalizer resolves one validated character cohort without widening deletion scope", () => {
  assert.deepEqual(resolveOfficeV2ArtPaths({
    repoRoot: ROOT,
    cwd: ROOT,
    sourceArg: "tmp/office-v2-source/boss-f",
    outputArg: "public/work-office-v2/characters",
  }), {
    mode: "characters",
    cohort: "boss-f",
    sourceRoot: path.join(ROOT, "tmp", "office-v2-source", "boss-f"),
    outputRoot: path.join(PUBLIC_ROOT, "characters"),
  });
});

test("normalizer rejects destructive or out-of-scope output paths", () => {
  const rejectedOutputs = [
    ".",
    ROOT,
    path.parse(ROOT).root,
    path.join(ROOT, "public"),
    path.join(ROOT, "public", "other-assets"),
    path.join(path.dirname(ROOT), "outside-office-v2"),
    path.join(PUBLIC_ROOT, "characters", "boss-f-01"),
  ];

  for (const outputArg of rejectedOutputs) {
    assert.throws(
      () => resolveOfficeV2ArtPaths({
        repoRoot: ROOT,
        cwd: ROOT,
        sourceArg: "tmp/office-v2-source",
        outputArg,
      }),
      /output must be exactly the repository public\/work-office-v2 directory/,
      outputArg,
    );
  }
});

test("character normalizer rejects unknown cohorts and source/output overlap", () => {
  assert.throws(() => resolveOfficeV2ArtPaths({
    repoRoot: ROOT,
    cwd: ROOT,
    sourceArg: "tmp/office-v2-source/unknown",
    outputArg: "public/work-office-v2/characters",
  }), /character cohort must be one of/i);
  assert.throws(() => resolveOfficeV2ArtPaths({
    repoRoot: ROOT,
    cwd: ROOT,
    sourceArg: "public/work-office-v2/characters/boss-f",
    outputArg: "public/work-office-v2/characters",
  }), /source and output directories must not overlap/i);
});

test("normalizer rejects source and output overlap in either direction", () => {
  for (const sourceArg of [
    PUBLIC_ROOT,
    path.join(PUBLIC_ROOT, "source"),
    path.join(ROOT, "public"),
    ROOT,
  ]) {
    assert.throws(
      () => resolveOfficeV2ArtPaths({
        repoRoot: ROOT,
        cwd: ROOT,
        sourceArg,
        outputArg: PUBLIC_ROOT,
      }),
      /source and output directories must not overlap/,
      sourceArg,
    );
  }
});

const SCENE_IDS = ["scene-office", "scene-lounge"];
const FURNITURE_IDS = [
  "employee-desk-rear", "employee-desk-front",
  "boss-desk-rear", "boss-desk-front",
  "printer", "whiteboard", "file-cabinet", "office-door", "lounge-door",
  "pantry", "dining-table-rear", "dining-table-front",
  "sofa-rear", "sofa-front", "coffee-table", "television",
];
const PROP_IDS = [
  "phone", "book", "headphones", "keyboard", "laptop", "tablet", "game-device",
  "files-documents", "pen", "sticky-notes", "coffee-cup", "water-cup", "meal-tray",
  "food-plate", "printer-paper", "delivery-parcel", "television-content", "cleaning-cloth",
  "desk-organizer", "utensils",
];
const BANNED_FILENAME_PARTS = [
  "rug", "carpet", "employee1-desk", "employee2-desk", "employee3-desk", "employee4-desk",
];

const requiredFiles = [
  ...SCENE_IDS.map((id) => path.join("scenes", `${id.replace("scene-", "")}.webp`)),
  ...FURNITURE_IDS.map((id) => path.join("furniture", `${id}.webp`)),
  ...PROP_IDS.map((id) => path.join("props", `${id}.webp`)),
  path.join("objects", "boss-desk.webp"),
  path.join("objects", "employee-desk.webp"),
  path.join("objects", "pantry.webp"),
];

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

test("ships the complete physical-office environment inventory", () => {
  const missing = requiredFiles.filter((relative) => !existsSync(path.join(PUBLIC_ROOT, relative)));
  assert.deepEqual(missing, [], `missing office-v2 assets:\n${missing.join("\n")}`);
});

test("defines one authoritative spec for every required environment alias and activity prop", async () => {
  const {
    OFFICE_V2_ART_SPEC,
    OFFICE_V2_FURNITURE_IDS,
    OFFICE_V2_PROP_IDS,
    OFFICE_V2_SCENE_IDS,
  } = await import("./office-v2-art-spec.mjs");

  assert.deepEqual(OFFICE_V2_SCENE_IDS, SCENE_IDS);
  assert.deepEqual(OFFICE_V2_FURNITURE_IDS, FURNITURE_IDS);
  assert.deepEqual(OFFICE_V2_PROP_IDS, PROP_IDS);
  assert.deepEqual(Object.keys(OFFICE_V2_ART_SPEC.runtimeAliases).sort(), [
    "boss-desk", "employee-desk", "office", "lounge", "pantry",
  ].sort());
  assert.equal(OFFICE_V2_ART_SPEC.runtimeAliases.office, "/ai-roleplay-phone/work-office-v2/scenes/office.webp");
  assert.equal(OFFICE_V2_ART_SPEC.runtimeAliases.lounge, "/ai-roleplay-phone/work-office-v2/scenes/lounge.webp");
  assert.equal(OFFICE_V2_ART_SPEC.runtimeAliases["employee-desk"], "/ai-roleplay-phone/work-office-v2/objects/employee-desk.webp");
  assert.equal(OFFICE_V2_ART_SPEC.runtimeAliases["boss-desk"], "/ai-roleplay-phone/work-office-v2/objects/boss-desk.webp");
  assert.equal(OFFICE_V2_ART_SPEC.runtimeAliases.pantry, "/ai-roleplay-phone/work-office-v2/objects/pantry.webp");
});

test("uses one reusable employee desk pair and forbids rug, carpet, and slot-specific desk files", () => {
  const filenames = walkFiles(PUBLIC_ROOT).map((file) => path.basename(file).toLowerCase());
  assert.equal(filenames.filter((name) => name === "employee-desk-rear.webp").length, 1);
  assert.equal(filenames.filter((name) => name === "employee-desk-front.webp").length, 1);
  for (const banned of BANNED_FILENAME_PARTS) {
    assert.equal(filenames.some((name) => name.includes(banned)), false, `forbidden filename: ${banned}`);
  }
});

test("stores exactly two opaque 2160 by 3840 scene masters and transparent furniture and props", async (t) => {
  if (!requiredFiles.every((relative) => existsSync(path.join(PUBLIC_ROOT, relative)))) {
    t.skip("asset metadata assertions wait for the inventory to exist");
    return;
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const inspect = async (file) => page.evaluate(async ({ source, expectOpaque }) => {
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
      let nonTransparent = 0;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] < 8) transparent += 1;
        if (data[index] > 32) nonTransparent += 1;
      }
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        transparentRatio: transparent / (data.length / 4),
        nonTransparentRatio: nonTransparent / (data.length / 4),
        opaque: expectOpaque ? transparent === 0 : false,
      };
    }, {
      source: `data:image/webp;base64,${readFileSync(file).toString("base64")}`,
      expectOpaque: file.includes(`${path.sep}scenes${path.sep}`),
    });

    for (const id of SCENE_IDS) {
      const metadata = await inspect(path.join(PUBLIC_ROOT, "scenes", `${id.replace("scene-", "")}.webp`));
      assert.deepEqual([metadata.width, metadata.height], [2160, 3840], id);
      assert.equal(metadata.opaque, true, `${id} must be fully opaque`);
    }

    for (const relative of requiredFiles.filter((file) => /^(furniture|props|objects)\//.test(file))) {
      const metadata = await inspect(path.join(PUBLIC_ROOT, relative));
      assert.ok(metadata.transparentRatio >= 0.08, `${relative} lacks nontrivial alpha`);
      assert.ok(metadata.nonTransparentRatio >= 0.015, `${relative} has too little useful coverage`);
      assert.ok(metadata.nonTransparentRatio <= 0.9, `${relative} is effectively opaque`);
    }
  } finally {
    await browser.close();
  }
});

test("defines the body-only character prompt and normalization contract", async () => {
  const { OFFICE_V2_CHARACTER_CONTRACT } = await import("./office-v2-art-spec.mjs");

  assert.equal(OFFICE_V2_CHARACTER_CONTRACT.bodyOnly, true);
  assert.equal(OFFICE_V2_CHARACTER_CONTRACT.source.minimumCellSize, 512);
  assert.equal(
    OFFICE_V2_CHARACTER_CONTRACT.source.layout,
    "<sourceRoot>/<character-id>/<clip-id>.(png|webp)",
  );
  assert.match(OFFICE_V2_CHARACTER_CONTRACT.prompt, /body only/i);
  assert.match(OFFICE_V2_CHARACTER_CONTRACT.prompt, /transparent background/i);
  assert.deepEqual(OFFICE_V2_CHARACTER_CONTRACT.forbiddenBakedSubjects, [
    "desk", "chair", "sofa", "table", "meal", "phone", "book", "screen",
    "computer", "food", "tray", "document", "parcel", "whiteboard", "furniture", "prop",
  ]);
  assert.deepEqual(OFFICE_V2_CHARACTER_CONTRACT.normalization, {
    cellSize: 384,
    feetAnchor: { x: 192, y: 359 },
    transparentEdgePadding: 24,
    sharpening: {
      method: "edge-preserving-unsharp-mask",
      radius: 0.6,
      amount: 0.35,
      threshold: 8,
    },
    output: { format: "webp", quality: 95 },
  });
});

test("defers fully absent cohorts, rejects partial cohorts, and strictly verifies complete cohorts", async () => {
  const { verifyCharacterCohort } = await import("./verify-office-v2-assets.mjs");
  for (const cohort of CHARACTER_COHORTS) {
    const result = await verifyCharacterCohort({ root: PUBLIC_ROOT, cohort, allowAbsent: true });
    assert.ok(["absent", "complete"].includes(result.state), `${cohort}: ${result.state}`);
  }
});
