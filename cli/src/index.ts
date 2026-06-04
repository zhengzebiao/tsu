#!/usr/bin/env node

import { execFile } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, realpathSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createTemplateFiles, renderTemplateFiles, templateDefinitions, templateNames, type TemplateFile, type TemplateName } from "./template.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const cliPackageJson = require("../package.json") as { version: string };
const cliVersion = cliPackageJson.version;
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

export interface GitHubRelease {
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface RemoteTemplateManifest {
  version: string;
  templates: Array<string | RemoteTemplateDefinition>;
}

export interface RemoteTemplateDefinition {
  name: string;
  description?: string;
  tags?: string[];
  recommendedFor?: string[];
  node?: string;
  packageManagers?: string[];
  nextSteps?: string[];
}

export interface TemplateInfoOptions {
  repository: string;
  templateName: string;
  version?: string;
}

export interface TemplateVersionsOptions {
  repository: string;
  templateName?: string;
}

export interface TemplateVersionInfo {
  version: string;
  tag: string;
  asset: string;
  assetUrl: string;
  templates?: string[];
}

export interface DoctorOptions {
  cwd: string;
}

export interface TemplateMetadata {
  template: {
    name: string;
    version: string;
    source: TemplateSource;
    repository?: string;
  };
}

export interface DoctorResult {
  cwd: string;
  projectName?: string;
  templateName?: string;
  templateVersion?: string;
  templateSource?: TemplateSource;
  templateRepository?: string;
  status: DoctorStatus;
  checks: DoctorCheck[];
  warnings: string[];
  nextSteps: string[];
}

export interface DoctorCheck {
  label: string;
  status: DoctorCheckStatus;
  details?: string;
}

export type DoctorStatus = "ok" | "warning" | "error";
export type DoctorCheckStatus = "pass" | "warn" | "fail";

export function createCliMessage() {
  return createHelpMessage();
}

export function createHelpMessage() {
  return [
    "Tsu CLI - create versioned frontend project templates.",
    "",
    "Usage:",
    "  tsu-cli init [project-name] [options]",
    "  tsu-cli doctor [--cwd <path>]",
    "  tsu-cli templates",
    "  tsu-cli template info <name> [--version <value>] [--repo <owner/repo>]",
    "  tsu-cli template versions [name] [--repo <owner/repo>]",
    "  tsu-cli --help",
    "  tsu-cli --version",
    "",
    "Commands:",
    "  init [project-name]    Create a project from a template",
    "  doctor                 Check a generated project",
    "  templates              List available templates",
    "  template info <name>   Show template details",
    "  template versions      List template release versions",
    "",
    "Init options:",
    "  -t, --template <name>  Template name: default, vue3, react, mfe, monorepo",
    "  -v, --version <value>  Template version, for example 1.0.3 or latest",
    "      --repo <owner/repo> Template release repository",
    "      --cwd <path>       Directory to create the project in",
    "      --local            Use bundled templates instead of GitHub releases",
    "  -f, --force           Overwrite the target directory",
    "",
    "Doctor options:",
    "      --cwd <path>       Project directory to check",
    "",
    "Examples:",
    "  tsu-cli init my-app --template vue3",
    "  tsu-cli doctor --cwd my-app",
    "  tsu-cli init my-app --template react --version 1.0.3",
    "  tsu-cli templates",
    "  tsu-cli template info vue3",
    "  tsu-cli template info vue3 --version 1.2.3",
    "  tsu-cli template versions vue3"
  ].join("\n");
}

export function createVersionMessage() {
  return cliVersion;
}

export function createTemplateListMessage() {
  const rows = templateDefinitions.map((template) => [template.name, template.description, template.recommendedFor.join(", ")] as const);
  const nameWidth = Math.max("Template".length, ...rows.map(([name]) => name.length));
  const descriptionWidth = Math.max("Description".length, ...rows.map(([, description]) => description.length));
  const header = `  ${"Template".padEnd(nameWidth)}  ${"Description".padEnd(descriptionWidth)}  Recommended for`;
  const divider = `  ${"-".repeat(nameWidth)}  ${"-".repeat(descriptionWidth)}  ${"-".repeat("Recommended for".length)}`;
  const lines = rows.map(([name, description, recommendedFor]) => `  ${name.padEnd(nameWidth)}  ${description.padEnd(descriptionWidth)}  ${recommendedFor}`);

  return ["Available templates:", header, divider, ...lines].join("\n");
}

export function createTemplateInfoMessage(templateName: string) {
  const definition = getTemplateDefinition(templateName);

  return [
    `Template: ${definition.name}`,
    `Description: ${definition.description}`,
    `Tags: ${definition.tags.join(", ")}`,
    `Recommended for: ${definition.recommendedFor.join(", ")}`,
    `Node: ${definition.node}`,
    `Package managers: ${definition.packageManagers.join(", ")}`,
    "",
    "Next steps:",
    ...definition.nextSteps.map((step) => `  ${step}`)
  ].join("\n");
}

export function createRemoteTemplateInfoMessage(options: Required<TemplateInfoOptions>, definition: RemoteTemplateDefinition) {
  const lines = [
    `Template: ${definition.name}`,
    `Version: ${options.version}`,
    `Repository: ${options.repository}`,
    `Description: ${definition.description ?? "Not provided"}`,
    `Tags: ${formatOptionalList(definition.tags)}`,
    `Recommended for: ${formatOptionalList(definition.recommendedFor)}`,
    `Node: ${definition.node ?? "Not provided"}`,
    `Package managers: ${formatOptionalList(definition.packageManagers)}`
  ];

  if (definition.nextSteps?.length) {
    lines.push("", "Next steps:", ...definition.nextSteps.map((step) => `  ${step}`));
  }

  return lines.join("\n");
}

export function createTemplateVersionsMessage(options: TemplateVersionsOptions, versions: TemplateVersionInfo[]) {
  const title = options.templateName
    ? `Available versions for template "${options.templateName}" from ${options.repository}:`
    : `Available template versions from ${options.repository}:`;

  if (versions.length === 0) {
    return [title, "  No template release assets found."].join("\n");
  }

  const rows = versions.map((version) => [version.version, version.tag, version.asset] as const);
  const versionWidth = Math.max("Version".length, ...rows.map(([version]) => version.length));
  const tagWidth = Math.max("Tag".length, ...rows.map(([, tag]) => tag.length));
  const assetWidth = Math.max("Asset".length, ...rows.map(([, , asset]) => asset.length));
  const header = `  ${"Version".padEnd(versionWidth)}  ${"Tag".padEnd(tagWidth)}  ${"Asset".padEnd(assetWidth)}`;
  const divider = `  ${"-".repeat(versionWidth)}  ${"-".repeat(tagWidth)}  ${"-".repeat(assetWidth)}`;
  const lines = rows.map(([version, tag, asset]) => `  ${version.padEnd(versionWidth)}  ${tag.padEnd(tagWidth)}  ${asset.padEnd(assetWidth)}`);

  return [title, header, divider, ...lines].join("\n");
}

export function createSuccessMessage(options: ParsedInitOptions, targetDir: string) {
  const definition = getTemplateDefinition(options.templateName);
  const nextSteps = [`cd ${options.projectName}`, ...definition.nextSteps];

  return [
    `Created ${options.projectName} from ${options.templateName}@${options.version}`,
    `Location: ${targetDir}`,
    "",
    "Next steps:",
    ...nextSteps.map((step) => `  ${step}`)
  ].join("\n");
}

export function createDoctorMessage(result: DoctorResult) {
  return [
    `Tsu doctor: ${result.status.toUpperCase()}`,
    `Project: ${result.cwd}`,
    ...(result.projectName ? [`Package: ${result.projectName}`] : []),
    ...(result.templateName ? [`Template: ${result.templateName}`] : []),
    ...(result.templateVersion ? [`Version: ${result.templateVersion}`] : []),
    ...(result.templateSource ? [`Source: ${result.templateSource}`] : []),
    ...(result.templateRepository ? [`Repository: ${result.templateRepository}`] : []),
    "",
    "Checks:",
    ...result.checks.map((check) => `  ${check.status.toUpperCase()} ${check.label}${check.details ? ` - ${check.details}` : ""}`),
    ...(result.warnings.length ? ["", "Warnings:", ...result.warnings.map((warning) => `  ${warning}`)] : []),
    ...(result.nextSteps.length ? ["", "Next steps:", ...result.nextSteps.map((step) => `  ${step}`)] : [])
  ].join("\n");
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

export function parseDoctorArgs(args: string[], cwd = process.cwd()): DoctorOptions {
  let targetCwd = cwd;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--cwd") {
      targetCwd = resolve(cwd, readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return { cwd: targetCwd };
}

export function parseTemplateInfoArgs(args: string[]): TemplateInfoOptions {
  const templateName = readCommandValue(args, 0, "template info");
  let repository = process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu";
  let version: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

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

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    repository,
    templateName,
    ...(version ? { version } : {})
  };
}

export function parseTemplateVersionsArgs(args: string[]): TemplateVersionsOptions {
  let repository = process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu";
  let templateName: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--repo") {
      repository = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (templateName) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    templateName = arg;
  }

  return {
    repository,
    ...(templateName ? { templateName } : {})
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

  const metadataPath = join(targetDir, ".tsu", "template.json");
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, createTemplateMetadata(options), "utf8");

  return {
    targetDir,
    files: [...files.map((file) => file.path), ".tsu/template.json"]
  };
}

export async function runCli(args: string[], cwd = process.cwd()) {
  const [command, ...commandArgs] = args;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    return createHelpMessage();
  }

