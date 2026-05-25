#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createTemplateFiles, renderTemplateFiles, type TemplateFile } from "@tsu/template";

const execFileAsync = promisify(execFile);
const templateAssetNamePattern = /^tsu-templates-v(.+)\.tar\.gz$/;

export interface InitProjectOptions {
  cwd: string;
  projectName: string;
  templateName?: string;
  version?: string;
  force?: boolean;
  source?: TemplateSource;
  repository?: string;
}

export type TemplateSource = "remote" | "local";

export interface ParsedInitOptions extends Required<Pick<InitProjectOptions, "cwd" | "projectName" | "templateName" | "version" | "force" | "source">> {
  repository?: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface RemoteTemplateManifest {
  version: string;
  templates: string[];
}

export function createCliMessage(templatePackage = "@tsu/template") {
  return `tsu-cli is ready to pull ${templatePackage}`;
}

export function parseInitArgs(args: string[], cwd = process.cwd()): ParsedInitOptions {
  let projectName = "quick-start-app";
  let templateName = "default";
  let version = "latest";
  let targetCwd = cwd;
  let source: TemplateSource = "remote";
  let repository = process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu";
  let force = false;
  let hasProjectName = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force" || arg === "-f") {
      force = true;
      continue;
    }

    if (arg === "--local") {
      source = "local";
      continue;
    }

    if (arg === "--template" || arg === "-t") {
      templateName = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      version = normalizeTemplateVersion(readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--repo") {
      repository = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--cwd") {
      targetCwd = resolve(cwd, readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (hasProjectName) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    projectName = arg;
    hasProjectName = true;
  }

  return {
    cwd: targetCwd,
    projectName,
    templateName,
    version,
    force,
    source,
    repository
  };
}

export async function initProject(options: InitProjectOptions) {
  const targetDir = join(options.cwd, options.projectName);
  const files = await resolveTemplateFiles(options);

  if (options.force) {
    await rm(targetDir, { force: true, recursive: true });
    await mkdir(targetDir, { recursive: true });
  } else {
    await mkdir(dirname(targetDir), { recursive: true });
    await createProjectDirectory(targetDir);
  }

  for (const file of files) {
    const filePath = join(targetDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, "utf8");
  }

  return {
    targetDir,
    files: files.map((file) => file.path)
  };
}

export async function runCli(args: string[], cwd = process.cwd()) {
  const [command, ...commandArgs] = args;

  if (command === "init") {
    const options = parseInitArgs(commandArgs, cwd);
    const result = await initProject(options);
    return `Created ${options.projectName} from ${options.templateName}@${options.version} at ${result.targetDir}`;
  }

  return createCliMessage();
}

export function normalizeTemplateVersion(version: string) {
  return version === "latest" ? "latest" : version.replace(/^v/, "");
}

export function getReleaseTag(version: string) {
  return normalizeTemplateVersion(version) === "latest" ? "latest" : `template-v${normalizeTemplateVersion(version)}`;
}

export function findTemplateAsset(release: GitHubRelease) {
  const asset = release.assets.find((item) => templateAssetNamePattern.test(item.name));

  if (!asset) {
    throw new Error(`No tsu template asset found in GitHub Release ${release.tag_name}.`);
  }

  return asset;
}

async function resolveTemplateFiles(options: InitProjectOptions) {
  if (options.source === "local") {
    return createTemplateFiles({ projectName: options.projectName, templateName: options.templateName });
  }

  try {
    return await downloadTemplateFiles(options);
  } catch (error: unknown) {
    if (options.repository) {
      throw error;
    }

    return createTemplateFiles({ projectName: options.projectName, templateName: options.templateName });
  }
}

async function downloadTemplateFiles(options: InitProjectOptions): Promise<TemplateFile[]> {
  if (!options.repository) {
    throw new Error("Missing GitHub repository. Set TSU_TEMPLATE_REPOSITORY or GITHUB_REPOSITORY, or pass --repo owner/name.");
  }

  const release = await fetchGitHubRelease(options.repository, options.version ?? "latest");
  const asset = findTemplateAsset(release);
  const tempDir = await mkdtemp(join(tmpdir(), "tsu-template-"));

  try {
    const archivePath = join(tempDir, asset.name);
    await downloadFile(asset.browser_download_url, archivePath);
    await extractTarball(archivePath, tempDir);

    const bundleDir = join(tempDir, asset.name.replace(/\.tar\.gz$/, ""));
    const manifest = JSON.parse(await readFile(join(bundleDir, "manifest.json"), "utf8")) as RemoteTemplateManifest;
    const templateName = options.templateName ?? "default";

    if (!manifest.templates.includes(templateName)) {
      throw new Error(`Template "${templateName}" is not available in ${asset.name}. Available templates: ${manifest.templates.join(", ")}.`);
    }

    const templateDir = join(bundleDir, templateName);
    const stagingDir = join(tempDir, "rendered");
    await cp(templateDir, stagingDir, { recursive: true });

    return renderTemplateFiles(await readTemplateDirectory(stagingDir), options.projectName);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function fetchGitHubRelease(repository: string, version: string): Promise<GitHubRelease> {
  const releasePath = getReleaseTag(version) === "latest" ? "latest" : `tags/${getReleaseTag(version)}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/${releasePath}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "tsu-cli"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve GitHub Release ${releasePath}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GitHubRelease;
}

async function downloadFile(url: string, destination: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": "tsu-cli"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download template asset: ${response.status} ${response.statusText}`);
  }

  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
}

async function extractTarball(archivePath: string, destination: string) {
  await execFileAsync("tar", ["-xzf", basename(archivePath), "-C", "."], {
    cwd: destination,
    maxBuffer: 10 * 1024 * 1024
  });
}

async function readTemplateDirectory(root: string): Promise<TemplateFile[]> {
  const files: TemplateFile[] = [];
  await collectTemplateFiles(root, root, files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function collectTemplateFiles(root: string, directory: string, files: TemplateFile[]) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectTemplateFiles(root, fullPath, files);
      continue;
    }

    files.push({
      path: fullPath.slice(root.length + 1).replaceAll("\\", "/"),
      content: await readFile(fullPath, "utf8")
    });
  }
}

function readOptionValue(args: string[], index: number, option: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

async function createProjectDirectory(targetDir: string) {
  try {
    await mkdir(targetDir);
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(`Target directory already exists: ${targetDir}. Use --force to overwrite.`);
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  runCli(process.argv.slice(2))
    .then((message) => {
      console.log(message);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
