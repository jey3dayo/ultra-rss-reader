import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const miseToml = readFileSync("mise.toml", "utf8");
const expectedNode = String(packageJson.engines?.node ?? "");
const expectedPnpm = String(packageJson.engines?.pnpm ?? "");
const packageManagerPnpm = packageJson.packageManager?.match(/^pnpm@(.+)$/)?.[1] ?? "";
const miseNode = miseToml.match(/^node = "([^"]+)"$/m)?.[1] ?? "";
const actualPnpm = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
const failures = [];

if (expectedNode !== miseNode) {
  failures.push(`local mise Node version drift: package.json engines.node=${expectedNode}, mise.toml=${miseNode}`);
}
if (expectedPnpm !== packageManagerPnpm) {
  failures.push(`local pnpm version drift: engines.pnpm=${expectedPnpm}, packageManager=${packageManagerPnpm}`);
}
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
