import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "cli", "dist", "index.js");
const appTemplates = [
  { name: "vue3", projectName: "web-app", useLocalPackages: true, commands: [["lint"], ["test"], ["build"]] },
  { name: "react", projectName: "react-app", useLocalPackages: true, commands: [["lint"], ["build"]] },
  { name: "mfe", projectName: "mfe-platform", useLocalPackages: false, commands: [["lint"], ["build"]] },
  {
    name: "mfe-main",
    projectName: "mfe-main-platform",
    useLocalPackages: false,
    commands: [["lint"], ["format:check"], ["test"], ["build"], ["test:e2e"]],
    devSmoke: { command: ["dev"], url: "http://127.0.0.1:7200/" },
    deployment: {
      appDirectory: "apps/main",
      defaultMfeAppEntry: "//127.0.0.1:7201",
      defaultPort: 7200,
      dockerSmokePort: 17200,
      smokePaths: ["/login", "/apps/mfe-app"],
      expectCors: false
    }
  },
  {
    name: "mfe-app",
    projectName: "mfe-business-app",
    useLocalPackages: false,
    commands: [["lint"], ["format:check"], ["test"], ["build"], ["test:e2e"]],
    devSmoke: { command: ["dev"], url: "http://127.0.0.1:7201/" },
    deployment: {
      appDirectory: "apps/app",
      defaultMfeAppEntry: "//localhost:7201",
      defaultPort: 7201,
      dockerSmokePort: 17201,
      smokePaths: ["/", "/about"],
      expectCors: true
    }
  }
];
const tempRoot = join(repoRoot, "tmp", "validate-generated-apps");
const generatedProjectRoots = new Map();
const shouldValidateDockerRuntime = process.env.MFE_VALIDATE_DOCKER === "true";

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  for (const template of appTemplates) {
    const projectRoot = join(tempRoot, template.projectName);

    await runNode(cliEntry, ["init", template.projectName, "--template", template.name, "--local", "--cwd", tempRoot]);
    generatedProjectRoots.set(template.name, projectRoot);
    if (template.useLocalPackages) {
      await useLocalPackages(projectRoot);
    }
    await runPnpm(["install"], projectRoot);
    for (const command of template.commands) {
      await runPnpm(command, projectRoot);
    }
    if (template.devSmoke) {
      await runDevSmoke(template, projectRoot);
    }
    if (template.deployment) {
      await validateMfeDeploymentFiles(template, projectRoot);
      if (shouldValidateDockerRuntime) {
        await runDockerDeploymentValidation(template, projectRoot);
      }
    }
    process.stdout.write(`Validated generated ${template.name} app at ${projectRoot}\n`);
  }

  await runMfeIntegrationE2e(generatedProjectRoots);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function useLocalPackages(projectRoot) {
  const packageJsonPath = join(projectRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@tsuz/components": `file:${join(repoRoot, "components")}`,
    "@tsuz/utils": `file:${join(repoRoot, "utils")}`,
    "@tsuz/sdk": `file:${join(repoRoot, "sdk")}`
  };

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

async function runNode(entry, args) {
  await execFileAsync(process.execPath, [entry, ...args], {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024
  });
}

async function runPnpm(args, cwd, envOverrides = {}) {
  const env = createProcessEnv(envOverrides);

  if (process.env.npm_execpath) {
    await execFileAsync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      env,
      maxBuffer: 20 * 1024 * 1024
    });
    return;
  }

  await execFileAsync(resolvePnpmCommand(), args, {
    cwd,
    env,
    maxBuffer: 20 * 1024 * 1024
  });
}

async function runDevSmoke(template, projectRoot) {
  const server = await startDevServer(template.name, template.devSmoke.command, projectRoot, template.devSmoke.url);

  try {
    return;
  } finally {
    await stopProcess(server.child);
  }
}

