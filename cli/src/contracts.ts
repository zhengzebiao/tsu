import { parse as parseSemVer } from "semver";

export const remoteTemplateManifestSchemaVersion = "0.5" as const;

export type TemplateSource = "remote" | "local";

export interface RemoteTemplateDefinition {
  name: string;
  title?: string;
  description?: string;
  tags?: string[];
  recommendedFor?: string[];
  node?: string;
  packageManagers?: string[];
  nextSteps?: string[];
}

export interface RemoteTemplateManifest {
  name?: string;
  schemaVersion?: typeof remoteTemplateManifestSchemaVersion;
  version: string;
  asset?: string;
  changelog?: string[];
  templates: RemoteTemplateDefinition[];
}

export interface TemplateMetadata {
  template: {
    name: string;
    version: string;
    source: TemplateSource;
    repository?: string;
  };
  generatedAt?: string;
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

export type ContractErrorCode =
  | "TEMPLATE_VERSION_INVALID"
  | "TEMPLATE_MANIFEST_INVALID_JSON"
  | "TEMPLATE_MANIFEST_INVALID"
  | "TEMPLATE_MANIFEST_SCHEMA_UNSUPPORTED"
  | "TEMPLATE_METADATA_INVALID_JSON"
  | "TEMPLATE_METADATA_INVALID"
  | "GITHUB_RESPONSE_INVALID";

export class ContractError extends Error {
  constructor(
    readonly code: ContractErrorCode,
    message: string,
    readonly location: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ContractError";
  }
}

export interface ManifestDecodeContext {
  location: string;
  expectedVersion?: string;
  expectedAsset?: string;
}

export function normalizeConcreteTemplateVersion(version: string, location = "template version") {
  return readConcreteVersion(version, "version", location, "TEMPLATE_VERSION_INVALID");
}

export function normalizeTemplateVersionSelector(version: string) {
  return version === "latest" ? version : normalizeConcreteTemplateVersion(version);
}

export function parseJsonText(text: string, code: ContractErrorCode, location: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error: unknown) {
    throw new ContractError(code, `Invalid JSON at ${location}: ${error instanceof Error ? error.message : String(error)}`, location, { cause: error });
  }
}

export function parseRemoteTemplateManifest(text: string, context: ManifestDecodeContext): RemoteTemplateManifest {
  return decodeRemoteTemplateManifest(parseJsonText(text, "TEMPLATE_MANIFEST_INVALID_JSON", context.location), context);
}

export function decodeRemoteTemplateManifest(value: unknown, context: ManifestDecodeContext): RemoteTemplateManifest {
  const root = readRecord(value, "template manifest", context.location, "TEMPLATE_MANIFEST_INVALID");
  const schemaVersion = readOptionalString(root, "schemaVersion", "schemaVersion", context.location, "TEMPLATE_MANIFEST_INVALID");

  if (schemaVersion !== undefined && schemaVersion !== remoteTemplateManifestSchemaVersion) {
    throw new ContractError(
      "TEMPLATE_MANIFEST_SCHEMA_UNSUPPORTED",
      `Unsupported template manifest schemaVersion "${schemaVersion}" at ${context.location}. This CLI supports schemaVersion "${remoteTemplateManifestSchemaVersion}" and legacy manifests without schemaVersion. Upgrade @tsuz/cli to read newer manifests.`,
      context.location
    );
  }

  const version = readConcreteVersion(root.version, "version", context.location, "TEMPLATE_MANIFEST_INVALID");
  const name = readOptionalString(root, "name", "name", context.location, "TEMPLATE_MANIFEST_INVALID");
  const asset = readOptionalString(root, "asset", "asset", context.location, "TEMPLATE_MANIFEST_INVALID");
  const changelog = readOptionalStringArray(root, "changelog", "changelog", context.location, "TEMPLATE_MANIFEST_INVALID", false);

  if (context.expectedVersion && version !== context.expectedVersion) {
    throw invalidManifest(context.location, `version "${version}" does not match archive version "${context.expectedVersion}".`);
  }

  if (context.expectedAsset && asset !== undefined && asset !== context.expectedAsset) {
    throw invalidManifest(context.location, `asset "${asset}" does not match archive asset "${context.expectedAsset}".`);
  }

  if (schemaVersion === remoteTemplateManifestSchemaVersion) {
    if (!name) {
      throw invalidManifest(context.location, "name must be a nonempty string.");
    }

    if (!asset) {
      throw invalidManifest(context.location, "asset must be a nonempty string.");
    }

    if (context.expectedAsset && asset !== context.expectedAsset) {
      throw invalidManifest(context.location, `asset "${asset}" does not match archive asset "${context.expectedAsset}".`);
    }
  }

  if (!Array.isArray(root.templates) || root.templates.length === 0) {
    throw invalidManifest(context.location, "templates must be a non-empty array.");
  }

  const templates = root.templates.map((template, index) => decodeTemplateDefinition(template, index, schemaVersion === remoteTemplateManifestSchemaVersion, context.location));
  const duplicate = templates.find((template, index) => templates.findIndex((candidate) => candidate.name === template.name) !== index);

  if (duplicate) {
    throw invalidManifest(context.location, `templates contains duplicate name "${duplicate.name}".`);
  }

  return {
    ...(name ? { name } : {}),
    ...(schemaVersion ? { schemaVersion: remoteTemplateManifestSchemaVersion } : {}),
    version,
    ...(asset ? { asset } : {}),
    ...(changelog ? { changelog } : {}),
    templates
  };
}

