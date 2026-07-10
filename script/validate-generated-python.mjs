import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "cli", "dist", "index.js");
const tempRoot = join(repoRoot, "tmp", "validate-generated-python");
const redisUrl = process.env.REDIS_URL;
const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+Z6emQGbqLphz
OdHE4MhNdafo4XUxkRYob7UbDFW8/nT+pbLjjh5gxIefoRDxeqYhWgz1hBf3Vv27
AV2Ug6E8Vgts+iLkBUfd5J6LTVSxbu1xMHo66pqborFcyJcXDfJh2Kaz/HsXLwFG
m42wx4pNUvMSP72KIjexlpvbfG3GwVO610Nhz1RSyHcrOyzeDMOOU6FYKGynUk9B
g5tPItGLbOs2A6bCd03bLQddv60Quv1Cbqx9e1RabPa003Bks1uBT/OjD1LFD1CZ
4WIHyiPJbNc+PwG8raaVk6lie1AX+z5BGaz9O4LWgLR32GKLu2ezPw7nm5c6tIge
qFHgSoJHAgMBAAECggEBAJf6tte9+iecj7URhr2mSluBuUfqhhfNXilimOWBIAKd
/Raxfiuiad8Fn9erwZFuO6LNdSCXkmWr+xVEjsSXmKBHchFHS4hEKswTyvUYAa0r
BL3fWwEh98yYvQd5WRhe2oR9YPqzYjDsJRGN4jgj3eHAfyKm3AyhKWFH/RnhpOIK
VwhJqaGItTidthUJbFIYIuuZ5Vjohj6gGd4WooyQsQaiELCa1nzZzuMSmLJfUgp+
7QkOWW4BUZvESO/vEJcrcXpczkOsQqq2u78oOtsMxvXExFDlu8kDWvXquvkEajVj
a8SlHS/B13EsS5XqsWnwBawL0mp161IMAwro8cV7z6ECgYEA7RmmSDfD+2+6RBh5
L+KIQ+jymUDTGHJF0DGCRVOePmQDgzzj4n4+B47RpYu9LOxnBDehOgbW4ji+6oo/
leQf5I95Hj6PloDb2Pm7h2/RGhB7El5sv6hRjSRDjxdHAs9aFsFuFIG1oD20sxbG
EcQdpaa8qW2/K4D3oyD+tk8mHtcCgYEAzZUf6/QMnaw3PY6aV3ss2vc72APs02gG
otNW0BoCkCIEsKNVQquR2VLS/2kxsISiKJmuJhqHBrFGRpjp0MqyjoTkUBy9DZyF
xOO6AQr9J1PKbWOriPPxRwgyBqG100CvDAtLzhhFgtHwM4Ai1d5hToP4Pe7DPkRh
+hVkhfpwehECgYABZmxf8sxaeL9t1YMpsDnDxOVh2Esm0s3su84cILFHhwmqRbrG
xJ4TJ1m/k4KreD3nfXibQh0UuucNtYFInk8950b80bvBVMN3lYnw880VTVGcuygD
Pbg1kChB+Q43SwgqKDxBLL7o0lR11kWXJ0RRjRmCGp7NX/aWZQR8CR2dgwKBgFjS
NC+CiqzYyikbYo2nVzLnnIBw+bJBAJT60Egq5K6XNAWJG/4pGGOXyDe3oFNOiq0V
8MrfrTT0BJPd3y9pVAoFWotOT1QBKz5s0WE/+S4zooLujB8onjb9UHfTCDbUfIys
mLzbebTStX/avbI/WTVOCUPg05QkgVxGP98u28exAoGBAIu0+fCIYoy07yEmomhk
+HqsmDOq9mnC9H5y8xZ1z55SMqWoqc91e8HSsKmdQL0htcOHErjAGvlCRGP9vP1B
cifihzNMBiRtXx/XfG4UN5mmF5rJgdNvQPXuFhETyZ2E95f2ks3OZnYR0Ft1ejbZ
TZYO7jMxHqi6RD0PlREnq6CJ
-----END PRIVATE KEY-----`;
const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvmenpkBm6i6YcznRxODI
TXWn6OF1MZEWKG+1GwxVvP50/qWy444eYMSHn6EQ8XqmIVoM9YQX91b9uwFdlIOh
PFYLbPoi5AVH3eSei01UsW7tcTB6Ouqam6KxXMiXFw3yYdims/x7Fy8BRpuNsMeK
TVLzEj+9iiI3sZab23xtxsFTutdDYc9UUsh3Kzss3gzDjlOhWChsp1JPQYObTyLR
i2zrNgOmwndN2y0HXb+tELr9Qm6sfXtUWmz2tNNwZLNbgU/zow9SxQ9QmeFiB8oj
yWzXPj8BvK2mlZOpYntQF/s+QRms/TuC1oC0d9hii7tnsz8O55uXOrSIHqhR4EqC
RwIDAQAB
-----END PUBLIC KEY-----`;

