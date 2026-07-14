import { parse as parseSemVer } from "semver";

export function normalizeTemplateReleaseVersion(value) {
  if (!value) {
    throw new Error("Missing template release version. Use --version=<version> or TEMPLATE_VERSION.");
  }

  const candidate = value.startsWith("v") ? value.slice(1) : value;
  const parsed = parseSemVer(candidate);

  if (!parsed || value.trim() !== value || value.startsWith("vv") || value.startsWith("V") || parsed.raw !== candidate || parsed.build.length > 0) {
    throw new Error(`Invalid template release version "${value}". Expected a complete SemVer such as 1.0.0 or 1.0.0-rc.1 without build metadata.`);
  }

  return parsed.version;
}

export function readTemplateReleaseVersion({ argv = process.argv, env = process.env } = {}) {
  const versionArg = argv.find((arg) => arg.startsWith("--version="));
  const value = versionArg?.slice("--version=".length) ?? env.TEMPLATE_VERSION;

  return normalizeTemplateReleaseVersion(value);
}

export function isTemplateReleasePrerelease(version) {
  return normalizeTemplateReleaseVersion(version).includes("-");
}
