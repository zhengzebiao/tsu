import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const templateAssetNamePattern = /^tsu-templates-v(.+)\.tar\.gz$/;

export interface GitHubRelease {
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface TemplateAssetSource extends GitHubReleaseAsset {
  tag: string;
  version: string;
  resolvedBy: "direct" | "release-api";
}

export interface RemoteTemplateManifest {
  name?: string;
  schemaVersion?: string;
  version: string;
  asset?: string;
  templates: Array<string | RemoteTemplateDefinition>;
}

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

export interface TemplateBundle {
  bundleDir: string;
  manifest: RemoteTemplateManifest;
  dispose?: () => Promise<void>;
}

export interface TemplateCacheOptions {
  cache?: boolean;
  refresh?: boolean;
}

export interface TemplateVersionsOptions extends TemplateCacheOptions {
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

export function normalizeTemplateVersion(version: string) {
  return version === "latest" ? "latest" : version.replace(/^v/, "");
}

export function getReleaseTag(version: string) {
  return normalizeTemplateVersion(version) === "latest" ? "latest" : `template-v${normalizeTemplateVersion(version)}`;
}

export function isExplicitTemplateVersion(version: string | undefined) {
  return Boolean(version && normalizeTemplateVersion(version) !== "latest");
}

export function getTemplateAssetName(version: string) {
  const normalizedVersion = normalizeTemplateVersion(version);

  if (normalizedVersion === "latest") {
    throw new Error("Cannot build a template asset name for latest. Resolve latest to a concrete release first.");
  }

  return `tsu-templates-v${normalizedVersion}.tar.gz`;
}

export function getTemplateReleaseAssetUrl(repository: string, version: string) {
  return `https://github.com/${repository}/releases/download/${getReleaseTag(version)}/${getTemplateAssetName(version)}`;
}

export function getGitHubAuthToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined;
}

export function createGitHubHeaders(accept: string, url?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "tsu-cli"
  };
  const token = getGitHubAuthToken();

