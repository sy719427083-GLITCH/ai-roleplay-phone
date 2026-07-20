import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncPages } from "./pages-sync-contract.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

await syncPages({ repositoryRoot });