  if (command === "--version") {
    return createVersionMessage();
  }

  if (command === "templates" || command === "list" || (command === "template" && commandArgs[0] === "list")) {
    return createTemplateListMessage();
  }

  if (command === "doctor") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      return createHelpMessage();
    }

    return createDoctorMessage(await doctorProject(parseDoctorArgs(commandArgs, cwd)));
  }

  if (command === "template" && commandArgs[0] === "info") {
    const options = parseTemplateInfoArgs(commandArgs.slice(1));

    if (!options.version) {
      return createTemplateInfoMessage(options.templateName);
    }

    const remoteOptions = { ...options, version: options.version };
    return createRemoteTemplateInfoMessage(remoteOptions, await resolveRemoteTemplateInfo(remoteOptions));
  }

  if (command === "template" && commandArgs[0] === "versions") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      return createHelpMessage();
    }

    const options = parseTemplateVersionsArgs(commandArgs.slice(1));
    return createTemplateVersionsMessage(options, await resolveTemplateVersions(options));
  }

  if (command === "init") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      return createHelpMessage();
    }

    const options = parseInitArgs(commandArgs, cwd);
    const result = await initProject(options);
    return createSuccessMessage(options, result.targetDir);
  }

  throw new Error(`Unknown command: ${command}. Run tsu-cli --help for usage.`);
}

