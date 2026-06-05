import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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

export async function fetchGitHubRelease(repository: string, version: string): Promise<GitHubRelease> {
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

export async function fetchGitHubReleases(repository: string): Promise<GitHubRelease[]> {
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

export async function downloadFile(url: string, destination: string) {
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

export async function downloadTemplateManifest(assetName: string, assetUrl: string): Promise<RemoteTemplateManifest> {
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

export async function extractTarball(archivePath: string, destination: string) {
  await execFileAsync("tar", ["-xzf", basename(archivePath), "-C", "."], {
    cwd: destination,
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
    const manifest = await downloadTemplateManifest(version.asset, version.assetUrl);

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

function parseVersionParts(version: string) {
  return normalizeTemplateVersion(version)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
