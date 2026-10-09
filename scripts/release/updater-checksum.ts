type UpdaterChecksum = {
  artifactName: string;
  sha256: string;
};

type UpdaterChecksumParseResult = { ok: true; value: UpdaterChecksum } | { ok: false; error: string };

export const parseUpdaterChecksum = (checksumLine: string): UpdaterChecksumParseResult => {
  const checksumParts = checksumLine.trim().match(/^(\S+)\s+(.*)$/);
  if (!checksumParts) {
    return { ok: false, error: "invalid updater checksum line" };
  }

  const [, sha256, artifactName] = checksumParts;
  if (!artifactName) {
    return { ok: false, error: "missing updater checksum artifact name" };
  }
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    return { ok: false, error: `invalid updater checksum digest for ${artifactName}` };
  }

  return { ok: true, value: { artifactName, sha256 } };
};
