import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { initProject } from "../cli/dist/index.js";
import { mfeAppTemplates, removeWithRetries, validateGeneratedApps } from "./generated-app-validation.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.env.TEMPLATE_VERSION ?? "0.0.0";
const validationMode = readValidationMode();
const releaseDir = join(repoRoot, "dist", "template-release");
const archiveName = `tsu-templates-v${version}.tar.gz`;
const archivePath = join(releaseDir, archiveName);
const tempDir = await mkdtemp(join(tmpdir(), "tsu-release-"));

try {
  await ensureArchive();
  await execFileAsync("tar", ["-tzf", archiveName], { cwd: releaseDir, maxBuffer: 10 * 1024 * 1024 });
  await execFileAsync("tar", ["-xzf", archiveName, "-C", tempDir], { cwd: releaseDir, maxBuffer: 10 * 1024 * 1024 });

  const bundleDir = join(tempDir, `tsu-templates-v${version}`);
  const manifest = JSON.parse(await readFile(join(bundleDir, "manifest.json"), "utf8"));

  validateManifest(manifest);

  await validateBundleFiles(bundleDir);
  if (validationMode === "full") {
    await validateReleaseGeneratedMfeApps(bundleDir);
  } else {
    process.stdout.write("Skipped release generated MFE project validation in quick mode\n");
  }

  process.stdout.write(`Validated release archive ${archivePath}\n`);
} finally {
  await removeWithRetries(tempDir);
}

function readValidationMode() {
  const mode = process.env.TEMPLATE_RELEASE_VALIDATE_MODE ?? "full";

  if (mode !== "full" && mode !== "quick") {
    throw new Error(`Unsupported TEMPLATE_RELEASE_VALIDATE_MODE ${mode}. Expected full or quick.`);
  }

  return mode;
}