export function parseTemplateMetadata(text: string, location = ".tsu/template.json"): TemplateMetadata {
  return decodeTemplateMetadata(parseJsonText(text, "TEMPLATE_METADATA_INVALID_JSON", location), location);
}

export function decodeTemplateMetadata(value: unknown, location = ".tsu/template.json"): TemplateMetadata {
  const root = readRecord(value, "template metadata", location, "TEMPLATE_METADATA_INVALID");
  const template = readRecord(root.template, "template metadata field template", location, "TEMPLATE_METADATA_INVALID");
  const name = readRequiredString(template.name, "template.name", location, "TEMPLATE_METADATA_INVALID");
  const rawVersion = readRequiredString(template.version, "template.version", location, "TEMPLATE_METADATA_INVALID");
  const version = rawVersion === "latest" ? rawVersion : readConcreteVersion(rawVersion, "template.version", location, "TEMPLATE_METADATA_INVALID");

  if (template.source !== "remote" && template.source !== "local") {
    throw invalidMetadata(location, 'template.source must be "remote" or "local".');
  }

  const repository = readOptionalString(template, "repository", "template.repository", location, "TEMPLATE_METADATA_INVALID");
  const generatedAt = readOptionalString(root, "generatedAt", "generatedAt", location, "TEMPLATE_METADATA_INVALID");

  if (generatedAt !== undefined && !isCanonicalIsoTimestamp(generatedAt)) {
    throw invalidMetadata(location, "generatedAt must be a valid canonical ISO timestamp.");
  }

  return {
    template: {
      name,
      version,
      source: template.source,
      ...(repository ? { repository } : {})
    },
    ...(generatedAt ? { generatedAt } : {})
  };
}

export function stringifyTemplateMetadata(metadata: TemplateMetadata) {
  return `${JSON.stringify(decodeTemplateMetadata(metadata), null, 2)}\n`;
}

export function decodeGitHubRelease(value: unknown, location: string): GitHubRelease {
  const root = readRecord(value, "GitHub Release response", location, "GITHUB_RESPONSE_INVALID");
  const tagName = readRequiredString(root.tag_name, "tag_name", location, "GITHUB_RESPONSE_INVALID");

  if (!Array.isArray(root.assets)) {
    throw invalidGitHubResponse(location, "assets must be an array.");
  }

  return {
    tag_name: tagName,
    assets: root.assets.map((asset, index) => {
      const item = readRecord(asset, `GitHub Release asset ${index}`, location, "GITHUB_RESPONSE_INVALID");
      return {
        name: readRequiredString(item.name, `assets[${index}].name`, location, "GITHUB_RESPONSE_INVALID"),
        browser_download_url: readRequiredString(item.browser_download_url, `assets[${index}].browser_download_url`, location, "GITHUB_RESPONSE_INVALID")
      };
    })
  };
}

