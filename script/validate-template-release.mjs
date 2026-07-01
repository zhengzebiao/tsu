import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.env.TEMPLATE_VERSION ?? "0.0.0";
const releaseDir = join(repoRoot, "dist", "template-release");
const archiveName = `tsu-templates-v${version}.tar.gz`;
const archivePath = join(releaseDir, archiveName);
const tempDir = await mkdtemp(join(tmpdir(), "tsu-release-"));

try {
  await ensureArchive();
  await execFileAsync("tar", ["-tzf", archiveName], { cwd: releaseDir, maxBuffer: 10 * 1024 * 1024 });
  const bundleDir = join(tempDir, `tsu-templates-v${version}`);
  await cp(join(releaseDir, `tsu-templates-v${version}`), bundleDir, { recursive: true });
  const manifest = JSON.parse(await readFile(join(bundleDir, "manifest.json"), "utf8"));

  const templateNames = manifest.templates.map((template) => template.name);

  const expectedTemplates = ["default", "monorepo", "vue3", "mfe", "react", "python-main", "python-app"];
  const missingTemplates = expectedTemplates.filter((templateName) => !templateNames.includes(templateName));

  if (missingTemplates.length > 0) {
    throw new Error(`Release manifest does not include expected templates: ${missingTemplates.join(", ")}.`);
  }

  if (!manifest.templates.find((template) => template.name === "vue3")?.description) {
    throw new Error("Release manifest does not include template details.");
  }

  await access(join(bundleDir, "default", "package.json"));
  await access(join(bundleDir, "monorepo", "package.json"));
  await access(join(bundleDir, "vue3", "package.json"));
  await access(join(bundleDir, "mfe", "package.json"));
  await access(join(bundleDir, "react", "package.json"));
  await access(join(bundleDir, "python-main", "pyproject.toml"));
  await access(join(bundleDir, "python-main", "app", "main.py"));
  await access(join(bundleDir, "python-main", "alembic", "versions", "0001_initial_auth_schema.py"));
  await access(join(bundleDir, "python-main", "app", "models", "permission.py"));
  await access(join(bundleDir, "python-main", "app", "services", "session_service.py"));
  await access(join(bundleDir, "python-main", "app", "seed", "__main__.py"));
  await access(join(bundleDir, "python-main", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "python-main", "tests", "test_auth_api.py"));
  await access(join(bundleDir, "python-main", "tests", "test_token_service.py"));
  await access(join(bundleDir, "python-main", "tests", "test_refresh_token_service.py"));
  await assertReadmeContains(join(bundleDir, "python-main", "README.md"), [
    "## Auth API",
    "POST /auth/login",
    "## JWT Configuration",
    "JWT_PRIVATE_KEY",
    "## Redis Token State",
    "REFRESH_TOKEN_REUSE_GRACE_SECONDS",
    "revokes the session",
    "## Database Migrations and Seed",
    "alembic downgrade -1",
    "alembic downgrade <revision_id>",
    "seed is idempotent",
    "Product does not auto-run seed",
    "## FAQ"
  ]);
  await access(join(bundleDir, "python-app", "pyproject.toml"));
  await access(join(bundleDir, "python-app", "app", "main.py"));
  await access(join(bundleDir, "python-app", "alembic", "versions", "0001_initial_app_schema.py"));
  await access(join(bundleDir, "python-app", "app", "models", "app_setting.py"));
  await access(join(bundleDir, "python-app", "app", "models", "sample_profile.py"));
  await access(join(bundleDir, "python-app", "app", "services", "session_service.py"));
  await access(join(bundleDir, "python-app", "app", "seed", "__main__.py"));
  await access(join(bundleDir, "python-app", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "python-app", "tests", "test_profile_api.py"));
  await assertReadmeContains(join(bundleDir, "python-app", "README.md"), [
    "## Protected API Usage",
    "Authorization: Bearer <access-token>",
    "## Auth Integration with python-main",
    "JWT_PUBLIC_KEY",
    "## Redis Blacklist",
    "SESSION_PREFIX",
    "sessions revoked by logout or refresh-token reuse",
    "## Scopes and Permissions",
    "## Database Migrations and Seed",
    "alembic downgrade -1",
    "alembic downgrade <revision_id>",
    "seed is idempotent",
    "Product does not auto-run seed",
    "## FAQ"
  ]);
  process.stdout.write(`Validated release archive ${archivePath}\n`);
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

async function assertReadmeContains(filePath, requiredMarkers) {
  const content = await readFile(filePath, "utf8");
  const missingMarkers = requiredMarkers.filter((marker) => !content.includes(marker));

  if (missingMarkers.length > 0) {
    throw new Error(`README ${filePath} is missing required markers: ${missingMarkers.join(", ")}.`);
  }
}

async function ensureArchive() {
  await access(archivePath).catch(() => {
    throw new Error(`Missing release archive: ${archivePath}. Run pnpm template:release:build --version=${version} first.`);
  });
}
