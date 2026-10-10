import { describe, expect, it } from "vitest";
import { isPrivateIpv4MappedIpv6Host, isUnspecifiedIpv6Host } from "@/lib/runtime/host-privacy";

describe("isPrivateIpv4MappedIpv6Host", () => {
  it.each([
    ["hex loopback", "::ffff:7f00:1", true],
    ["hex 10/8", "::ffff:a00:1", true],
    ["hex 192.168/16", "::ffff:c0a8:101", true],
    ["hex link-local", "::ffff:a9fe:101", true],
    ["hex 172.16/12", "::ffff:ac10:1", true],
    ["hex 0/8", "::ffff:0:1", true],
    ["dotted loopback", "::ffff:127.0.0.1", true],
    ["dotted private", "::ffff:10.1.2.3", true],
    ["uppercase hex", "::FFFF:7F00:1", true],
    ["bracketed hex", "[::ffff:7f00:1]", true],
    ["public hex", "::ffff:808:808", false],
    ["public dotted", "::ffff:8.8.8.8", false],
    ["no mapped prefix", "7f00:1", false],
    ["prefix only", "::ffff:", false],
    ["single group", "::ffff:7f00", false],
    ["three groups", "::ffff:7f00:1:2", false],
    ["non-hex group", "::ffff:zz00:1", false],
    ["group over 16 bits", "::ffff:17f00:1", false],
    ["dotted out of range", "::ffff:127.0.0.256", false],
    ["dotted too short", "::ffff:127.0.1", false],
    ["different embedding prefix", "::fffe:7f00:1", false],
    ["plain IPv4", "127.0.0.1", false],
    ["domain", "example.com", false],
  ])("classifies %s", (_name, host, expected) => {
    expect(isPrivateIpv4MappedIpv6Host(host)).toBe(expected);
  });
});

describe("isUnspecifiedIpv6Host", () => {
  it.each([
    ["::", true],
    ["[::]", true],
    ["::0", true],
    ["0:0:0:0:0:0:0:0", true],
    ["::1", false],
    ["::2", false],
    ["example.com", false],
  ])("classifies %s", (host, expected) => {
    expect(isUnspecifiedIpv6Host(host)).toBe(expected);
  });
});