export async function runInteractiveInit(cwd = process.cwd()) {
  const rl = createInterface({ input, output });

  try {
    const projectNameAnswer = await rl.question("Project name (quick-start-app): ");
    const templateNameAnswer = await rl.question(`Template (${templateNames.join("/")}) [default]: `);
    const projectName = projectNameAnswer.trim() || "quick-start-app";
    const templateName = (templateNameAnswer.trim() || "default") as TemplateName;
    const options = parseInitArgs([projectName, "--template", templateName], cwd);
    const result = await initProject(options);

    return createSuccessMessage(options, result.targetDir);
  } finally {
    rl.close();
  }
}

export function normalizeTemplateVersion(version: string) {
  return version === "latest" ? "latest" : version.replace(/^v/, "");
}

export function getReleaseTag(version: string) {
  return normalizeTemplateVersion(version) === "latest" ? "latest" : `template-v${normalizeTemplateVersion(version)}`;
}

function getTemplateDefinition(templateName: string) {
  const definition = templateDefinitions.find((template) => template.name === templateName);

  if (!definition) {
    throw new Error(`Template "${templateName}" is not available. Available templates: ${templateNames.join(", ")}.`);
  }

  return definition;
}

export function findTemplateAsset(release: GitHubRelease) {
  const asset = release.assets.find((item) => templateAssetNamePattern.test(item.name));

  if (!asset) {
    throw new Error(`No tsu template asset found in GitHub Release ${release.tag_name}.`);
  }

  return asset;
}

export function parseTemplateAssetVersion(assetName: string) {
  return templateAssetNamePattern.exec(assetName)?.[1];
}

export function findTemplateVersionsFromReleases(releases: GitHubRelease[]): TemplateVersionInfo[] {
  return releases.flatMap((release) =>
    release.assets.flatMap((asset) => {
      const version = parseTemplateAssetVersion(asset.name);

      if (!version) {
        return [];
      }

      return [
        {
          version,
          tag: release.tag_name,
          asset: asset.name,
          assetUrl: asset.browser_download_url
        }
      ];
    })
  );
}

