import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

const CHARACTER_COHORTS = ["employee-f", "employee-m", "boss-f", "boss-m"];

function isSameOrDescendant(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function canonicalizePath(candidate) {
  const missingSegments = [];
  let ancestor = candidate;
  while (true) {
    try {
      lstatSync(ancestor);
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      missingSegments.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
  return path.join(realpathSync(ancestor), ...missingSegments);
}

function assertOutputAncestorsAreNotSymlinks({ canonicalRepoRoot, resolvedRepoRoot, outputRoot }) {
  const relativeOutput = path.relative(resolvedRepoRoot, outputRoot);
  let current = canonicalRepoRoot;
  for (const segment of relativeOutput.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stats = lstatSync(current);
      if (stats.isSymbolicLink()) {
        throw new Error(`office-v2 output path has a symlinked ancestor: ${current}`);
      }
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
  }
}

export function resolveOfficeV2ArtPaths({ repoRoot, cwd, sourceArg, outputArg }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const canonicalRepoRoot = realpathSync(resolvedRepoRoot);
  const sourceRoot = path.resolve(cwd, sourceArg);
  const outputRoot = path.resolve(cwd, outputArg);
  const expectedOutputRoot = path.join(resolvedRepoRoot, "public", "work-office-v2");
  const expectedCharacterRoot = path.join(expectedOutputRoot, "characters");

  if (outputRoot !== expectedOutputRoot && outputRoot !== expectedCharacterRoot) {
    throw new Error(
      `office-v2 output must be exactly the repository public/work-office-v2 directory `
      + `or its characters directory: ${expectedOutputRoot}`,
    );
  }

  assertOutputAncestorsAreNotSymlinks({ canonicalRepoRoot, resolvedRepoRoot, outputRoot });
  const canonicalSourceRoot = canonicalizePath(sourceRoot);
  const canonicalOutputRoot = canonicalizePath(outputRoot);
  if (!isSameOrDescendant(canonicalOutputRoot, canonicalRepoRoot)) {
    throw new Error(`office-v2 output must remain inside the repository: ${canonicalRepoRoot}`);
  }
  if (
    isSameOrDescendant(canonicalSourceRoot, canonicalOutputRoot)
    || isSameOrDescendant(canonicalOutputRoot, canonicalSourceRoot)
  ) {
    throw new Error("office-v2 source and output directories must not overlap");
  }

  if (outputRoot === expectedCharacterRoot) {
    const cohort = path.basename(sourceRoot);
    if (!CHARACTER_COHORTS.includes(cohort)) {
      throw new Error(`Character cohort must be one of: ${CHARACTER_COHORTS.join(", ")}`);
    }
    return { mode: "characters", cohort, sourceRoot, outputRoot };
  }

  return { mode: "environment", sourceRoot, outputRoot };
}