async function validateMfeDeploymentFiles(template, projectRoot) {
  const { deployment } = template;
  const dockerfile = await readRequiredFile(projectRoot, "Dockerfile");
  const nginxConfig = await readRequiredFile(projectRoot, "nginx/nginx.conf");
  const compose = await readRequiredFile(projectRoot, "docker-compose.yml");
  const deployEnv = await readRequiredFile(projectRoot, ".env.deploy.example");
  const dockerignore = await readRequiredFile(projectRoot, ".dockerignore");
  const ciWorkflow = await readRequiredFile(projectRoot, ".github/workflows/ci.yml");
  const deployWorkflow = await readRequiredFile(projectRoot, ".github/workflows/deploy.yml");
  const readme = await readRequiredFile(projectRoot, "README.md");
  const packageJson = await readRequiredFile(projectRoot, "package.json");
  const appEnv = await readRequiredFile(projectRoot, `${deployment.appDirectory}/.env.example`);
  const viteEnv = await readRequiredFile(projectRoot, `${deployment.appDirectory}/src/vite-env.d.ts`);

  assertIncludes(dockerfile, "FROM node:20-alpine AS build", "Dockerfile");
  assertIncludes(dockerfile, "FROM nginx:1.27-alpine", "Dockerfile");
  assertIncludes(dockerfile, "ARG VITE_API_BASE_URL=/api", "Dockerfile");
  assertIncludes(dockerfile, "ARG VITE_MFE_APP_ENTRY=", "Dockerfile");
  assertIncludes(dockerfile, "ARG VITE_APP_ENV=production", "Dockerfile");
  assertIncludes(dockerfile, `COPY --from=build /app/${deployment.appDirectory}/dist /usr/share/nginx/html`, "Dockerfile");

  assertIncludes(nginxConfig, "try_files $uri $uri/ /index.html", "nginx/nginx.conf");
  assertIncludes(nginxConfig, "Cache-Control \"no-store, no-cache, must-revalidate\"", "nginx/nginx.conf");
  assertIncludes(nginxConfig, "Cache-Control \"public, immutable\"", "nginx/nginx.conf");
  if (deployment.expectCors) {
    assertIncludes(nginxConfig, "Access-Control-Allow-Origin \"*\"", "nginx/nginx.conf");
    assertIncludes(nginxConfig, "Access-Control-Allow-Methods \"GET, HEAD, OPTIONS\"", "nginx/nginx.conf");
  }

  assertIncludes(compose, "services:", "docker-compose.yml");
  assertIncludes(compose, "${DOCKER_IMAGE_NAME:-", "docker-compose.yml");
  assertIncludes(compose, "${APP_VERSION:-local}", "docker-compose.yml");
  assertIncludes(compose, "${CONTAINER_NAME:-", "docker-compose.yml");
  assertIncludes(compose, `"\${APP_PORT:-${deployment.defaultPort}}:80"`, "docker-compose.yml");
  assertIncludes(compose, "${APP_ENV:-local}", "docker-compose.yml");
  assertIncludes(compose, "VITE_API_BASE_URL", "docker-compose.yml");
  assertIncludes(compose, "VITE_MFE_APP_ENTRY", "docker-compose.yml");
  assertIncludes(compose, "VITE_APP_ENV: ${APP_ENV:-local}", "docker-compose.yml");

  assertIncludes(deployEnv, "DOCKER_IMAGE_NAME=", ".env.deploy.example");
  assertIncludes(deployEnv, "APP_VERSION=local", ".env.deploy.example");
  assertIncludes(deployEnv, `APP_PORT=${deployment.defaultPort}`, ".env.deploy.example");
  assertIncludes(deployEnv, "APP_ENV=local", ".env.deploy.example");
  assertIncludes(deployEnv, "VITE_API_BASE_URL=/api", ".env.deploy.example");
  assertIncludes(deployEnv, "VITE_MFE_APP_ENTRY=", ".env.deploy.example");

  assertIncludes(dockerignore, "apps/*/dist", ".dockerignore");
  assertIncludes(dockerignore, "!.env.deploy.example", ".dockerignore");
  assertIncludes(packageJson, '"docker:build"', "package.json");
  assertIncludes(packageJson, '"compose:up"', "package.json");
  assertIncludes(packageJson, '"format:check"', "package.json");
  assertIncludes(packageJson, ".github/workflows/deploy.yml", "package.json");
  assertIncludes(ciWorkflow, "name: CI", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pull_request:", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "push:", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "- main", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "- master", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "actions/checkout@v4", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm/action-setup@v4", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "version: 8.15.9", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "actions/setup-node@v4", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "node-version: 20", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "cache: pnpm", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm install --frozen-lockfile", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm lint", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm format:check", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm test", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm build", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm exec playwright install --with-deps chromium", ".github/workflows/ci.yml");
  assertIncludes(ciWorkflow, "pnpm test:e2e", ".github/workflows/ci.yml");

  assertIncludes(deployWorkflow, "name: Deploy", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "test-v*.*.*", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "product-v*.*.*", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "workflow_dispatch", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "environment", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "image_tag", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "version", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "should_build", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "packages: write", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "docker build", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "docker push", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "DOCKER_REGISTRY_TOKEN", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "SSH_PRIVATE_KEY", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "VITE_API_BASE_URL", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "VITE_MFE_APP_ENTRY", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "VITE_APP_ENV", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "docker-compose.yml", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "scp", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "ssh", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "docker compose --env-file .env -f docker-compose.yml pull app", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "docker compose --env-file .env -f docker-compose.yml up -d --no-build app", ".github/workflows/deploy.yml");
  assertIncludes(deployWorkflow, "Refusing to deploy a latest tag", ".github/workflows/deploy.yml");

  if (template.name === "mfe-app") {
    const prettierConfig = await readRequiredFile(projectRoot, "prettier.config.js");
    const prettierIgnore = await readRequiredFile(projectRoot, ".prettierignore");
    assertIncludes(packageJson, '"prettier"', "package.json");
    assertIncludes(prettierConfig, "printWidth", "prettier.config.js");
    assertIncludes(prettierIgnore, "apps/*/dist", ".prettierignore");
  }
  assertIncludes(appEnv, "VITE_APP_ENV=local", `${deployment.appDirectory}/.env.example`);
  assertIncludes(viteEnv, "VITE_APP_ENV", `${deployment.appDirectory}/src/vite-env.d.ts`);
  assertIncludes(readme, "Docker and nginx", "README.md");
  assertIncludes(readme, "Docker Compose", "README.md");
  assertIncludes(readme, "GitHub Actions Deploy", "README.md");
  assertIncludes(readme, "test-v*.*.*", "README.md");
  assertIncludes(readme, "product-v*.*.*", "README.md");
  assertIncludes(readme, "workflow_dispatch", "README.md");
  assertIncludes(readme, "image_tag", "README.md");
  assertIncludes(readme, "docker compose up -d --no-build", "README.md");
  assertIncludes(readme, "VITE_APP_ENV", "README.md");

  process.stdout.write(`Validated generated ${template.name} Docker/nginx/compose and CI/deploy workflow files\n`);
}

