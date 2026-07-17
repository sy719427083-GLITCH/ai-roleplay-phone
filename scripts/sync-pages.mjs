import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const distDirectory = resolve(repositoryRoot, "dist");
const docsDirectory = resolve(repositoryRoot, "docs");
const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));

if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
  throw new Error("package.json must contain a non-empty version string");
}

const replaceAssetDirectory = async (assetDirectory) => {
  const source = resolve(distDirectory, assetDirectory);
  const destination = resolve(docsDirectory, assetDirectory);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
  return { source, destination };
};

const listFiles = async (rootDirectory, relativeDirectory = "") => {
  const entries = await readdir(resolve(rootDirectory, relativeDirectory), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(rootDirectory, relativePath));
    else if (entry.isFile()) files.push(relativePath);
    else throw new Error(`Unsupported asset entry: ${relativePath}`);
  }

  return files.sort();
};

const verifyMatchingFileLists = async (assetDirectory, source, destination) => {
  const sourceFiles = await listFiles(source);
  const destinationFiles = await listFiles(destination);
  const listsMatch = sourceFiles.length === destinationFiles.length
    && sourceFiles.every((fileName, index) => fileName === destinationFiles[index]);

  if (!listsMatch) {
    throw new Error(`${assetDirectory} file list does not match dist`);
  }
};

await replaceAssetDirectory("assets");

await cp(resolve(distDirectory, "index.html"), resolve(docsDirectory, "index.html"), { force: true });

for (const assetDirectory of ["work-office-assets", "worldbook-assets"]) {
  const { source, destination } = await replaceAssetDirectory(assetDirectory);
  await verifyMatchingFileLists(assetDirectory, source, destination);
}

await writeFile(resolve(docsDirectory, ".deploy-version"), packageJson.version, "utf8");
