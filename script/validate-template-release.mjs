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

  const expectedTemplates = ["default", "monorepo", "vue3", "mfe", "mfe-main", "mfe-app", "react", "python-main", "python-app"];
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
  await access(join(bundleDir, "mfe-main", "package.json"));
  await access(join(bundleDir, "mfe-main", ".dockerignore"));
  await access(join(bundleDir, "mfe-main", ".env.deploy.example"));
  await access(join(bundleDir, "mfe-main", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "mfe-main", ".github", "workflows", "deploy.yml"));
  await access(join(bundleDir, "mfe-main", "Dockerfile"));
  await access(join(bundleDir, "mfe-main", "nginx", "nginx.conf"));
  await access(join(bundleDir, "mfe-main", "docker-compose.yml"));
  await access(join(bundleDir, "mfe-main", "playwright.config.ts"));
  await access(join(bundleDir, "mfe-main", "e2e", "host-login.spec.ts"));
  await access(join(bundleDir, "mfe-main", "e2e", "host-load-subapp.spec.ts"));
  await access(join(bundleDir, "mfe-main", "apps", "main", "package.json"));
  await access(join(bundleDir, "mfe-main", "apps", "main", "src", "test", "setup.ts"));
  await access(join(bundleDir, "mfe-main", "apps", "main", "src", "main.tsx"));
  await access(join(bundleDir, "mfe-main", "apps", "main", "src", "pages", "LoginPage.test.tsx"));
  await access(join(bundleDir, "mfe-main", "packages", "shared", "package.json"));
  await access(join(bundleDir, "mfe-main", "packages", "shared", "src", "index.ts"));
  await access(join(bundleDir, "mfe-main", "packages", "ui", "package.json"));
  await access(join(bundleDir, "mfe-main", "packages", "ui", "src", "index.tsx"));
  await access(join(bundleDir, "mfe-main", "packages", "api", "package.json"));
  await access(join(bundleDir, "mfe-main", "packages", "api", "src", "index.ts"));
  await access(join(bundleDir, "mfe-app", "package.json"));
  await access(join(bundleDir, "mfe-app", ".dockerignore"));
  await access(join(bundleDir, "mfe-app", ".env.deploy.example"));
  await access(join(bundleDir, "mfe-app", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "mfe-app", ".github", "workflows", "deploy.yml"));
  await access(join(bundleDir, "mfe-app", "prettier.config.js"));
  await access(join(bundleDir, "mfe-app", ".prettierignore"));
  await access(join(bundleDir, "mfe-app", "Dockerfile"));
  await access(join(bundleDir, "mfe-app", "nginx", "nginx.conf"));
  await access(join(bundleDir, "mfe-app", "docker-compose.yml"));
  await access(join(bundleDir, "mfe-app", "playwright.config.ts"));
  await access(join(bundleDir, "mfe-app", "e2e", "standalone.spec.ts"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "package.json"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "test", "setup.ts"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "main.tsx"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "bootstrap.tsx"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "qiankun.ts"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "pages", "BusinessHomePage.tsx"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "pages", "BusinessHomePage.test.tsx"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "providers", "AppProviders.tsx"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "providers", "query-client.ts"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "stores", "app.store.ts"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "queries", "business-home.query.ts"));
  await access(join(bundleDir, "mfe-app", "apps", "app", "src", "services", "api-client.ts"));
  await access(join(bundleDir, "mfe-app", "packages", "shared", "package.json"));
  await access(join(bundleDir, "mfe-app", "packages", "shared", "src", "index.ts"));
  await access(join(bundleDir, "mfe-app", "packages", "ui", "package.json"));
  await access(join(bundleDir, "mfe-app", "packages", "ui", "src", "index.tsx"));
  await access(join(bundleDir, "mfe-app", "packages", "api", "package.json"));
  await access(join(bundleDir, "mfe-app", "packages", "api", "src", "index.ts"));
  await assertFileContains(join(bundleDir, "mfe-main", "Dockerfile"), [
    "FROM nginx:1.27-alpine",
    "ARG VITE_API_BASE_URL=/api",
    "ARG VITE_MFE_APP_ENTRY=//localhost:7201",
    "ARG VITE_APP_ENV=production",
    "COPY --from=build /app/apps/main/dist /usr/share/nginx/html"
  ]);
  await assertFileContains(join(bundleDir, "mfe-main", "nginx", "nginx.conf"), ["try_files $uri $uri/ /index.html", "Cache-Control \"public, immutable\""]);
  await assertFileContains(join(bundleDir, "mfe-main", "docker-compose.yml"), ["${DOCKER_IMAGE_NAME:-", "${APP_VERSION:-local}", "${APP_PORT:-7200}:80", "VITE_APP_ENV: ${APP_ENV:-local}"]);
  await assertFileContains(join(bundleDir, "mfe-main", ".github", "workflows", "ci.yml"), ciWorkflowMarkers());
  await assertFileContains(join(bundleDir, "mfe-main", "package.json"), ["\"format:check\"", ".github/workflows/deploy.yml"]);
  await assertFileContains(join(bundleDir, "mfe-main", ".github", "workflows", "deploy.yml"), deployWorkflowMarkers());
  await assertReadmeContains(join(bundleDir, "mfe-main", "README.md"), deployReadmeMarkers());
  await assertFileContains(join(bundleDir, "mfe-app", "Dockerfile"), [
    "FROM nginx:1.27-alpine",
    "ARG VITE_API_BASE_URL=/api",
    "ARG VITE_MFE_APP_ENTRY=//localhost:7201",
    "ARG VITE_APP_ENV=production",
    "COPY --from=build /app/apps/app/dist /usr/share/nginx/html"
  ]);
  await assertFileContains(join(bundleDir, "mfe-app", "nginx", "nginx.conf"), ["try_files $uri $uri/ /index.html", "Access-Control-Allow-Origin \"*\""]);
  await assertFileContains(join(bundleDir, "mfe-app", "docker-compose.yml"), ["${DOCKER_IMAGE_NAME:-", "${APP_VERSION:-local}", "${APP_PORT:-7201}:80", "VITE_APP_ENV: ${APP_ENV:-local}"]);
  await assertFileContains(join(bundleDir, "mfe-app", ".github", "workflows", "ci.yml"), ciWorkflowMarkers());
  await assertFileContains(join(bundleDir, "mfe-app", ".github", "workflows", "deploy.yml"), deployWorkflowMarkers());
  await assertReadmeContains(join(bundleDir, "mfe-app", "README.md"), deployReadmeMarkers());
  await assertFileContains(join(bundleDir, "mfe-app", "package.json"), ["\"format:check\"", "\"prettier\"", ".github/workflows/deploy.yml"]);
  await assertFileContains(join(bundleDir, "mfe-app", "prettier.config.js"), ["printWidth"]);
  await assertFileContains(join(bundleDir, "mfe-app", ".prettierignore"), ["apps/*/dist"]);
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

