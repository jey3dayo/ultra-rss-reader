export function isPrivateIpv4Host(host: string): boolean {
  const octets = host.split(".");
  if (octets.length !== 4) {
    return false;
  }

  const values = octets.map((octet) => (/^\d{1,3}$/u.test(octet) ? Number(octet) : Number.NaN));
  if (values.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first = 0, second = 0] = values;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function stripIpv6Brackets(host: string): string {
  return host.trim().toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
}

// WHATWG URL normalizes ::ffff:a.b.c.d to ::ffff:hhhh:hhhh, so the dotted form alone misses real hostnames.
export function isPrivateIpv4MappedIpv6Host(host: string): boolean {
  const mapped = /^::ffff:(.+)$/u.exec(stripIpv6Brackets(host));
  const tail = mapped?.[1];
  if (tail === undefined) {
    return false;
  }

  const groups = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(tail);
  if (!groups) {
    return isPrivateIpv4Host(tail);
  }

  const high = Number.parseInt(groups[1] ?? "", 16);
  const low = Number.parseInt(groups[2] ?? "", 16);
  return isPrivateIpv4Host(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
}

export function isUnspecifiedIpv6Host(host: string): boolean {
  return /^(?:::0{0,4}|(?:0{1,4}:){7}0{1,4})$/u.test(stripIpv6Brackets(host));
}