async function validateBundleFiles(bundleDir) {
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
  await access(join(bundleDir, "python-main", ".env.deploy.example"));
  await access(join(bundleDir, "python-main", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "python-main", ".github", "workflows", "deploy.yml"));
  await access(join(bundleDir, "python-main", ".github", "workflows", "migrate.yml"));
  await access(join(bundleDir, "python-main", "docker-compose.deploy.yml"));
  await access(join(bundleDir, "python-main", "docker-compose.infra.yml"));
  await access(join(bundleDir, "python-main", "tests", "test_auth_api.py"));
  await access(join(bundleDir, "python-main", "tests", "test_token_service.py"));
  await access(join(bundleDir, "python-main", "tests", "test_refresh_token_service.py"));
  await access(join(bundleDir, "python-main", "tests", "test_logging.py"));
  await access(join(bundleDir, "python-main", "tests", "test_redis_state_services.py"));
  await assertFileContains(join(bundleDir, "python-main", ".github", "workflows", "deploy.yml"), pythonDeployWorkflowMarkers(true));
  await assertFileContains(join(bundleDir, "python-main", ".github", "workflows", "migrate.yml"), pythonMigrateWorkflowMarkers());
  await assertFileDoesNotContain(join(bundleDir, "python-main", ".github", "workflows", "migrate.yml"), ["JWT_PRIVATE_KEY", "pdm run seed", "python -m app.seed", "docker-compose.infra.yml"]);
  await assertFileContains(join(bundleDir, "python-main", "docker-compose.deploy.yml"), pythonDeployComposeMarkers());
  await assertFileContains(join(bundleDir, "python-main", "docker-compose.infra.yml"), pythonInfraComposeMarkers());
  await assertFileContains(join(bundleDir, "python-main", ".env.deploy.example"), pythonDeployEnvMarkers(true));
  await assertReadmeContains(join(bundleDir, "python-main", "README.md"), [
    ...pythonDeployReadmeMarkers(true),
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
  await access(join(bundleDir, "python-app", ".env.deploy.example"));
  await access(join(bundleDir, "python-app", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "python-app", ".github", "workflows", "deploy.yml"));
  await access(join(bundleDir, "python-app", ".github", "workflows", "migrate.yml"));
  await access(join(bundleDir, "python-app", "docker-compose.deploy.yml"));
  await access(join(bundleDir, "python-app", "docker-compose.infra.yml"));
  await access(join(bundleDir, "python-app", "tests", "test_profile_api.py"));
  await access(join(bundleDir, "python-app", "tests", "test_logging.py"));
  await access(join(bundleDir, "python-app", "tests", "test_redis_state_services.py"));
  await assertFileContains(join(bundleDir, "python-app", ".github", "workflows", "deploy.yml"), pythonDeployWorkflowMarkers(false));
  await assertFileDoesNotContain(join(bundleDir, "python-app", ".github", "workflows", "deploy.yml"), ["JWT_PRIVATE_KEY"]);
  await assertFileContains(join(bundleDir, "python-app", ".github", "workflows", "migrate.yml"), pythonMigrateWorkflowMarkers());
  await assertFileDoesNotContain(join(bundleDir, "python-app", ".github", "workflows", "migrate.yml"), ["JWT_PRIVATE_KEY", "pdm run seed", "python -m app.seed", "docker-compose.infra.yml"]);
  await assertFileContains(join(bundleDir, "python-app", "docker-compose.deploy.yml"), pythonDeployComposeMarkers());
  await assertFileContains(join(bundleDir, "python-app", "docker-compose.infra.yml"), pythonInfraComposeMarkers());
  await assertFileContains(join(bundleDir, "python-app", ".env.deploy.example"), pythonDeployEnvMarkers(false));
  await assertFileDoesNotContain(join(bundleDir, "python-app", ".env.deploy.example"), ["JWT_PRIVATE_KEY"]);
  await assertReadmeContains(join(bundleDir, "python-app", "README.md"), [
    ...pythonDeployReadmeMarkers(false),
    "## Protected API Usage",
    "Authorization: Bearer <access-token>",
    "## Auth Integration with python-main",
    "JWT_PUBLIC_KEY",
    "## Redis Blacklist",
    "SESSION_PREFIX",
    "sessions revoked by logout or refresh-token reuse",
    "## Scopes and Permissions",
    "require_any_scope",
    "require_any_role",
    "## Database Migrations and Seed",
    "alembic downgrade -1",
    "alembic downgrade <revision_id>",
    "seed is idempotent",
    "Product does not auto-run seed",
    "## FAQ"
  ]);
}

function validateManifest(manifest) {
  if (manifest.version !== version) {
    throw new Error(`Release manifest version ${manifest.version} does not match expected ${version}.`);
  }

  if (manifest.asset && manifest.asset !== archiveName) {
    throw new Error(`Release manifest asset ${manifest.asset} does not match expected ${archiveName}.`);
  }

  const templateNames = manifest.templates.map((template) => (typeof template === "string" ? template : template.name));
  const expectedTemplates = ["default", "monorepo", "vue3", "mfe", "mfe-main", "mfe-app", "react", "python-main", "python-app"];
  const missingTemplates = expectedTemplates.filter((templateName) => !templateNames.includes(templateName));

  if (missingTemplates.length > 0) {
    throw new Error(`Release manifest does not include expected templates: ${missingTemplates.join(", ")}.`);
  }

  for (const templateName of ["mfe-main", "mfe-app"]) {
    const definition = manifest.templates.find((template) => (typeof template === "string" ? template : template.name) === templateName);

    if (!definition || typeof definition === "string" || !definition.description) {
      throw new Error(`Release manifest does not include metadata for ${templateName}.`);
    }
  }

  if (!manifest.templates.find((template) => (typeof template === "string" ? template === "vue3" : template.name === "vue3" && template.description))) {
    throw new Error("Release manifest does not include template details.");
  }
}

async function validateReleaseGeneratedMfeApps(bundleDir) {
  await validateGeneratedApps({
    templates: mfeAppTemplates,
    tempRoot: join(tempDir, "release-generated-apps"),
    generateProject: (template, context) => generateReleaseProject(template, context),
    runIntegrationE2e: true
  });
  process.stdout.write(`Validated release bundle generated MFE projects from ${bundleDir}\n`);
}

async function generateReleaseProject(template, { projectRoot, tempRoot }) {
  await withReleaseArchiveFetch(async () => {
    await initProject({
      cwd: tempRoot,
      projectName: template.projectName,
      templateName: template.name,
      version,
      source: "remote",
      repository: "local/tsu",
      cache: false,
      refresh: true,
      force: true
    });
  });

  const metadata = JSON.parse(await readFile(join(projectRoot, ".tsu", "template.json"), "utf8"));

  if (metadata.template.name !== template.name) {
    throw new Error(`Generated metadata records ${metadata.template.name}, expected ${template.name}.`);
  }

  if (metadata.template.version !== version) {
    throw new Error(`Generated metadata records version ${metadata.template.version}, expected ${version}.`);
  }

  if (metadata.template.source !== "remote") {
    throw new Error(`Generated metadata records source ${metadata.template.source}, expected remote.`);
  }

  if (metadata.template.repository !== "local/tsu") {
    throw new Error(`Generated metadata records repository ${metadata.template.repository}, expected local/tsu.`);
  }
}

async function withReleaseArchiveFetch(action) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = getFetchUrl(input);

    if (url.endsWith(`/${archiveName}`)) {
      return new Response(await readFile(archivePath), {
        status: 200,
        headers: {
          "content-type": "application/gzip"
        }
      });
    }

    if (!originalFetch) {
      throw new Error(`Unexpected fetch during release validation: ${url}`);
    }

    return originalFetch(input, init);
  };

  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function getFetchUrl(input) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input?.url ?? "";
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
    "Local development",
    "Local quality gates",
    "GitHub Actions Deploy",
    "test-v*.*.*",
    "product-v*.*.*",
    "test-v1.0.1",
    "product-v1.0.1",
    "workflow_dispatch",
    "image_tag",
    "rollback",
    "GitHub Environments",
    "DOCKER_REGISTRY_TOKEN",
    "SSH_PRIVATE_KEY",
    "deploy.yml automatically uploads docker-compose.yml",
    "docker compose up -d --no-build",
    "VITE_API_BASE_URL is a build-time variable"
  ];
}