function ciWorkflowMarkers() {
  return [
    "name: CI",
    "pull_request:",
    "push:",
    "- main",
    "- master",
    "actions/checkout@v4",
    "pnpm/action-setup@v4",
    "version: 8.15.9",
    "actions/setup-node@v4",
    "node-version: 20",
    "cache: pnpm",
    "pnpm install --frozen-lockfile",
    "pnpm lint",
    "pnpm format:check",
    "pnpm test",
    "pnpm build",
    "pnpm exec playwright install --with-deps chromium",
    "pnpm test:e2e"
  ];
}

function deployWorkflowMarkers() {
  return [
    "name: Deploy",
    "test-v*.*.*",
    "product-v*.*.*",
    "workflow_dispatch:",
    "environment:",
    "image_tag",
    "version",
    "should_build",
    "packages: write",
    "docker build",
    "docker push",
    "DOCKER_REGISTRY_TOKEN",
    "SSH_PRIVATE_KEY",
    "VITE_API_BASE_URL",
    "VITE_MFE_APP_ENTRY",
    "VITE_APP_ENV",
    "docker-compose.yml",
    "scp",
    "ssh",
    "docker compose --env-file .env -f docker-compose.yml pull app",
    "docker compose --env-file .env -f docker-compose.yml up -d --no-build app",
    "Refusing to deploy a latest tag"
  ];
}

function deployReadmeMarkers() {
  return [
    "GitHub Actions Deploy",
    "test-v*.*.*",
    "product-v*.*.*",
    "workflow_dispatch",
    "image_tag",
    "GitHub Environments",
    "DOCKER_REGISTRY_TOKEN",
    "SSH_PRIVATE_KEY",
    "docker compose up -d --no-build",
    "build-time variables"
  ];
}

async function assertReadmeContains(filePath, requiredMarkers) {
  const content = await readFile(filePath, "utf8");
  const missingMarkers = requiredMarkers.filter((marker) => !content.includes(marker));

  if (missingMarkers.length > 0) {
    throw new Error(`README ${filePath} is missing required markers: ${missingMarkers.join(", ")}.`);
  }
}

async function assertFileContains(filePath, requiredMarkers) {
  const content = await readFile(filePath, "utf8");
  const missingMarkers = requiredMarkers.filter((marker) => !content.includes(marker));

  if (missingMarkers.length > 0) {
    throw new Error(`${filePath} is missing required markers: ${missingMarkers.join(", ")}.`);
  }
}

async function ensureArchive() {
  await access(archivePath).catch(() => {
    throw new Error(`Missing release archive: ${archivePath}. Run pnpm template:release:build --version=${version} first.`);
  });
}
