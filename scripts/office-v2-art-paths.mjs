import path from "node:path";

const CHARACTER_COHORTS = ["employee-f", "employee-m", "boss-f", "boss-m"];

function isSameOrDescendant(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export function resolveOfficeV2ArtPaths({ repoRoot, cwd, sourceArg, outputArg }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
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

  if (isSameOrDescendant(sourceRoot, outputRoot) || isSameOrDescendant(outputRoot, sourceRoot)) {
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