export function remoteManifestTemplateNames(manifest: RemoteTemplateManifest) {
  return manifest.templates.map((template) => (typeof template === "string" ? template : template.name));
}

export function remoteManifestIncludesTemplate(manifest: RemoteTemplateManifest, templateName: string) {
  return remoteManifestTemplateNames(manifest).includes(templateName);
}

export function findRemoteTemplateDefinition(manifest: RemoteTemplateManifest, templateName: string): RemoteTemplateDefinition | undefined {
  const template = manifest.templates.find((item) => (typeof item === "string" ? item : item.name) === templateName);

  if (!template) {
    return undefined;
  }

  return typeof template === "string" ? { name: template } : template;
}

export async function resolveRemoteTemplateInfo(options: Required<TemplateInfoOptions>) {
  const release = await fetchGitHubRelease(options.repository, options.version);
  const asset = findTemplateAsset(release);
  const manifest = await downloadTemplateManifest(asset.name, asset.browser_download_url);
  const definition = findRemoteTemplateDefinition(manifest, options.templateName);

  if (!definition) {
    throw new Error(`Template "${options.templateName}" is not available in ${asset.name}. Available templates: ${remoteManifestTemplateNames(manifest).join(", ")}.`);
  }

  return definition;
}

export async function resolveTemplateVersions(options: TemplateVersionsOptions) {
  const versions = findTemplateVersionsFromReleases(await fetchGitHubReleases(options.repository));

  if (!options.templateName) {
    return versions;
  }

  const filteredVersions: TemplateVersionInfo[] = [];

  for (const version of versions) {
    const manifest = await downloadTemplateManifest(version.asset, version.assetUrl);

    if (remoteManifestIncludesTemplate(manifest, options.templateName)) {
      filteredVersions.push({ ...version, templates: remoteManifestTemplateNames(manifest) });
    }
  }

  return filteredVersions;
}

export function createTemplateMetadata(options: InitProjectOptions): string {
  const metadata: TemplateMetadata = {
    template: {
      name: options.templateName ?? "default",
      version: normalizeTemplateVersion(options.version ?? "latest"),
      source: options.source ?? "remote",
      ...(options.repository ? { repository: options.repository } : {})
    }
  };

  return `${JSON.stringify(metadata, null, 2)}\n`;
}

export async function doctorProject(options: DoctorOptions): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  const warnings: string[] = [];
  const nextSteps: string[] = [];
  const packageJson = await readJsonFile<{ name?: string }>(join(options.cwd, "package.json"));
  const readme = await readTextFile(join(options.cwd, "README.md"));
  const metadata = await readTemplateMetadata(options.cwd);
  const readmeTemplateName = detectTemplateName(readme);
  const templateName = metadata?.template.name ?? readmeTemplateName;
  const templateVersion = metadata?.template.version;
  const templateSource = metadata?.template.source;
  const templateRepository = metadata?.template.repository;

  checks.push(packageJson ? pass("package.json", `Found ${packageJson.name ?? "unnamed package"}`) : fail("package.json", "Missing package.json"));
  checks.push(readmeTemplateName ? pass("Tsu README marker", `Generated from ${readmeTemplateName}`) : fail("Tsu README marker", "README.md does not include a Tsu generated marker"));
  checks.push(metadata ? pass("Template metadata", `.tsu/template.json records ${metadata.template.name}@${metadata.template.version}`) : warn("Template metadata", "Missing .tsu/template.json"));

  if (!templateVersion) {
    warnings.push("Template version metadata is not recorded in this project yet.");
  }

  if (templateName) {
    const missingFiles = await missingTemplateFiles(options.cwd, templateName);

    if (missingFiles.length) {
      checks.push(warn("Template files", `Missing ${missingFiles.join(", ")}`));
      warnings.push(`Template ${templateName} is missing expected files: ${missingFiles.join(", ")}.`);
      nextSteps.push("Compare the project against a fresh template generation before upgrading.");
    } else {
      checks.push(pass("Template files", "Expected template files are present"));
    }
  }

  if (!packageJson || !templateName) {
    nextSteps.push("Run this command inside a project generated by tsu-cli, or pass --cwd to one.");
  }

  if (!templateVersion) {
    nextSteps.push("Regenerate with a versioned template or add template metadata when that feature is available.");
  }

  const status = checks.some((check) => check.status === "fail") ? "error" : checks.some((check) => check.status === "warn") || warnings.length ? "warning" : "ok";

  return {
    cwd: options.cwd,
    ...(packageJson?.name ? { projectName: packageJson.name } : {}),
    ...(templateName ? { templateName } : {}),
    ...(templateVersion ? { templateVersion } : {}),
    ...(templateSource ? { templateSource } : {}),
    ...(templateRepository ? { templateRepository } : {}),
    status,
    checks,
    warnings,
    nextSteps
  };
}

