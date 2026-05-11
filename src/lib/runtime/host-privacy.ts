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
