import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const expectedNode = String(packageJson.engines?.node ?? "");
const expectedPnpm = String(packageJson.engines?.pnpm ?? "");
const actualPnpm = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
const failures = [];

if (process.versions.node !== expectedNode) {
  failures.push(`CI Node version drift: expected ${expectedNode}, got ${process.versions.node}`);
}
if (actualPnpm !== expectedPnpm) {
  failures.push(`CI pnpm version drift: expected ${expectedPnpm}, got ${actualPnpm}`);
}
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`CI image toolchain contract ok: node ${process.versions.node}, pnpm ${actualPnpm}`);
