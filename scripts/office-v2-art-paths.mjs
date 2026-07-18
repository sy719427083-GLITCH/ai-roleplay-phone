import path from "node:path";

function isSameOrDescendant(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export function resolveOfficeV2ArtPaths({ repoRoot, cwd, sourceArg, outputArg }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const sourceRoot = path.resolve(cwd, sourceArg);
  const outputRoot = path.resolve(cwd, outputArg);
  const expectedOutputRoot = path.join(resolvedRepoRoot, "public", "work-office-v2");

  if (outputRoot !== expectedOutputRoot) {
    throw new Error(`office-v2 output must be exactly the repository public/work-office-v2 directory: ${expectedOutputRoot}`);
  }

  if (isSameOrDescendant(sourceRoot, outputRoot) || isSameOrDescendant(outputRoot, sourceRoot)) {
    throw new Error("office-v2 source and output directories must not overlap");
  }

  return { sourceRoot, outputRoot };
}