async function runDockerDeploymentValidation(template, projectRoot) {
  const { deployment } = template;
  const imageName = `tsu-validate-${template.projectName}`;
  const imageTag = "phase7";
  const image = `${imageName}:${imageTag}`;
  const runContainerName = `${imageName}-run-${process.pid}`;
  const composeContainerName = `${imageName}-compose-${process.pid}`;
  const dockerEnv = createDockerValidationEnv(template, imageName, imageTag, composeContainerName);

  await runDocker(
    [
      "build",
      "-t",
      image,
      "--build-arg",
      "VITE_API_BASE_URL=/api",
      "--build-arg",
      `VITE_MFE_APP_ENTRY=${deployment.defaultMfeAppEntry}`,
      "--build-arg",
      "VITE_APP_ENV=test",
      "."
    ],
    projectRoot
  );

  try {
    await runDocker(["run", "-d", "--name", runContainerName, "-p", `${deployment.dockerSmokePort}:80`, image], projectRoot);
    await waitForDeploymentUrls(deployment.dockerSmokePort, deployment.smokePaths);
  } finally {
    await runDocker(["rm", "-f", runContainerName], projectRoot).catch(() => undefined);
  }

  await runDocker(["compose", "config"], projectRoot, dockerEnv);

  try {
    await runDocker(["compose", "up", "-d", "--build"], projectRoot, dockerEnv);
    await waitForDeploymentUrls(deployment.dockerSmokePort, deployment.smokePaths);
  } finally {
    await runDocker(["compose", "down", "--remove-orphans"], projectRoot, dockerEnv).catch(() => undefined);
  }

  process.stdout.write(`Validated generated ${template.name} Docker runtime and compose smoke checks\n`);
}

