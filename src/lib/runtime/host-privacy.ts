export type HostPrivacyPolicy = "userNavigation" | "automaticRequest";

type Ipv4Octets = readonly [number, number, number, number];

function parseIpv4(host: string): Ipv4Octets | null {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const values = parts.map((part) => (/^\d{1,3}$/u.test(part) ? Number(part) : Number.NaN));
  const [a, b, c, d] = values;
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    return null;
  }
  return [a, b, c, d].every((octet) => octet <= 255) ? [a, b, c, d] : null;
}

function parseHextet(part: string): number | null {
  return /^[0-9a-f]{1,4}$/u.test(part) ? Number.parseInt(part, 16) : null;
}

function parseIpv6Groups(parts: readonly string[]): number[] | null {
  const groups: number[] = [];
  for (const [index, part] of parts.entries()) {
    const isLast = index === parts.length - 1;
    const embedded = isLast && part.includes(".") ? parseIpv4(part) : null;
    if (embedded !== null) {
      groups.push(embedded[0] * 256 + embedded[1], embedded[2] * 256 + embedded[3]);
      continue;
    }
    const group = parseHextet(part);
    if (group === null) {
      return null;
    }
    groups.push(group);
  }
  return groups;
}

function parseIpv6(host: string): number[] | null {
  const halves = host.split("::");
  if (halves.length > 2) {
    return null;
  }
  const [head = "", tail] = halves;
  const headGroups = head === "" ? [] : parseIpv6Groups(head.split(":"));
  if (tail === undefined) {
    return headGroups?.length === 8 ? headGroups : null;
  }
  const tailGroups = tail === "" ? [] : parseIpv6Groups(tail.split(":"));
  if (headGroups === null || tailGroups === null || headGroups.length + tailGroups.length > 7) {
    return null;
  }
  return [...headGroups, ...new Array<number>(8 - headGroups.length - tailGroups.length).fill(0), ...tailGroups];
}

function isBlockedIpv4([a, b]: Ipv4Octets, policy: HostPrivacyPolicy): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (policy === "automaticRequest" && a === 100 && b >= 64 && b <= 127)
  );
}

function isBlockedIpv6(groups: readonly number[], policy: HostPrivacyPolicy): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  const leadingZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (leadingZero && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) {
    return true;
  }
  if ((g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80) {
    return true;
  }
  return leadingZero && g5 === 0xffff && isBlockedIpv4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff], policy);
}

// `host` is a WHATWG-normalized URL hostname (brackets allowed). Specified by
// tests/fixtures/host-privacy/policy-cases.json, shared with src-tauri/src/domain/url_policy.rs.
export function isHostBlockedByPolicy(host: string, policy: HostPrivacyPolicy): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "").replace(/\.+$/u, "");
  if (normalized.length === 0 || normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  const ipv4 = parseIpv4(normalized);
  if (ipv4 !== null) {
    return isBlockedIpv4(ipv4, policy);
  }
  if (normalized.includes(":")) {
    const ipv6 = parseIpv6(normalized);
    return ipv6 !== null && isBlockedIpv6(ipv6, policy);
  }

  return policy === "automaticRequest" && (!normalized.includes(".") || normalized.endsWith(".local"));
}