export function decodeGitHubReleases(value: unknown, location: string): GitHubRelease[] {
  if (!Array.isArray(value)) {
    throw invalidGitHubResponse(location, "response must be an array.");
  }

  return value.map((release, index) => decodeGitHubRelease(release, `${location}[${index}]`));
}

function decodeTemplateDefinition(value: unknown, index: number, requireRich: boolean, location: string): RemoteTemplateDefinition {
  const path = `templates[${index}]`;

  if (typeof value === "string") {
    if (requireRich) {
      throw invalidManifest(location, `${path} must be an object for schemaVersion "${remoteTemplateManifestSchemaVersion}".`);
    }

    return { name: readRequiredString(value, path, location, "TEMPLATE_MANIFEST_INVALID") };
  }

  const definition = readRecord(value, path, location, "TEMPLATE_MANIFEST_INVALID");
  const result: RemoteTemplateDefinition = {
    name: readRequiredString(definition.name, `${path}.name`, location, "TEMPLATE_MANIFEST_INVALID")
  };
  const stringFields = ["title", "description", "node"] as const;
  const listFields = ["tags", "recommendedFor", "packageManagers", "nextSteps"] as const;

  for (const field of stringFields) {
    const fieldValue = readOptionalString(definition, field, `${path}.${field}`, location, "TEMPLATE_MANIFEST_INVALID");

    if (requireRich && !fieldValue) {
      throw invalidManifest(location, `${path}.${field} must be a nonempty string.`);
    }

    if (fieldValue) {
      result[field] = fieldValue;
    }
  }

  for (const field of listFields) {
    const fieldValue = readOptionalStringArray(definition, field, `${path}.${field}`, location, "TEMPLATE_MANIFEST_INVALID", requireRich);

    if (fieldValue) {
      result[field] = fieldValue;
    }
  }

  return result;
}

function readConcreteVersion(value: unknown, path: string, location: string, code: ContractErrorCode) {
  const input = readRequiredString(value, path, location, code);
  const candidate = input.startsWith("v") ? input.slice(1) : input;
  const parsed = parseSemVer(candidate);

  if (!parsed || input.trim() !== input || input.startsWith("vv") || input.startsWith("V") || parsed.raw !== candidate || parsed.build.length > 0) {
    throw new ContractError(code, `Invalid ${path} at ${location}: expected a complete SemVer without build metadata.`, location);
  }

  return parsed.version;
}

function readRecord(value: unknown, label: string, location: string, code: ContractErrorCode): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContractError(code, `Invalid ${label} at ${location}: expected an object.`, location);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, path: string, location: string, code: ContractErrorCode) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new ContractError(code, `Invalid ${path} at ${location}: expected a nonempty string without surrounding whitespace.`, location);
  }

  return value;
}

function readOptionalString(root: Record<string, unknown>, field: string, path: string, location: string, code: ContractErrorCode) {
  return root[field] === undefined ? undefined : readRequiredString(root[field], path, location, code);
}

function readOptionalStringArray(
  root: Record<string, unknown>,
  field: string,
  path: string,
  location: string,
  code: ContractErrorCode,
  required: boolean
): string[] | undefined {
  const value = root[field];

  if (value === undefined) {
    if (required) {
      throw new ContractError(code, `Invalid ${path} at ${location}: expected a non-empty string array.`, location);
    }

    return undefined;
  }

  if (!Array.isArray(value) || (required && value.length === 0)) {
    throw new ContractError(code, `Invalid ${path} at ${location}: expected a${required ? " non-empty" : ""} string array.`, location);
  }

  return value.map((item, index) => readRequiredString(item, `${path}[${index}]`, location, code));
}

function isCanonicalIsoTimestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function invalidManifest(location: string, details: string) {
  return new ContractError("TEMPLATE_MANIFEST_INVALID", `Invalid template manifest at ${location}: ${details}`, location);
}

function invalidMetadata(location: string, details: string) {
  return new ContractError("TEMPLATE_METADATA_INVALID", `Invalid template metadata at ${location}: ${details}`, location);
}

function invalidGitHubResponse(location: string, details: string) {
  return new ContractError("GITHUB_RESPONSE_INVALID", `Invalid GitHub response at ${location}: ${details}`, location);
}
