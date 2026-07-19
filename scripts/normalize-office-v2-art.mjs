import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path, { dirname, extname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { OFFICE_V2_ART_SPEC } from "./office-v2-art-spec.mjs";
import { normalizeCharacterCohort } from "./office-v2-character-art.mjs";
import { resolveOfficeV2ArtPaths } from "./office-v2-art-paths.mjs";

const repoRoot = path.resolve(dirname(fileURLToPath(import.meta.url)), "..");

const sceneObjects = {
  office: [
    ["objects/boss-desk.webp", 330, 350, 420, 250],
    ["objects/employee-desk.webp", 90, 720, 380, 250],
    ["objects/employee-desk.webp", 610, 720, 380, 250],
    ["objects/employee-desk.webp", 90, 1110, 380, 250],
    ["objects/employee-desk.webp", 610, 1110, 380, 250],
    ["furniture/printer.webp", 45, 1430, 210, 190],
    ["furniture/file-cabinet.webp", 45, 310, 190, 300],
    ["furniture/whiteboard.webp", 800, 330, 220, 300],
    ["furniture/office-door.webp", 875, 1640, 170, 280],
  ],
  lounge: [
    ["objects/pantry.webp", 90, 250, 900, 280],
    ["furniture/dining-table-rear.webp", 260, 720, 560, 330],
    ["furniture/dining-table-front.webp", 260, 720, 560, 330],
    ["furniture/television.webp", 435, 1120, 210, 240],
    ["furniture/coffee-table.webp", 375, 1400, 330, 170],
    ["furniture/sofa-rear.webp", 255, 1600, 570, 280],
    ["furniture/sofa-front.webp", 255, 1600, 570, 280],
    ["furniture/lounge-door.webp", 35, 1640, 170, 280],
  ],
};

async function normalizeEnvironment({ sourceRoot, outputRoot }) {
  const QA_ROOT = path.join(sourceRoot, "qa");

  await rm(outputRoot, { recursive: true, force: true });
  await Promise.all(["scenes", "furniture", "props", "objects"].map((directory) => mkdir(path.join(outputRoot, directory), { recursive: true })));
  await mkdir(QA_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    const readDataUrl = async (file) => {
      const extension = extname(file).toLowerCase();
      const mime = extension === ".webp" ? "image/webp" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
      return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
    };

    const writeDataUrl = async (file, dataUrl) => {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
    };

    async function normalizeScene(spec) {
      const source = path.join(sourceRoot, spec.source);
      const destination = path.join(outputRoot, spec.output);
      const dataUrl = await page.evaluate(async ({ sourceUrl, width, height }) => {
        const image = new Image();
        image.src = sourceUrl;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
        return canvas.toDataURL("image/webp", 0.96);
      }, {
        sourceUrl: await readDataUrl(source),
        width: spec.width,
        height: spec.height,
      });
      await writeDataUrl(destination, dataUrl);
    }

    async function normalizeTransparent(sourceFile, outputs, width, height, split = null, contactShadow = false) {
      const source = path.join(sourceRoot, sourceFile);
      const dataUrls = await page.evaluate(async ({ sourceUrl, width, height, split, contactShadow }) => {
        const image = new Image();
        image.src = sourceUrl;
        await image.decode();
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = image.naturalWidth;
        sourceCanvas.height = image.naturalHeight;
        const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
        sourceContext.drawImage(image, 0, 0);
        const pixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
        let minX = sourceCanvas.width;
        let minY = sourceCanvas.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < sourceCanvas.height; y += 1) {
          for (let x = 0; x < sourceCanvas.width; x += 1) {
            if (pixels[(y * sourceCanvas.width + x) * 4 + 3] <= 12) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
        if (maxX < minX || maxY < minY) throw new Error(`transparent source is empty: ${sourceUrl}`);
        const subjectWidth = maxX - minX + 1;
        const subjectHeight = maxY - minY + 1;
        const scale = Math.min((width - 64) / subjectWidth, (height - 64) / subjectHeight);
        const drawWidth = subjectWidth * scale;
        const drawHeight = subjectHeight * scale;
        const drawX = (width - drawWidth) / 2;
        const drawY = (height - drawHeight) / 2;
        const full = document.createElement("canvas");
        full.width = width;
        full.height = height;
        const context = full.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        if (contactShadow) {
          context.save();
          context.filter = "blur(16px)";
          context.globalAlpha = 0.16;
          context.fillStyle = "#6f7880";
          context.beginPath();
          context.ellipse(
            drawX + drawWidth / 2,
            drawY + drawHeight * 0.92,
            drawWidth * 0.38,
            Math.max(8, drawHeight * 0.045),
            0,
            0,
            Math.PI * 2,
          );
          context.fill();
          context.restore();
        }
        context.drawImage(sourceCanvas, minX, minY, subjectWidth, subjectHeight, drawX, drawY, drawWidth, drawHeight);

        if (split === null) {
          return [full.toDataURL("image/webp", 0.96)];
        }
        const result = [];
        const splitY = Math.round(drawY + drawHeight * split);
        for (let index = 0; index < 2; index += 1) {
          const layer = document.createElement("canvas");
          layer.width = width;
          layer.height = height;
          const layerContext = layer.getContext("2d");
          if (index === 0) layerContext.drawImage(full, 0, 0, width, splitY, 0, 0, width, splitY);
          else layerContext.drawImage(full, 0, splitY, width, height - splitY, 0, splitY, width, height - splitY);
          result.push(layer.toDataURL("image/webp", 0.96));
        }
        return result;
      }, {
        sourceUrl: await readDataUrl(source),
        width,
        height,
        split,
        contactShadow,
      });
      await Promise.all(outputs.map((destination, index) => writeDataUrl(destination, dataUrls[index])));
    }

    for (const scene of Object.values(OFFICE_V2_ART_SPEC.scenes)) await normalizeScene(scene);

    const furniture = OFFICE_V2_ART_SPEC.furnitureSources;
    for (const [id, spec] of Object.entries(furniture)) {
      if (spec.split) {
        await normalizeTransparent(spec.source, [
          path.join(outputRoot, "furniture", `${id}-rear.webp`),
          path.join(outputRoot, "furniture", `${id}-front.webp`),
        ], spec.width, spec.height, spec.split, true);
      } else {
        await normalizeTransparent(spec.source, [path.join(outputRoot, "furniture", `${id}.webp`)], spec.width, spec.height, null, true);
      }
      if (["employee-desk", "boss-desk", "pantry"].includes(id)) {
        await normalizeTransparent(spec.source, [path.join(outputRoot, "objects", `${id}.webp`)], spec.width, spec.height, null, true);
      }
    }

    for (const spec of Object.values(OFFICE_V2_ART_SPEC.props)) {
      await normalizeTransparent(spec.source, [path.join(outputRoot, spec.output)], spec.width, spec.height);
    }

    async function compose(sceneId) {
      const destination = path.join(QA_ROOT, `${sceneId}-composite.webp`);
      const dataUrl = await page.evaluate(async ({ backgroundUrl, objects }) => {
        const load = async (source) => {
          const image = new Image();
          image.src = source;
          await image.decode();
          return image;
        };
        const canvas = document.createElement("canvas");
        canvas.width = 2160;
        canvas.height = 3840;
        const context = canvas.getContext("2d");
        context.drawImage(await load(backgroundUrl), 0, 0, canvas.width, canvas.height);
        for (const [source, x, y, width, height] of objects) {
          context.drawImage(await load(source), x * 2, y * 2, width * 2, height * 2);
        }
        return canvas.toDataURL("image/webp", 0.96);
      }, {
        backgroundUrl: await readDataUrl(path.join(outputRoot, "scenes", `${sceneId}.webp`)),
        objects: await Promise.all(sceneObjects[sceneId].map(async ([file, ...geometry]) => [await readDataUrl(path.join(outputRoot, file)), ...geometry])),
      });
      await writeDataUrl(destination, dataUrl);
    }

    await compose("office");
    await compose("lounge");
  } finally {
    await browser.close();
  }

  console.log(`Normalized office-v2 art into ${outputRoot}`);
  console.log(`Wrote QA composites into ${QA_ROOT}`);
}

export async function main(argv = process.argv.slice(2)) {
  const resolved = resolveOfficeV2ArtPaths({
    repoRoot,
    cwd: process.cwd(),
    sourceArg: argv[0] || "tmp/office-v2-source",
    outputArg: argv[1] || "public/work-office-v2",
  });
  if (resolved.mode === "characters") {
    const result = await normalizeCharacterCohort(resolved);
    console.log(
      `Normalized ${result.characters} ${result.cohort} characters `
      + `with ${result.clipsPerCharacter} clips each into ${resolved.outputRoot}`,
    );
    return;
  }
  await normalizeEnvironment(resolved);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
