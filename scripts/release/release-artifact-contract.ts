const fail = (message: string): never => {
  throw new Error(message);
};

export const releaseVersion = (tag: string): string => {
  const match = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(
    tag,
  );
  return match?.[1] ?? fail(`invalid release tag ${tag}`);
};

export const expectedReleaseAssetNames = (tag: string): string[] => {
  const version = releaseVersion(tag);
  return [
    `Ultra.RSS.Reader_${version}_aarch64.dmg`,
    "Ultra.RSS.Reader_aarch64.app.tar.gz",
    "Ultra.RSS.Reader_aarch64.app.tar.gz.sig",
    "Ultra.RSS.Reader.app.tar.gz.sha256",
    "cargo-licenses-darwin-aarch64.json",
    "pnpm-licenses-darwin-aarch64.json",
    "release-provenance-darwin-aarch64.json",
    `Ultra.RSS.Reader_${version}_x64-setup.exe`,
    `Ultra.RSS.Reader_${version}_x64-setup.exe.sig`,
    `Ultra.RSS.Reader_${version}_x64-setup.exe.sha256`,
    `Ultra.RSS.Reader_${version}_x64_en-US.msi`,
    `Ultra.RSS.Reader_${version}_x64_en-US.msi.sig`,
    "latest.json",
    "cargo-licenses-windows-x86_64.json",
    "pnpm-licenses-windows-x86_64.json",
    "release-provenance-windows-x86_64.json",
  ];
};

export const optionalLinuxReleaseAssetNames = (tag: string): string[] => {
  const version = releaseVersion(tag);
  return [`Ultra.RSS.Reader_${version}_amd64.deb`, `Ultra.RSS.Reader_${version}_amd64.AppImage`];
};

export const validateReleaseAssetInventory = (tag: string, observedNames: readonly string[]): string[] => {
  const coreNames = expectedReleaseAssetNames(tag);
  const linuxNames = optionalLinuxReleaseAssetNames(tag);
  const observed = new Set(observedNames);
  if (observed.size !== observedNames.length) {
    fail("release asset inventory contains duplicate names");
  }
  const linuxCount = linuxNames.filter((name) => observed.has(name)).length;
  if (linuxCount === 1) {
    fail("optional Linux release assets must include both the .deb and AppImage for this tag");
  }
  const expectedNames = linuxCount === 2 ? [...coreNames, ...linuxNames] : coreNames;
  const expected = new Set(expectedNames);
  if (
    observedNames.length !== expectedNames.length ||
    expectedNames.some((name) => !observed.has(name)) ||
    observedNames.some((name) => !expected.has(name))
  ) {
    fail("release asset inventory must contain the 16 core assets and either both optional Linux assets or neither");
  }
  return expectedNames;
};
