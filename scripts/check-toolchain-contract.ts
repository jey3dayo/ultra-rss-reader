import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const miseToml = readFileSync("mise.toml", "utf8");

const expectedNode = packageJson.engines?.node;
const expectedPnpm = packageJson.engines?.pnpm;
const packageManagerPnpm = packageJson.packageManager?.match(/^pnpm@(.+)$/)?.[1];
const miseNode = miseToml.match(/^node = "([^"]+)"$/m)?.[1];
const misePnpm = miseToml.match(/^"npm:pnpm" = "([^"]+)"$/m)?.[1];

const failures: string[] = [];
if (!expectedNode || !expectedPnpm || !packageManagerPnpm) {
  failures.push("package.json must define engines.node, engines.pnpm, and packageManager pnpm@version");
}
if (expectedNode !== miseNode) {
  failures.push(`Node version drift: package.json engines.node=${expectedNode} mise.toml tools.node=${miseNode}`);
}
if (expectedPnpm !== packageManagerPnpm || expectedPnpm !== misePnpm) {
  failures.push(
    `pnpm version drift: engines.pnpm=${expectedPnpm} packageManager=${packageManagerPnpm} mise.toml=${misePnpm}`,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`toolchain contract ok: node ${expectedNode}, pnpm ${expectedPnpm}`);