const templateExpectedFiles: Record<string, string[]> = {
  default: ["package.json", "README.md", "src/index.js"],
  monorepo: ["package.json", "README.md", "pnpm-workspace.yaml", "turbo.json"],
  vue3: ["package.json", "README.md", "src/main.ts", "src/App.vue", "vite.config.ts"],
  mfe: ["package.json", "README.md", "apps/host/package.json", "apps/subapp/package.json", "packages/shared/src/index.ts"],
  react: ["package.json", "README.md", "src/main.tsx", "src/App.tsx", "vite.config.ts"]
};

function pass(label: string, details?: string): DoctorCheck {
  return { label, status: "pass", ...(details ? { details } : {}) };
}

function warn(label: string, details?: string): DoctorCheck {
  return { label, status: "warn", ...(details ? { details } : {}) };
}

function fail(label: string, details?: string): DoctorCheck {
  return { label, status: "fail", ...(details ? { details } : {}) };
}

function detectTemplateName(readme: string | undefined) {
  return readme?.match(/Generated by Tsu from the `([^`]+)` template/)?.[1];
}

async function readTemplateMetadata(cwd: string) {
  return readJsonFile<TemplateMetadata>(join(cwd, ".tsu", "template.json"));
}

async function missingTemplateFiles(cwd: string, templateName: string) {
  const expectedFiles = templateExpectedFiles[templateName] ?? ["package.json", "README.md"];
  const exists = await Promise.all(expectedFiles.map(async (file) => ((await readTextFile(join(cwd, file))) === undefined ? file : undefined)));
  return exists.filter((file): file is string => Boolean(file));
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  const content = await readTextFile(filePath);

  if (!content) {
    return undefined;
  }

  return JSON.parse(content) as T;
}

async function readTextFile(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
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

    if (!remoteManifestIncludesTemplate(manifest, templateName)) {
      throw new Error(`Template "${templateName}" is not available in ${asset.name}. Available templates: ${remoteManifestTemplateNames(manifest).join(", ")}.`);
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

async function fetchGitHubReleases(repository: string): Promise<GitHubRelease[]> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "tsu-cli"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve GitHub Releases: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GitHubRelease[];
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

async function downloadTemplateManifest(assetName: string, assetUrl: string): Promise<RemoteTemplateManifest> {
  const tempDir = await mkdtemp(join(tmpdir(), "tsu-template-versions-"));

  try {
    const archivePath = join(tempDir, assetName);
    await downloadFile(assetUrl, archivePath);
    await extractTarball(archivePath, tempDir);

    return JSON.parse(await readFile(join(tempDir, assetName.replace(/\.tar\.gz$/, ""), "manifest.json"), "utf8")) as RemoteTemplateManifest;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
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

function formatOptionalList(value: string[] | undefined) {
  return value?.length ? value.join(", ") : "Not provided";
}

function readCommandValue(args: string[], index: number, command: string) {
  const value = args[index];

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${command}`);
  }

  return value;
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

if (isCliEntrypoint()) {
  const args = process.argv.slice(2);
  const cliAction = args.length === 0 && input.isTTY ? runInteractiveInit() : runCli(args);

  cliAction
    .then((message) => {
      console.log(message);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

export function isCliEntrypoint() {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return normalizeEntrypointPath(fileURLToPath(import.meta.url)) === normalizeEntrypointPath(entrypoint);
}

export function normalizeEntrypointPath(path: string) {
  const platformPath = path.replace(/^\/([a-zA-Z])\//, "$1:/");
  const resolvedPath = resolve(platformPath);
  const realPath = existsSync(resolvedPath) ? realpathSync(resolvedPath) : resolvedPath;

  return realPath.replaceAll("\\", "/").toLowerCase();
}
