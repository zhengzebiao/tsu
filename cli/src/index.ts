#!/usr/bin/env node

import { stdin as input, stdout as output } from "node:process";
import { existsSync, realpathSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { createTemplateFiles, renderTemplateFiles, templateDefinitions, templateNames, type TemplateFile, type TemplateName } from "./template.js";
import {
  compareTemplateVersions,
  downloadTemplateManifest,
  ensureTemplateBundle,
  findRemoteTemplateDefinition,
  findTemplateAsset,
  newestTemplateVersion,
  normalizeTemplateVersion,
  remoteManifestIncludesTemplate,
  remoteManifestTemplateNames,
  resolveTemplateAssetSource,
  resolveTemplateVersions,
  type RemoteTemplateDefinition,
  type TemplateVersionInfo,
  type TemplateVersionsOptions
} from "./template-release.js";

export {
  compareTemplateVersions,
  findRemoteTemplateDefinition,
  findTemplateAsset,
  findTemplateVersionsFromReleases,
  getReleaseTag,
  newestTemplateVersion,
  normalizeTemplateVersion,
  parseTemplateAssetVersion,
  remoteManifestIncludesTemplate,
  remoteManifestTemplateNames
} from "./template-release.js";

const require = createRequire(import.meta.url);
const cliPackageJson = require("../package.json") as { version: string };
const cliVersion = cliPackageJson.version;

export interface InitProjectOptions {
  cwd: string;
  projectName: string;
  templateName?: string;
  version?: string;
  force?: boolean;
  source?: TemplateSource;
  repository?: string;
  cache?: boolean;
  refresh?: boolean;
}

export type TemplateSource = "remote" | "local";

export interface ParsedInitOptions extends Required<Pick<InitProjectOptions, "cwd" | "projectName" | "templateName" | "version" | "force" | "source" | "cache" | "refresh">> {
  repository?: string;
}

export interface TemplateInfoOptions {
  repository: string;
  templateName: string;
  version?: string;
  cache?: boolean;
  refresh?: boolean;
}

export interface InteractiveInitPrompts {
  question(prompt: string): Promise<string>;
  close(): void;
}

export interface DoctorOptions {
  cwd: string;
  json?: boolean;
}

export interface UpgradeCheckOptions {
  cwd: string;
  repository?: string;
  json?: boolean;
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

export interface UpgradeCheckResult {
  cwd: string;
  status: UpgradeCheckStatus;
  templateName?: string;
  currentVersion?: string;
  latestVersion?: string;
  repository?: string;
  availableVersions: string[];
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
export type UpgradeCheckStatus = "current" | "update_available" | "unknown";

export function createCliMessage() {
  return createHelpMessage();
}

export function createHelpMessage() {
  return [
    "Tsu CLI - create versioned project templates.",
    "",
    "Usage:",
    "  tsu-cli init [project-name] [options]",
    "  tsu-cli doctor [--cwd <path>] [--json]",
    "  tsu-cli upgrade-check [--cwd <path>] [--repo <owner/repo>] [--json]",
    "  tsu-cli templates",
    "  tsu-cli list",
    "  tsu-cli template list",
    "  tsu-cli template info <name> [--version <value>] [--repo <owner/repo>] [--no-cache] [--refresh]",
    "  tsu-cli template versions [name] [--repo <owner/repo>] [--no-cache] [--refresh]",
    "  tsu-cli --help",
    "  tsu-cli --version",
    "",
    "Commands:",
    "  init [project-name]    Create a project from a template",
    "  doctor                 Check a generated project",
    "  upgrade-check          Check for newer template releases",
    "  templates              List available templates (aliases: list, template list)",
    "  template info <name>   Show template details",
    "  template versions      List template release versions",
    "",
    "Init options:",
    "  -t, --template <name>  Template name: default, vue3, react, mfe, monorepo, python-main, python-app",
    "  -v, --version <value>  Template version, for example 1.0.3 or latest",
    "      --repo <owner/repo> Template release repository",
    "      --cwd <path>       Directory to create the project in",
    "      --local            Use bundled templates instead of GitHub releases",
    "      --no-cache         Do not read from or write to the local template cache",
    "      --refresh          Re-download and refresh the local template cache",
    "  -f, --force           Overwrite the target directory",
    "",
    "Doctor options:",
    "      --cwd <path>       Project directory to check",
    "      --json             Output the result as JSON",
    "",
    "Upgrade-check options:",
    "      --cwd <path>       Project directory to check",
    "      --repo <owner/repo> Override the template release repository",
    "      --json             Output the result as JSON",
    "",
    "Examples:",
    "  tsu-cli init my-app --template vue3",
    "  tsu-cli doctor --cwd my-app",
    "  tsu-cli doctor --cwd my-app --json",
    "  tsu-cli upgrade-check --cwd my-app",
    "  tsu-cli upgrade-check --cwd my-app --json",
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

export function createTemplateInfoHelpMessage() {
  return [
    "Show details for a local or versioned template.",
    "",
    "Usage:",
    "  tsu-cli template info <name> [options]",
    "",
    "Options:",
    "  -v, --version <value>   Template release version, for example 1.0.3 or latest",
    "      --repo <owner/repo> Template release repository",
    "      --no-cache          Do not read from or write to the local template cache",
    "      --refresh           Re-download and refresh the local template cache",
    "",
    "Examples:",
    "  tsu-cli template info vue3",
    "  tsu-cli template info vue3 --version 1.2.3",
    "  tsu-cli template info vue3 --version 1.2.3 --repo company/templates"
  ].join("\n");
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

export function createRemoteTemplateInfoMessage(options: TemplateInfoOptions, definition: RemoteTemplateDefinition) {
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

export function createUpgradeCheckMessage(result: UpgradeCheckResult) {
  return [
    `Template upgrade check: ${result.status.toUpperCase()}`,
    `Project: ${result.cwd}`,
    ...(result.templateName ? [`Template: ${result.templateName}`] : []),
    ...(result.currentVersion ? [`Current version: ${result.currentVersion}`] : []),
    ...(result.latestVersion ? [`Latest version: ${result.latestVersion}`] : []),
    ...(result.repository ? [`Repository: ${result.repository}`] : []),
    ...(result.availableVersions.length ? [`Available versions: ${result.availableVersions.join(", ")}`] : []),
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
  let cache = true;
  let refresh = false;
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

    if (arg === "--no-cache") {
      cache = false;
      continue;
    }

    if (arg === "--refresh") {
      refresh = true;
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
    cache,
    refresh,
    repository
  };
}

export function parseDoctorArgs(args: string[], cwd = process.cwd()): DoctorOptions {
  let targetCwd = cwd;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--cwd") {
      targetCwd = resolve(cwd, readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    cwd: targetCwd,
    ...(json ? { json } : {})
  };
}

export function parseUpgradeCheckArgs(args: string[], cwd = process.cwd()): UpgradeCheckOptions {
  let targetCwd = cwd;
  let repository: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--cwd") {
      targetCwd = resolve(cwd, readOptionValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--repo") {
      repository = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    cwd: targetCwd,
    ...(repository ? { repository } : {}),
    ...(json ? { json } : {})
  };
}

export function parseTemplateInfoArgs(args: string[]): TemplateInfoOptions {
  const templateName = readCommandValue(args, 0, "template info");
  let repository = process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu";
  let version: string | undefined;
  let cache = true;
  let refresh = false;

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

    if (arg === "--no-cache") {
      cache = false;
      continue;
    }

    if (arg === "--refresh") {
      refresh = true;
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
    cache,
    refresh,
    ...(version ? { version } : {})
  };
}

export function parseTemplateVersionsArgs(args: string[]): TemplateVersionsOptions {
  let repository = process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu";
  let templateName: string | undefined;
  let cache = true;
  let refresh = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--repo") {
      repository = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--no-cache") {
      cache = false;
      continue;
    }

    if (arg === "--refresh") {
      refresh = true;
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
    cache,
    refresh,
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

    const options = parseDoctorArgs(commandArgs, cwd);
    const result = await doctorProject(options);
    return options.json ? JSON.stringify(result, null, 2) : createDoctorMessage(result);
  }

  if (command === "upgrade-check") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      return createHelpMessage();
    }

    const options = parseUpgradeCheckArgs(commandArgs, cwd);
    const result = await upgradeCheckProject(options);
    return options.json ? JSON.stringify(result, null, 2) : createUpgradeCheckMessage(result);
  }

  if (command === "template" && commandArgs[0] === "info") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      return createTemplateInfoHelpMessage();
    }

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

export async function runInteractiveInit(cwd = process.cwd(), prompts?: InteractiveInitPrompts, source: TemplateSource = "remote") {
  const rl = prompts ?? createInterface({ input, output });

  try {
    const projectNameAnswer = await rl.question("Project name (quick-start-app): ");
    const templateNameAnswer = await rl.question(`Template (${templateNames.join("/")}) [default]: `);
    const projectName = projectNameAnswer.trim() || "quick-start-app";
    const templateName = (templateNameAnswer.trim() || "default") as TemplateName;
    const options = parseInitArgs([projectName, "--template", templateName, ...(source === "local" ? ["--local"] : [])], cwd);
    const result = await initProject(options);

    return createSuccessMessage(options, result.targetDir);
  } finally {
    rl.close();
  }
}

function getTemplateDefinition(templateName: string) {
  const definition = templateDefinitions.find((template) => template.name === templateName);

  if (!definition) {
    throw new Error(`Template "${templateName}" is not available. Available templates: ${templateNames.join(", ")}.`);
  }

  return definition;
}

export async function resolveRemoteTemplateInfo(options: TemplateInfoOptions) {
  if (!options.version) {
    throw new Error("Missing template version for remote template info.");
  }

  const asset = await resolveTemplateAssetSource(options.repository, options.version);
  const manifest = await downloadTemplateManifest(asset.name, asset.browser_download_url, options.repository, options);
  const definition = findRemoteTemplateDefinition(manifest, options.templateName);

  if (!definition) {
    throw new Error(`Template "${options.templateName}" is not available in ${asset.name}. Available templates: ${remoteManifestTemplateNames(manifest).join(", ")}.`);
  }

  return definition;
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

export async function upgradeCheckProject(options: UpgradeCheckOptions): Promise<UpgradeCheckResult> {
  const metadata = await readTemplateMetadata(options.cwd);
  const warnings: string[] = [];
  const nextSteps: string[] = [];

  if (!metadata) {
    return {
      cwd: options.cwd,
      status: "unknown",
      availableVersions: [],
      warnings: ["Missing .tsu/template.json. Run this command inside a project generated by tsu-cli."],
      nextSteps: ["Run tsu-cli doctor to inspect the project first."]
    };
  }

  const repository = options.repository ?? metadata.template.repository ?? process.env.TSU_TEMPLATE_REPOSITORY ?? process.env.GITHUB_REPOSITORY ?? "zhengzebiao/tsu";
  const versions = await resolveTemplateVersions({ repository });
  const availableVersions = versions.map((version) => version.version);
  const latestVersion = newestTemplateVersion(availableVersions);
  const currentVersion = normalizeTemplateVersion(metadata.template.version);

  if (!latestVersion) {
    return {
      cwd: options.cwd,
      status: "unknown",
      templateName: metadata.template.name,
      currentVersion,
      repository,
      availableVersions,
      warnings: [`No release versions found for template ${metadata.template.name}.`],
      nextSteps: [`Run tsu-cli template versions ${metadata.template.name} --repo ${repository} to inspect available releases.`]
    };
  }

  if (currentVersion === "latest") {
    warnings.push("Current template version is recorded as latest, so an exact upgrade comparison is not possible.");
    nextSteps.push(`Run tsu-cli template info ${metadata.template.name} --version ${latestVersion} --repo ${repository}`);

    return {
      cwd: options.cwd,
      status: "unknown",
      templateName: metadata.template.name,
      currentVersion,
      latestVersion,
      repository,
      availableVersions,
      warnings,
      nextSteps
    };
  }

  const hasUpdate = compareTemplateVersions(latestVersion, currentVersion) > 0;

  return {
    cwd: options.cwd,
    status: hasUpdate ? "update_available" : "current",
    templateName: metadata.template.name,
    currentVersion,
    latestVersion,
    repository,
    availableVersions,
    warnings,
    nextSteps: hasUpdate
      ? [
          `Run tsu-cli template info ${metadata.template.name} --version ${latestVersion} --repo ${repository}`,
          `Generate a fresh project with ${metadata.template.name}@${latestVersion} and compare changes.`
        ]
      : [`Template ${metadata.template.name}@${currentVersion} is current.`]
  };
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
  react: ["package.json", "README.md", "src/main.tsx", "src/App.tsx", "vite.config.ts"],
  "python-main": ["pyproject.toml", "README.md", "app/main.py", "app/api/auth.py", "app/core/config.py", "app/services/session_service.py", "alembic/versions/0001_initial_auth_schema.py", "tests/test_logging.py", "tests/test_redis_state_services.py"],
  "python-app": ["pyproject.toml", "README.md", "app/main.py", "app/api/example.py", "app/deps/auth.py", "app/services/session_service.py", "alembic/versions/0001_initial_app_schema.py", "tests/test_logging.py", "tests/test_redis_state_services.py"]
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

  const asset = await resolveTemplateAssetSource(options.repository, options.version ?? "latest");
  const bundle = await ensureTemplateBundle(options.repository, asset.name, asset.browser_download_url, options);
  const templateName = options.templateName ?? "default";

  if (!remoteManifestIncludesTemplate(bundle.manifest, templateName)) {
    throw new Error(`Template "${templateName}" is not available in ${asset.name}. Available templates: ${remoteManifestTemplateNames(bundle.manifest).join(", ")}.`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "tsu-template-"));

  try {
    const templateDir = join(bundle.bundleDir, templateName);
    const stagingDir = join(tempDir, "rendered");
    await cp(templateDir, stagingDir, { recursive: true });

    return renderTemplateFiles(await readTemplateDirectory(stagingDir), options.projectName);
  } finally {
    await bundle.dispose?.();
    await rm(tempDir, { force: true, recursive: true });
  }
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
