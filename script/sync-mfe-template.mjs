import { copyFile, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(repoRoot, "template", "src", "mfe.ts");
const targetPath = join(repoRoot, "cli", "src", "mfe.ts");
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  const [source, target] = await Promise.all([readFile(sourcePath, "utf8"), readFile(targetPath, "utf8")]);

  if (source !== target) {
    throw new Error("cli/src/mfe.ts is out of sync with template/src/mfe.ts. Run pnpm template:sync:mfe.");
  }

  process.stdout.write("cli/src/mfe.ts is in sync with template/src/mfe.ts\n");
} else {
  await copyFile(sourcePath, targetPath);
  process.stdout.write("Synced template/src/mfe.ts -> cli/src/mfe.ts\n");
}
