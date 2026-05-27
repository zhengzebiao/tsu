import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readVersion();
const tag = `template-v${version}`;
const archivePath = join(repoRoot, "dist", "template-release", `tsu-templates-v${version}.tar.gz`);
const repository = await readRepository();
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  throw new Error("Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN.");
}

const assetName = `tsu-templates-v${version}.tar.gz`;
const release = await ensureRelease(repository, tag, token);
await replaceReleaseAsset(release, assetName, archivePath, token);
process.stdout.write(`Published ${archivePath} to GitHub Release ${tag}\n`);

function readVersion() {
  const versionArg = process.argv.find((arg) => arg.startsWith("--version="));
  const value = versionArg?.slice("--version=".length) ?? process.env.TEMPLATE_VERSION;

  if (!value) {
    throw new Error("Missing template release version. Use --version=<version> or TEMPLATE_VERSION.");
  }

  return value.replace(/^v/, "");
}

async function readRepository() {
  const configured = process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY;

  if (configured) {
    return parseRepository(configured);
  }

  const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024
  });

  return parseRepository(stdout.trim());
}

function parseRepository(value) {
  const normalized = value
    .replace(/^git@github\.com:/, "")
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .trim();
  const [owner, repo] = normalized.split("/");

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository: ${value}. Expected owner/name or a GitHub remote.`);
  }

  return { owner, repo };
}

async function ensureRelease(repositoryInfo, tagName, authToken) {
  const releaseFile = join(repoRoot, "dist", "template-release", `${tagName}.json`);
  const release = await getReleaseByTag(repositoryInfo, tagName, authToken).catch(async (error) => {
    if (error instanceof ResponseError && error.status === 404) {
      return createRelease(repositoryInfo, tagName, authToken);
    }

    throw error;
  });

  await writeFile(releaseFile, `${JSON.stringify({ tag: tagName, archive: archivePath }, null, 2)}\n`, "utf8");
  return release;
}

async function getReleaseByTag(repositoryInfo, tagName, authToken) {
  return requestJson(`https://api.github.com/repos/${repositoryInfo.owner}/${repositoryInfo.repo}/releases/tags/${encodeURIComponent(tagName)}`, {
    headers: authHeaders(authToken)
  });
}

async function createRelease(repositoryInfo, tagName, authToken) {
  return requestJson(`https://api.github.com/repos/${repositoryInfo.owner}/${repositoryInfo.repo}/releases`, {
    method: "POST",
    headers: {
      ...authHeaders(authToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tag_name: tagName,
      name: tagName,
      body: `Template release ${tagName}`,
      draft: false,
      prerelease: false,
      generate_release_notes: false
    })
  });
}

async function replaceReleaseAsset(release, assetName, filePath, authToken) {
  const existingAsset = release.assets?.find((asset) => asset.name === assetName);

  if (existingAsset) {
    await request(existingAsset.url, {
      method: "DELETE",
      headers: authHeaders(authToken)
    });
  }

  const uploadUrl = new URL(release.upload_url.replace(/\{\?name,label\}$/, ""));
  uploadUrl.searchParams.set("name", assetName);

  const content = await readFile(filePath);
  await request(uploadUrl.toString(), {
    method: "POST",
    headers: {
      ...authHeaders(authToken),
      "Content-Type": "application/octet-stream"
    },
    body: content
  });
}

function authHeaders(authToken) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${authToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tsu-cli"
  };
}

async function requestJson(url, init) {
  const response = await request(url, init);
  return response.json();
}

async function request(url, init) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new ResponseError(response.status, response.statusText, await response.text());
  }

  return response;
}

class ResponseError extends Error {
  constructor(status, statusText, body) {
    super(`GitHub API request failed: ${status} ${statusText}${body ? ` - ${body}` : ""}`);
    this.status = status;
  }
}