if (!redisUrl) {
  throw new Error("REDIS_URL is required for python-main/python-app cross-service validation, for example REDIS_URL=redis://localhost:6379/15 pnpm validate:generated-python.");
}
await ensureRedisReachable(redisUrl);

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const authRoot = join(tempRoot, "auth-service");
  const appRoot = join(tempRoot, "backend-api");
  const prefix = `auth:validate:${process.pid}:`;
  const sharedEnv = {
    ...process.env,
    REDIS_URL: redisUrl,
    JWT_ISSUER: "auth-service-test",
    JWT_AUDIENCE: "backend-api-test",
    JWT_PUBLIC_KEY: testPublicKey,
    TOKEN_BLACKLIST_PREFIX: `${prefix}blacklist:jti:`,
    SESSION_PREFIX: `${prefix}session:`,
    LOG_FORMAT: "json",
    LOG_LEVEL: "info"
  };
  const authEnv = {
    ...sharedEnv,
    DATABASE_URL: "sqlite+pysqlite:///verify.db",
    JWT_PRIVATE_KEY: testPrivateKey,
    REFRESH_TOKEN_PREFIX: `${prefix}refresh:`
  };
  const appEnv = {
    ...sharedEnv,
    DATABASE_URL: "sqlite+pysqlite:///verify.db"
  };

  await runNode(cliEntry, ["init", "auth-service", "--template", "python-main", "--local", "--cwd", tempRoot]);
  await runNode(cliEntry, ["init", "backend-api", "--template", "python-app", "--local", "--cwd", tempRoot]);

  await validateDeployArtifacts(authRoot, true);
  await validateDeployArtifacts(appRoot, false);
  await validateProject(authRoot, authEnv);
  await validateProject(appRoot, appEnv);
  await validateCrossService(authRoot, appRoot, authEnv, appEnv);

  process.stdout.write(`Validated generated Python templates at ${tempRoot}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function validateDeployArtifacts(projectRoot, includePrivateKey) {
  const readme = await readFile(join(projectRoot, "README.md"), "utf8");
  const workflow = await readFile(join(projectRoot, ".github", "workflows", "deploy.yml"), "utf8");
  const deployCompose = await readFile(join(projectRoot, "docker-compose.deploy.yml"), "utf8");
  const infraCompose = await readFile(join(projectRoot, "docker-compose.infra.yml"), "utf8");
  const envDeploy = await readFile(join(projectRoot, ".env.deploy.example"), "utf8");

  assertIncludes(workflow, [
    "name: Deploy",
    "test-v*.*.*",
    "product-v*.*.*",
    "workflow_dispatch:",
    "image_tag",
    "should_build",
    "docker build",
    "docker push",
    "DOCKER_REGISTRY_TOKEN",
    "SSH_PRIVATE_KEY",
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_PUBLIC_KEY",
    "docker compose --env-file .env -f docker-compose.deploy.yml pull api",
    "docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-build api nginx",
    "Refusing to deploy a latest tag"
  ]);
  assertIncludes(deployCompose, ["${DOCKER_IMAGE_NAME}:${APP_VERSION}", "api:", "nginx:", "/health", "external: true", "DOCKER_NETWORK_NAME"]);
  assertIncludes(infraCompose, ["postgres:16-alpine", "redis:7-alpine", "postgres_data", "redis_data", "appendonly yes", "DOCKER_NETWORK_NAME"]);
  assertIncludes(envDeploy, ["DOCKER_IMAGE_NAME", "APP_VERSION", "DATABASE_URL", "REDIS_URL", "JWT_PUBLIC_KEY", "TOKEN_BLACKLIST_PREFIX", "SESSION_PREFIX"]);
  assertIncludes(readme, ["Release Deploy and Rollback", "Docker Infra", "Tag Release", "Rollback", "Migration Policy", "Seed Policy", "Product does not auto-run seed"]);

  const forbiddenWorkflowMarkers = ["docker-compose.infra.yml", "pdm run migrate", "alembic upgrade", "pdm run seed", "python -m app.seed"];
  const workflowLeak = forbiddenWorkflowMarkers.find((marker) => workflow.includes(marker));
  if (workflowLeak) {
    throw new Error(`Deploy workflow unexpectedly contains ${workflowLeak}.`);
  }

  if (includePrivateKey) {
    assertIncludes(workflow, ["JWT_PRIVATE_KEY"]);
    assertIncludes(envDeploy, ["JWT_PRIVATE_KEY"]);
  } else if (workflow.includes("JWT_PRIVATE_KEY") || envDeploy.includes("JWT_PRIVATE_KEY")) {
    throw new Error("python-app deploy artifacts must not contain JWT_PRIVATE_KEY.");
  }
}

async function validateProject(projectRoot, env) {
  await runCommand("python3", ["-m", "compileall", "-q", "app", "tests"], projectRoot, env);
  await runCommand("uv", ["run", "--project", ".", "--group", "dev", "alembic", "upgrade", "head"], projectRoot, env);
  await runCommand("uv", ["run", "--project", ".", "--group", "dev", "python", "-m", "app.seed"], projectRoot, env);
  await runCommand("uv", ["run", "--project", ".", "--group", "dev", "python", "-m", "app.seed"], projectRoot, env);
  await runCommand("uv", ["run", "--project", ".", "--group", "dev", "ruff", "check", "."], projectRoot, env);
  await runCommand("uv", ["run", "--project", ".", "--group", "dev", "pytest", "tests"], projectRoot, env);
}

async function validateCrossService(authRoot, appRoot, authEnv, appEnv) {
  const authPort = await getFreePort();
  const appPort = await getFreePort();
  const authServer = startServer(authRoot, authEnv, authPort);
  const appServer = startServer(appRoot, appEnv, appPort);

  try {
    await waitForHealth(`http://127.0.0.1:${authPort}/health`);
    await waitForHealth(`http://127.0.0.1:${appPort}/health`);

    const loginResponse = await fetchJson(`http://127.0.0.1:${authPort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": "validate-login" },
      body: JSON.stringify({ username: "admin@example.com", password: "password123" })
    });
    assertStatus(loginResponse, 200, "login");
    assertRequestId(loginResponse, "validate-login", "login");
    const login = await loginResponse.json();

    const profileResponse = await fetchJson(`http://127.0.0.1:${appPort}/api/profile`, {
      headers: { Authorization: `Bearer ${login.access_token}`, "X-Request-ID": "validate-profile" }
    });
    assertStatus(profileResponse, 200, "profile before logout");
    assertRequestId(profileResponse, "validate-profile", "profile before logout");

    const logoutResponse = await fetchJson(`http://127.0.0.1:${authPort}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${login.access_token}`, "X-Request-ID": "validate-logout" }
    });
    assertStatus(logoutResponse, 200, "logout");
    assertRequestId(logoutResponse, "validate-logout", "logout");

    const rejectedProfileResponse = await fetchJson(`http://127.0.0.1:${appPort}/api/profile`, {
      headers: { Authorization: `Bearer ${login.access_token}`, "X-Request-ID": "validate-profile-revoked" }
    });
    assertStatus(rejectedProfileResponse, 401, "profile after logout");
    assertRequestId(rejectedProfileResponse, "validate-profile-revoked", "profile after logout");

    await stopServer(authServer);
    await stopServer(appServer);

    const logs = `${authServer.output.join("")}\n${appServer.output.join("")}`;
    const forbidden = ["password123", login.access_token, login.refresh_token, testPrivateKey.split("\n")[1]];
    const leaked = forbidden.filter((value) => value && logs.includes(value));
    if (leaked.length > 0) {
      throw new Error("Cross-service validation logs leaked sensitive material.");
    }
  } finally {
    await Promise.allSettled([stopServer(authServer), stopServer(appServer)]);
  }
}

