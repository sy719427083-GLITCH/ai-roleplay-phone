import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const PAGE_ASSET_DIRECTORIES = Object.freeze([
  "assets",
  "work-office-v2",
  "worldbook-assets",
]);

const retiredOfficeDirectory = ["work", "office", "assets"].join("-");

const listFiles = async (rootDirectory, relativeDirectory = "") => {
  const entries = await readdir(resolve(rootDirectory, relativeDirectory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(rootDirectory, relativePath));
    else if (entry.isFile()) files.push(relativePath);
    else throw new Error(`Unsupported deploy entry: ${relativePath}`);
  }
  return files.sort();
};

const replaceDirectory = async (source, destination) => {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
};

const assertMatchingFileLists = async (label, source, destination) => {
  const sourceFiles = await listFiles(source);
  const destinationFiles = await listFiles(destination);
  if (
    sourceFiles.length !== destinationFiles.length
    || sourceFiles.some((fileName, index) => fileName !== destinationFiles[index])
  ) {
    throw new Error(`${label} file list does not match dist`);
  }
};

export async function syncPages({ repositoryRoot }) {
  const root = resolve(repositoryRoot);
  const distDirectory = resolve(root, "dist");
  const docsDirectory = resolve(root, "docs");
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (typeof packageJson.version !== "string" || !packageJson.version.trim()) {
    throw new Error("package.json must contain a non-empty version string");
  }

  await mkdir(docsDirectory, { recursive: true });
  await rm(resolve(docsDirectory, retiredOfficeDirectory), { recursive: true, force: true });
  await cp(resolve(distDirectory, "index.html"), resolve(docsDirectory, "index.html"), { force: true });

  for (const assetDirectory of PAGE_ASSET_DIRECTORIES) {
    const source = resolve(distDirectory, assetDirectory);
    const destination = resolve(docsDirectory, assetDirectory);
    await replaceDirectory(source, destination);
    await assertMatchingFileLists(assetDirectory, source, destination);
  }

  await writeFile(resolve(docsDirectory, ".deploy-version"), packageJson.version, "utf8");
  return { version: packageJson.version, assetDirectories: [...PAGE_ASSET_DIRECTORIES] };
}
