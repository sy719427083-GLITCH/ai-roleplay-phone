import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { OFFICE_CHARACTER_SPECS } from "./office-art-spec.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "docs/superpowers/qa/office-chibis-contact-sheet.webp");
const frames = [
  { row: 0, column: 1, label: "WALK" },
  { row: 3, column: 1, label: "WORK" },
  { row: 6, column: 6, label: "CHAT" },
];

const imageSources = await Promise.all(OFFICE_CHARACTER_SPECS.map(async ({ id }) => {
  const buffer = await readFile(resolve(root, `public/work-office-assets/chibi/${id}.webp`));
  return { id, source: `data:image/webp;base64,${buffer.toString("base64")}` };
}));

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(async ({ characters, frameSpecs }) => {
    const width = 1440;
    const height = 1540;
    const margin = 36;
    const gap = 18;
    const columns = 4;
    const cardWidth = (width - (margin * 2) - (gap * (columns - 1))) / columns;
    const cardHeight = 348;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    context.fillStyle = "#f7f7f6";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#202326";
    context.font = "600 30px ui-sans-serif, system-ui, sans-serif";
    context.fillText("OFFICE CHIBI ATLAS QA", margin, 44);
    context.fillStyle = "#74777b";
    context.font = "500 15px ui-sans-serif, system-ui, sans-serif";
    context.fillText("16 identities · walk / work / chat · 104 px runtime sample", margin, 70);

    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index];
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = margin + (column * (cardWidth + gap));
      const y = 98 + (row * (cardHeight + gap));
      const image = new Image();
      image.src = character.source;
      await image.decode();

      context.fillStyle = "#ffffff";
      context.fillRect(x, y, cardWidth, cardHeight);
      context.strokeStyle = "#d8dadd";
      context.lineWidth = 1;
      context.strokeRect(x + 0.5, y + 0.5, cardWidth - 1, cardHeight - 1);

      context.fillStyle = "#25282c";
      context.font = "600 17px ui-sans-serif, system-ui, sans-serif";
      context.fillText(character.id, x + 18, y + 29);

      frameSpecs.forEach((frame, frameIndex) => {
        const frameX = x + 16 + (frameIndex * 105);
        const frameY = y + 51;
        context.fillStyle = frameIndex === 0 ? "#f4f0f1" : frameIndex === 1 ? "#eef2f4" : "#f1eff5";
        context.fillRect(frameX, frameY, 96, 248);
        context.drawImage(
          image,
          frame.column * 256,
          frame.row * 256,
          256,
          256,
          frameX - 4,
          frameY + 55,
          104,
          104,
        );
        context.fillStyle = "#696d72";
        context.font = "600 11px ui-sans-serif, system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText(frame.label, frameX + 48, frameY + 228);
      });
      context.textAlign = "left";
    }

    return canvas.toDataURL("image/webp", 0.92);
  }, { characters: imageSources, frameSpecs: frames });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
} finally {
  await browser.close();
}

console.log(outputPath);