function startServer(projectRoot, env, port) {
  const child = spawn(
    "uv",
    ["run", "--project", ".", "--group", "dev", "python", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: projectRoot, env, stdio: ["ignore", "pipe", "pipe"] }
  );
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  return { child, output };
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null || server.child.signalCode !== null) {
    return;
  }
  server.child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (server.child.exitCode === null && server.child.signalCode === null) {
        server.child.kill("SIGKILL");
      }
      resolve();
    }, 5000);
    server.child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForHealth(url) {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers: { "X-Request-ID": "validate-health" } });
      if (response.ok) {
        return;
      }
      lastError = new Error(`Health check ${url} returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}.`);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  await response.clone().text();
  return response;
}

function assertStatus(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(`${label} expected HTTP ${expected}, got ${response.status}.`);
  }
}

function assertRequestId(response, expected, label) {
  const actual = response.headers.get("X-Request-ID");
  if (actual !== expected) {
    throw new Error(`${label} expected X-Request-ID ${expected}, got ${actual}.`);
  }
}

async function ensureRedisReachable(url) {
  const redis = new URL(url);
  const port = Number(redis.port || 6379);
  await new Promise((resolve, reject) => {
    const socket = createConnection({ host: redis.hostname, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Cannot connect to Redis at ${redis.hostname}:${port}. Start Redis or set REDIS_URL to a reachable instance before running validate:generated-python.`));
    }, 3000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      const reason = error.code ?? error.message ?? "connection failed";
      reject(new Error(`Cannot connect to Redis at ${redis.hostname}:${port}: ${reason}. Start Redis or set REDIS_URL to a reachable instance before running validate:generated-python.`));
    });
  });
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function assertIncludes(content, markers) {
  const missingMarkers = markers.filter((marker) => !content.includes(marker));
  if (missingMarkers.length > 0) {
    throw new Error(`Generated Python deploy artifact is missing required markers: ${missingMarkers.join(", ")}.`);
  }
}

async function runNode(entry, args) {
  await runCommand(process.execPath, [entry, ...args], repoRoot, process.env);
}

async function runCommand(command, args, cwd, env) {
  await execFileAsync(command, args, {
    cwd,
    env,
    maxBuffer: 50 * 1024 * 1024
  });
}