function pythonDeployWorkflowMarkers(includePrivateKey) {
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
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_PUBLIC_KEY",
    ...(includePrivateKey ? ["JWT_PRIVATE_KEY"] : []),
    "docker-compose.deploy.yml",
    "nginx/default.conf",
    "scp",
    "ssh",
    "docker compose --env-file .env -f docker-compose.deploy.yml pull api",
    "docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-build api nginx",
    "Refusing to deploy a latest tag"
  ];
}

function pythonMigrateWorkflowMarkers() {
  return [
    "name: Migrate",
    "workflow_dispatch:",
    "environment:",
    "revision",
    "backup_confirmed",
    "actions/checkout@v4",
    "SSH_PRIVATE_KEY",
    "DEPLOY_HOST",
    "DEPLOY_USER",
    "DEPLOY_PATH",
    "Refusing to run product migration without backup confirmation",
    "docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic current",
    "docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic upgrade"
  ];
}

function pythonDeployComposeMarkers() {
  return [
    "api:",
    "nginx:",
    "${DOCKER_IMAGE_NAME}:${APP_VERSION}",
    "env_file:",
    "/health",
    "external: true",
    "DOCKER_NETWORK_NAME"
  ];
}

function pythonInfraComposeMarkers() {
  return ["postgres:16-alpine", "redis:7-alpine", "postgres_data", "redis_data", "appendonly yes", "DOCKER_NETWORK_NAME"];
}

function pythonDeployEnvMarkers(includePrivateKey) {
  return [
    "DOCKER_IMAGE_NAME",
    "APP_VERSION",
    "CONTAINER_NAME",
    "APP_ENV",
    "APP_PORT",
    "NGINX_PORT",
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_ISSUER",
    "JWT_AUDIENCE",
    "JWT_PUBLIC_KEY",
    "TOKEN_BLACKLIST_PREFIX",
    "SESSION_PREFIX",
    ...(includePrivateKey ? ["JWT_PRIVATE_KEY", "REFRESH_TOKEN_EXPIRE_DAYS", "REFRESH_TOKEN_REUSE_GRACE_SECONDS"] : [])
  ];
}

function pythonDeployReadmeMarkers(includePrivateKey) {
  return [
    "Release Deploy and Rollback",
    "GitHub Environments",
    "Docker Infra",
    "Tag Release",
    "Rollback",
    "Migration Policy",
    "Migrate workflow",
    "backup_confirmed = true",
    "Seed Policy",
    "test-v1.0.1",
    "product-v1.0.1",
    "image_tag = product-v1.0.0",
    "docker compose --env-file .env -f docker-compose.deploy.yml pull api",
    "Product does not auto-run seed",
    includePrivateKey ? "python-main` owns `JWT_PRIVATE_KEY" : "python-app` uses only `JWT_PUBLIC_KEY"
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

async function assertFileDoesNotContain(filePath, forbiddenMarkers) {
  const content = await readFile(filePath, "utf8");
  const foundMarkers = forbiddenMarkers.filter((marker) => content.includes(marker));

  if (foundMarkers.length > 0) {
    throw new Error(`${filePath} contains forbidden markers: ${foundMarkers.join(", ")}.`);
  }
}

async function ensureArchive() {
  await access(archivePath).catch(() => {
    throw new Error(`Missing release archive: ${archivePath}. Run pnpm template:release:build --version=${version} first.`);
  });
}