  if (token && shouldAttachGitHubAuth(url)) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export function getTemplateCacheRoot() {
  if (process.env.TSU_TEMPLATE_CACHE_DIR) {
    return process.env.TSU_TEMPLATE_CACHE_DIR;
  }

  if (process.env.XDG_CACHE_HOME) {
    return join(process.env.XDG_CACHE_HOME, "tsu-cli", "templates");
  }

  return platform() === "darwin" ? join(homedir(), "Library", "Caches", "tsu-cli", "templates") : join(homedir(), ".cache", "tsu-cli", "templates");
}

export function getTemplateCachePaths(repository: string, assetName: string) {
  const repositoryDir = join(getTemplateCacheRoot(), ...repository.split("/").map(sanitizePathSegment));
  const bundleName = assetName.replace(/\.tar\.gz$/, "");

  return {
    repositoryDir,
    archivePath: join(repositoryDir, assetName),
    bundleDir: join(repositoryDir, bundleName),
    bundleName
  };
}

export function findTemplateAsset(release: GitHubRelease) {
  const asset = release.assets.find((item) => templateAssetNamePattern.test(item.name));

  if (!asset) {
    throw new Error(`No tsu template asset found in GitHub Release ${release.tag_name}. Upload an asset named tsu-templates-v<version>.tar.gz to the release.`);
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

export async function resolveTemplateAssetSource(repository: string, version: string): Promise<TemplateAssetSource> {
  if (isExplicitTemplateVersion(version)) {
    const normalizedVersion = normalizeTemplateVersion(version);

    return {
      name: getTemplateAssetName(normalizedVersion),
      browser_download_url: getTemplateReleaseAssetUrl(repository, normalizedVersion),
      tag: getReleaseTag(normalizedVersion),
      version: normalizedVersion,
      resolvedBy: "direct"
    };
  }

  const release = await fetchGitHubRelease(repository, version);
  const asset = findTemplateAsset(release);

  return {
    ...asset,
    tag: release.tag_name,
    version: parseTemplateAssetVersion(asset.name) ?? normalizeTemplateVersion(version),
    resolvedBy: "release-api"
  };
}

export async function fetchGitHubRelease(repository: string, version: string): Promise<GitHubRelease> {
  const releasePath = getReleaseTag(version) === "latest" ? "latest" : `tags/${getReleaseTag(version)}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/${releasePath}`, {
    headers: createGitHubHeaders("application/vnd.github+json")
  });

  if (!response.ok) {
    throw new Error(createGitHubReleaseErrorMessage("Failed to resolve GitHub Release", repository, releasePath, response));
  }

  return (await response.json()) as GitHubRelease;
}

export async function fetchGitHubReleases(repository: string): Promise<GitHubRelease[]> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`, {
    headers: createGitHubHeaders("application/vnd.github+json")
  });

  if (!response.ok) {
    throw new Error(createGitHubReleaseErrorMessage("Failed to resolve GitHub Releases", repository, "releases", response));
  }

  return (await response.json()) as GitHubRelease[];
}

export async function downloadFile(url: string, destination: string) {
  const response = await fetch(url, {
    headers: createGitHubHeaders("application/octet-stream", url)
  });

  if (!response.ok) {
    throw new Error(createTemplateAssetDownloadErrorMessage(url, response));
  }

  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
}

export async function downloadTemplateManifest(assetName: string, assetUrl: string, repository: string, options: TemplateCacheOptions = {}): Promise<RemoteTemplateManifest> {
  const bundle = await ensureTemplateBundle(repository, assetName, assetUrl, options);

  try {
    return bundle.manifest;
  } finally {
    await bundle.dispose?.();
  }
}

export async function ensureTemplateBundle(repository: string, assetName: string, assetUrl: string, options: TemplateCacheOptions = {}): Promise<TemplateBundle> {
  const shouldUseCache = options.cache !== false;

  if (!shouldUseCache) {
    return createTemporaryTemplateBundle(assetName, assetUrl);
  }

  const cachePaths = getTemplateCachePaths(repository, assetName);
  const cachedManifest = options.refresh ? undefined : await readTemplateManifest(cachePaths.bundleDir);

  if (cachedManifest) {
    return {
      bundleDir: cachePaths.bundleDir,
      manifest: cachedManifest
    };
  }

  await mkdir(cachePaths.repositoryDir, { recursive: true });

  if (options.refresh || !(await fileExists(cachePaths.archivePath))) {
    await downloadTemplateArchive(assetName, assetUrl, cachePaths.archivePath);
  }

  await extractTemplateArchive(cachePaths.archivePath, cachePaths.repositoryDir, cachePaths.bundleName, cachePaths.bundleDir);

  return {
    bundleDir: cachePaths.bundleDir,
    manifest: await readRequiredTemplateManifest(cachePaths.bundleDir)
  };
}

export async function extractTarball(archivePath: string, destination: string) {
  await mkdir(destination, { recursive: true });

  const archiveDir = dirname(archivePath);
  const destinationPath = relative(archiveDir, destination) || ".";

  await execFileAsync("tar", ["-xzf", basename(archivePath), "-C", destinationPath], {
    cwd: archiveDir,
    maxBuffer: 10 * 1024 * 1024
  });
}

export async function resolveTemplateVersions(options: TemplateVersionsOptions) {
  const versions = findTemplateVersionsFromReleases(await fetchGitHubReleases(options.repository));

  if (!options.templateName) {
    return versions;
  }

  const filteredVersions: TemplateVersionInfo[] = [];

  for (const version of versions) {
    const manifest = await downloadTemplateManifest(version.asset, version.assetUrl, options.repository, options);

    if (remoteManifestIncludesTemplate(manifest, options.templateName)) {
      filteredVersions.push({ ...version, templates: remoteManifestTemplateNames(manifest) });
    }
  }

  return filteredVersions;
}

export function newestTemplateVersion(versions: string[]) {
  return [...versions].sort(compareTemplateVersions).at(-1);
}

export function compareTemplateVersions(a: string, b: string) {
  const aParts = parseVersionParts(a);
  const bParts = parseVersionParts(b);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const aPart = aParts[index] ?? 0;
    const bPart = bParts[index] ?? 0;

    if (aPart !== bPart) {
      return aPart - bPart;
    }
  }

  return normalizeTemplateVersion(a).localeCompare(normalizeTemplateVersion(b));
}

function createGitHubReleaseErrorMessage(action: string, repository: string, releasePath: string, response: Response) {
  const base = `${action} ${releasePath} from ${repository}: ${response.status} ${response.statusText}.`;

  if (response.status === 401 || response.status === 403) {
    return `${base} For private template repositories, set GITHUB_TOKEN or GH_TOKEN with repository read access.`;
  }

  if (response.status === 404) {
    return `${base} Check --repo, TSU_TEMPLATE_REPOSITORY, the template-v<version> release tag, and whether the repository is private.`;
  }

  return `${base} Check GitHub availability and retry with --refresh if cached metadata is stale.`;
}

function createTemplateAssetDownloadErrorMessage(url: string, response: Response) {
  const base = `Failed to download template asset from ${url}: ${response.status} ${response.statusText}.`;

  if (response.status === 401 || response.status === 403) {
    return `${base} For private template repositories, set GITHUB_TOKEN or GH_TOKEN with repository read access.`;
  }

  if (response.status === 404) {
    return `${base} Check that the release asset is named tsu-templates-v<version>.tar.gz and that the release exists.`;
  }

  return `${base} Retry with --refresh or --no-cache if the local template cache may be stale.`;
}

function shouldAttachGitHubAuth(url: string | undefined) {
  if (!url) {
    return true;
  }

  try {
    const hostname = new URL(url).hostname;

    return hostname === "github.com" || hostname === "api.github.com" || hostname === "objects.githubusercontent.com" || hostname.endsWith(".githubusercontent.com");
  } catch {
    return false;
  }
}

function sanitizePathSegment(segment: string) {
  return encodeURIComponent(segment.replace(/^\.+$/, "_").replaceAll("/", "_").replaceAll("\\", "_"));
}

async function createTemporaryTemplateBundle(assetName: string, assetUrl: string): Promise<TemplateBundle> {
  const tempDir = await mkdtemp(join(tmpdir(), "tsu-template-no-cache-"));
  const archivePath = join(tempDir, assetName);

  try {
    await downloadFile(assetUrl, archivePath);
    await extractTarball(archivePath, tempDir);

    const bundleDir = join(tempDir, assetName.replace(/\.tar\.gz$/, ""));

    return {
      bundleDir,
      manifest: await readRequiredTemplateManifest(bundleDir),
      dispose: () => rm(tempDir, { force: true, recursive: true })
    };
  } catch (error: unknown) {
    await rm(tempDir, { force: true, recursive: true });
    throw error;
  }
}

async function downloadTemplateArchive(assetName: string, assetUrl: string, archivePath: string) {
  const tempArchivePath = join(dirname(archivePath), `${assetName}.${process.pid}.tmp`);

  try {
    await downloadFile(assetUrl, tempArchivePath);
    await rename(tempArchivePath, archivePath);
  } catch (error: unknown) {
    await rm(tempArchivePath, { force: true });
    throw new Error(`Failed to download template asset ${assetName} from ${assetUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractTemplateArchive(archivePath: string, repositoryDir: string, bundleName: string, bundleDir: string) {
  const stagingDir = await mkdtemp(join(repositoryDir, `${bundleName}-`));

  try {
    await extractTarball(archivePath, stagingDir);
    const extractedBundleDir = join(stagingDir, bundleName);
    await readRequiredTemplateManifest(extractedBundleDir);
    await rm(bundleDir, { force: true, recursive: true });
    await rename(extractedBundleDir, bundleDir);
  } finally {
    await rm(stagingDir, { force: true, recursive: true });
  }
}

async function readTemplateManifest(bundleDir: string): Promise<RemoteTemplateManifest | undefined> {
  try {
    return await readRequiredTemplateManifest(bundleDir);
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    return undefined;
  }
}

async function readRequiredTemplateManifest(bundleDir: string) {
  return JSON.parse(await readFile(join(bundleDir, "manifest.json"), "utf8")) as RemoteTemplateManifest;
}

async function fileExists(filePath: string) {
  try {
    await readFile(filePath);
    return true;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function parseVersionParts(version: string) {
  return normalizeTemplateVersion(version)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