async function runMfeIntegrationE2e(projectRoots) {
  const mainProjectRoot = projectRoots.get("mfe-main");
  const appProjectRoot = projectRoots.get("mfe-app");

  if (!mainProjectRoot || !appProjectRoot) {
    return;
  }

  let appServer;
  let mainServer;

  try {
    appServer = await startDevServer("mfe-app integration", ["dev"], appProjectRoot, "http://127.0.0.1:7201/");
    mainServer = await startDevServer("mfe-main integration", ["dev"], mainProjectRoot, "http://127.0.0.1:7200/login", {
      VITE_MFE_APP_ENTRY: "//127.0.0.1:7201"
    });

    await runPnpm(["exec", "playwright", "test", "e2e/host-load-subapp.spec.ts"], mainProjectRoot, {
      MFE_INTEGRATION_E2E: "true"
    });
    process.stdout.write("Validated integrated mfe-main + mfe-app E2E flow\n");
  } finally {
    if (mainServer) {
      await stopProcess(mainServer.child);
    }
    if (appServer) {
      await stopProcess(appServer.child);
    }
  }
}

async function startDevServer(name, args, cwd, url, envOverrides = {}) {
  const child = spawnPnpm(args, cwd, envOverrides);
  let output = "";

  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHttp(url, 60_000);
    return { child };
  } catch (error) {
    await stopProcess(child);
    throw new Error(`Dev server failed for ${name}: ${error.message}\n${output}`);
  }
}

function spawnPnpm(args, cwd, envOverrides = {}) {
  const env = createProcessEnv(envOverrides);

  if (process.env.npm_execpath) {
    return spawn(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
  }

  return spawn(resolvePnpmCommand(), args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function runDocker(args, cwd, envOverrides = {}) {
  await execFileAsync("docker", args, {
    cwd,
    env: createProcessEnv(envOverrides),
    maxBuffer: 20 * 1024 * 1024
  });
}

async function waitForDeploymentUrls(port, paths) {
  for (const path of paths) {
    await waitForHttp(`http://127.0.0.1:${port}${path}`, 60_000);
  }
}

async function readRequiredFile(projectRoot, relativePath) {
  try {
    return await readFile(join(projectRoot, relativePath), "utf8");
  } catch (error) {
    throw new Error(`Missing generated file ${relativePath}: ${error.message}`);
  }
}

function assertIncludes(content, marker, filePath) {
  if (!content.includes(marker)) {
    throw new Error(`${filePath} is missing required marker: ${marker}`);
  }
}

function createDockerValidationEnv(template, imageName, imageTag, containerName) {
  return {
    COMPOSE_PROJECT_NAME: `tsu-validate-${template.projectName}-${process.pid}`,
    DOCKER_IMAGE_NAME: imageName,
    APP_VERSION: imageTag,
    CONTAINER_NAME: containerName,
    APP_PORT: String(template.deployment.dockerSmokePort),
    APP_ENV: "test",
    VITE_API_BASE_URL: "/api",
    VITE_MFE_APP_ENTRY: template.deployment.defaultMfeAppEntry
  };
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.status >= 200 && response.status < 400) {
        await response.body?.cancel();
        return;
      }

      lastError = new Error(`Unexpected HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/pid", String(child.pid), "/T", "/F"]).catch(() => undefined);
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(2_000).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    })
  ]);
}

function createProcessEnv(envOverrides = {}) {
  return { ...process.env, ...envOverrides };
}

function resolvePnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
