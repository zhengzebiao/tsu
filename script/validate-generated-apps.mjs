import { join } from "node:path";
import { defaultCliEntry, repoRoot, validateGeneratedApps } from "./generated-app-validation.mjs";

await validateGeneratedApps({
  cliEntry: defaultCliEntry,
  tempRoot: join(repoRoot, "tmp", "validate-generated-apps")
});
