import { describe, expect, it } from "vitest";
import {
  findCargoLockPackageVersionOwners,
  findMsixIdentityVersionOwners,
  findTopLevelJsonVersionOwners,
} from "../scripts/release/lib/version-owners.ts";

describe("release version owner parsers", () => {
  it("finds escaped top-level JSON keys and values while preserving source ranges", () => {
    const source = String.raw`{"note":"contains \"version\" and braces {}","nested":{"version":"nested"},"vers\u0069on" : "1.2.3","version":"2.3.4"}`;
    const owners = findTopLevelJsonVersionOwners(source);

    expect(owners.map(({ version }) => version)).toEqual(["1.2.3", "2.3.4"]);
    expect(source.slice(owners[0]?.start, owners[0]?.end)).toBe('"1.2.3"');
    expect(source.slice(owners[1]?.start, owners[1]?.end)).toBe('"2.3.4"');

    const firstOwner = owners[0];
    if (!firstOwner) throw new Error("first JSON version owner is missing");
    const updated = `${source.slice(0, firstOwner.start)}"1.2.4"${source.slice(firstOwner.end)}`;
    expect(updated).toContain(String.raw`"vers\u0069on" : "1.2.4"`);
  });

  it("counts duplicate escaped keys and rejects non-string top-level version owners", () => {
    expect(findTopLevelJsonVersionOwners(String.raw`{"version":"1.2.3","vers\u0069on":"1.2.3"}`)).toHaveLength(2);
    expect(() => findTopLevelJsonVersionOwners('{"version": 1}')).toThrow("JSON version owner must be a string");
  });

  it("returns Cargo.lock owner counts and exact value ranges", () => {
    const source =
      '[[package]]\nname = "dependency"\nversion = "1.0.0"\n\n' +
      '[[package]]\nname = "ultra-rss-reader"\nversion  =  "0.64.4"\n';
    const owners = findCargoLockPackageVersionOwners(source);

    expect(owners).toHaveLength(1);
    expect(owners[0]?.nameCount).toBe(1);
    expect(owners[0]?.versions).toHaveLength(1);
    const version = owners[0]?.versions[0];
    if (!version) throw new Error("Cargo.lock version owner is missing");
    expect(version.version).toBe("0.64.4");
    expect(source.slice(version.start, version.end)).toBe(version.version);
  });

  it("finds MSIX version attributes only inside Identity elements", () => {
    const source = '<Other Version="ignored"/><Identity Name="Reader" Version="1.2.3.0" ProcessorArchitecture="x64" />';
    const identities = findMsixIdentityVersionOwners(source);

    expect(identities).toHaveLength(1);
    expect(identities[0]?.versions).toHaveLength(1);
    const version = identities[0]?.versions[0];
    if (!version) throw new Error("MSIX version owner is missing");
    expect(version.version).toBe("1.2.3.0");
    expect(source.slice(version.start, version.end)).toBe(version.version);
  });
});
