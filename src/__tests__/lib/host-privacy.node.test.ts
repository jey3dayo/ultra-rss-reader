import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type HostPrivacyPolicy, isHostBlockedByPolicy } from "@/lib/runtime/host-privacy";

type Verdict = "allow" | "reject";
type FixtureCase = { url: string; userNavigation: Verdict; automaticRequest: Verdict };

function isVerdict(value: unknown): value is Verdict {
  return value === "allow" || value === "reject";
}

function isFixtureCase(value: unknown): value is FixtureCase {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "userNavigation" in value &&
    isVerdict(value.userNavigation) &&
    "automaticRequest" in value &&
    isVerdict(value.automaticRequest)
  );
}

function loadCases(): FixtureCase[] {
  const fixture: unknown = JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/host-privacy/policy-cases.json"), "utf8"),
  );
  if (typeof fixture !== "object" || fixture === null || !("cases" in fixture) || !Array.isArray(fixture.cases)) {
    throw new Error("policy-cases.json must contain a cases array");
  }
  const cases: unknown[] = fixture.cases;
  if (!cases.every(isFixtureCase)) {
    throw new Error("policy-cases.json contains a malformed case");
  }
  return cases;
}

const cases = loadCases();

describe("host privacy policy shared fixture", () => {
  const policies: HostPrivacyPolicy[] = ["userNavigation", "automaticRequest"];

  for (const policy of policies) {
    it(`classifies every fixture URL for ${policy}`, () => {
      const mismatches = cases.flatMap((entry) => {
        const blocked = isHostBlockedByPolicy(new URL(entry.url).hostname, policy);
        const expected = entry[policy] === "reject";
        return blocked === expected ? [] : [`${entry.url}: expected ${entry[policy]}`];
      });
      expect(mismatches).toEqual([]);
    });
  }
});

describe("isHostBlockedByPolicy unparseable IPv6", () => {
  it.each(["not:an:ipv6", "fe80::1%25eth0", "1:2:3:4:5:6:7:8:9"])("blocks %s for both policies", (host) => {
    expect(isHostBlockedByPolicy(host, "userNavigation")).toBe(true);
    expect(isHostBlockedByPolicy(host, "automaticRequest")).toBe(true);
  });
});

describe("isHostBlockedByPolicy host spellings", () => {
  it.each([
    ["bracketed IPv6", "[::1]", true],
    ["uppercase mapped hex", "::FFFF:7F00:1", true],
    ["unbracketed mapped hex", "::ffff:7f00:1", true],
    ["dotted mapped loopback", "::ffff:127.0.0.1", true],
    ["dotted mapped 172.16/12", "::ffff:172.16.0.1", true],
    ["expanded unspecified", "0:0:0:0:0:0:0:0", true],
    ["public dotted mapped", "::ffff:8.8.8.8", false],
    ["IPv4 dotted out of range is a name, not an address", "127.0.0.256", false],
    ["repeated trailing dots", "localhost..", true],
    ["empty host", "", true],
    ["domain with IPv6-looking prefix", "fd.example.com", false],
  ])("userNavigation: %s", (_name, host, expected) => {
    expect(isHostBlockedByPolicy(host, "userNavigation")).toBe(expected);
  });

  it("automaticRequest: repeated trailing dots on .local", () => {
    expect(isHostBlockedByPolicy("reader.local..", "automaticRequest")).toBe(true);
  });
});
