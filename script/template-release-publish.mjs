export function assertTemplateReleaseAssetAvailable(existingRelease, tagName, assetName) {
  if (!existingRelease?.assets?.some((asset) => asset.name === assetName)) {
    return;
  }

  throw new Error(
    `Refusing to replace existing asset ${assetName} in GitHub Release ${tagName}. Published template assets are immutable; publish a new patch version instead.`
  );
}
