import { createHash, createPublicKey, verify as verifyEd25519 } from "node:crypto";

const fail = (message: string): never => {
  throw new Error(message);
};

const decodeBase64 = (value: string, label: string): Buffer => {
  const valid = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
  const bytes = Buffer.from(value, "base64");
  if (!valid || value.length === 0 || bytes.toString("base64") !== value) {
    return fail(`${label} is not canonical base64`);
  }
  return bytes;
};

export const decodeConfiguredUpdaterPublicKey = (encoded: string): string => {
  const decoded = decodeBase64(encoded, "configured updater public key").toString("utf8");
  if (!decoded.endsWith("\n")) {
    return fail("configured updater public key is malformed");
  }
  return decoded.slice(0, -1);
};

const publicKeyFromText = (text: string, expectedKeyId: Uint8Array) => {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  if (lines.length !== 2 || !lines[0].startsWith("untrusted comment: ")) {
    return fail("Minisign public key is malformed");
  }
  const keyBytes = decodeBase64(lines[1], "Minisign public key");
  const algorithm = keyBytes.subarray(0, 2);
  if (keyBytes.length !== 42 || !(algorithm.equals(Buffer.from("Ed")) || algorithm.equals(Buffer.from("ED")))) {
    return fail("Minisign public key has an unsupported algorithm or length");
  }
  const keyId = keyBytes.subarray(2, 10);
  if (!keyId.equals(expectedKeyId)) {
    return fail("Minisign signature key id does not match the updater public key");
  }
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({ key: Buffer.concat([spkiPrefix, keyBytes.subarray(10)]), format: "der", type: "spki" });
};

export const verifyMinisignSignature = (data: Uint8Array, signatureText: string, publicKeyText: string): void => {
  const encodedText = signatureText.replace(/\r?\n$/, "");
  if (encodedText.includes("\n") || encodedText.includes("\r")) {
    fail("Minisign signature is malformed");
  }
  const decodedText = decodeBase64(encodedText, "Minisign signature").toString("utf8");
  const lines = decodedText.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  if (lines.length !== 4 || !lines[0].startsWith("untrusted comment: ") || !lines[2].startsWith("trusted comment: ")) {
    fail("Minisign signature is malformed");
  }
  const signed = decodeBase64(lines[1], "Minisign signature");
  const global = decodeBase64(lines[3], "Minisign global signature");
  if (signed.length !== 74 || global.length !== 64 || !signed.subarray(0, 2).equals(Buffer.from("ED"))) {
    fail("Minisign signature must use the prehashed ED format");
  }
  const publicKey = publicKeyFromText(publicKeyText, signed.subarray(2, 10));
  const primarySignature = signed.subarray(10);
  const digest = createHash("blake2b512").update(data).digest();
  if (!verifyEd25519(null, digest, publicKey, primarySignature)) {
    fail("Minisign artifact signature is invalid");
  }
  const trustedComment = Buffer.from(lines[2].slice("trusted comment: ".length), "utf8");
  if (!verifyEd25519(null, Buffer.concat([primarySignature, trustedComment]), publicKey, global)) {
    fail("Minisign trusted-comment signature is invalid");
  }
};
