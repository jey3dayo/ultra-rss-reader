import { type ChildProcess, spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Browser, chromium, type Page } from "@playwright/test";
import {
  EXPECTED_IMAGE_SIZE,
  type PlannedOutput,
  planOutputs,
  readImageSize,
  SCREENSHOT_THEMES,
  type ScreenshotTheme,
} from "./lib/store-screenshot-output.ts";

// Capture conditions. docs/store-screenshots.md explains why each value is fixed; this file is the source of truth.
const DEFAULT_PORT = 4173;
const HOST = "127.0.0.1";
const VIEWPORT = { width: 1600, height: 900 } as const;
const DEVICE_SCALE_FACTOR = 2;
// 18:00 UTC is later than every EN seed article published "today" (the latest is 16:22).
const FIXED_TIME = "2026-08-17T18:00:00Z";
const LOCALE = "en-US";
const TIMEZONE = "UTC";
const SEED_LOCALE = "en";
const SCENARIO_ID = "open-unread-showcase-article";
const EXPECTED_ACCOUNT_NAME = "Personal";
// Keep in sync with SHOWCASE_ARTICLE_ID in src/dev/scenarios/constants.ts.
const EXPECTED_ARTICLE_TITLE = "Why teams are rethinking their end-to-end test suites this year";
const FORBIDDEN_BRAND_PATTERN = /freshrss/i;
// Tuned so the JPG size lands near the screenshots it replaces; body text was checked to stay crisp at this value.
const JPEG_QUALITY = 55;
const SERVER_READY_TIMEOUT_MS = 60_000;
const SERVER_POLL_INTERVAL_MS = 250;
const SERVER_POLL_REQUEST_TIMEOUT_MS = 3000;
// The first load after a cold vite start transforms every module and can take over a minute on slower disks.
const PAGE_READY_TIMEOUT_MS = 120_000;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type CliOptions = { publish: boolean; port: number };

function parseArgs(argv: string[]): CliOptions {
  let publish = false;
  let port = DEFAULT_PORT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      // pnpm forwards the separator in `pnpm run capture:screenshots -- --port N`.
      continue;
    }
    if (arg === "--publish") {
      publish = true;
    } else if (arg === "--port") {
      port = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--port=")) {
      port = Number(arg.slice("--port=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--port must be an integer between 1 and 65535.");
  }
  return { publish, port };
}

function resolveViteBin(): string {
  const require = createRequire(import.meta.url);
  return path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

type ViteServer = { child: ChildProcess; exited: Promise<number | null>; stop: () => void };

// Runs vite with the same arguments as `mise run app:dev:browser`, without a shell, so Windows and macOS behave alike.
async function startVite(port: number): Promise<ViteServer> {
  if (await isPortInUse(port)) {
    throw new Error(
      `Port ${port} is already in use. A server started with other env vars would capture a different seed; ` +
        "pass a free port, e.g. `pnpm run capture:screenshots -- --port 4180`.",
    );
  }

  const child = spawn(process.execPath, [resolveViteBin(), "--host", HOST, "--port", String(port), "--strictPort"], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, VITE_DEV_MOCK_LOCALE: SEED_LOCALE, VITE_DEV_INTENT: SCENARIO_ID },
  });
  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  const spawnFailed = new Promise<never>((_, reject) => child.once("error", reject));

  const server: ViteServer = {
    child,
    exited,
    stop: () => {
      if (child.exitCode === null) {
        child.kill();
      }
    },
  };

  const ready = (async () => {
    const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        // A first request can stall while vite warms up; a fresh connection after a timeout goes through.
        const response = await fetch(`http://${HOST}:${port}/`, {
          signal: AbortSignal.timeout(SERVER_POLL_REQUEST_TIMEOUT_MS),
        });
        if (response.ok) {
          return;
        }
      } catch {
        // Not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_INTERVAL_MS));
    }
    throw new Error(`vite did not become ready on port ${port} within ${SERVER_READY_TIMEOUT_MS / 1000}s.`);
  })();
  const earlyExit = exited.then((code) => {
    throw new Error(`vite exited before it was ready (code ${code}). Check that port ${port} is free.`);
  });

  try {
    await Promise.race([ready, earlyExit, spawnFailed]);
  } catch (error) {
    server.stop();
    throw error;
  }
  return server;
}

type PageFindings = {
  sidebarHeading: string | null;
  articleHeading: string | null;
  selectedNavLabels: string[];
  darkClass: boolean;
  agentationVisible: boolean;
  toastVisible: boolean;
  bodyText: string;
};

async function collectFindings(page: Page): Promise<PageFindings> {
  return page.evaluate(() => {
    const headings = [...document.querySelectorAll("h1")];
    const toastNodes = document.querySelectorAll("[data-testid='app-toast']");
    return {
      sidebarHeading: headings[0]?.textContent?.trim() ?? null,
      articleHeading: headings.at(-1)?.textContent?.trim() ?? null,
      selectedNavLabels: [...document.querySelectorAll("button[data-active-pane]")].map(
        (node) => node.textContent?.trim() ?? "",
      ),
      darkClass: document.documentElement.classList.contains("dark"),
      agentationVisible: document.querySelector(".ultra-agentation-toolbar, [data-agentation-toolbar]") !== null,
      toastVisible: toastNodes.length > 0 && [...toastNodes].some((node) => (node.textContent ?? "").trim().length > 0),
      bodyText: document.body.innerText,
    };
  });
}

function validateFindings(theme: ScreenshotTheme, findings: PageFindings): string[] {
  const problems: string[] = [];
  if (findings.sidebarHeading !== EXPECTED_ACCOUNT_NAME) {
    problems.push(`sidebar heading is "${findings.sidebarHeading}", expected "${EXPECTED_ACCOUNT_NAME}"`);
  }
  if (FORBIDDEN_BRAND_PATTERN.test(findings.bodyText)) {
    problems.push("the page text contains a third-party product name (FreshRSS)");
  }
  if (findings.articleHeading !== EXPECTED_ARTICLE_TITLE) {
    problems.push(`article heading is "${findings.articleHeading}", expected "${EXPECTED_ARTICLE_TITLE}"`);
  }
  if (!findings.selectedNavLabels.some((label) => /^unread\b/i.test(label))) {
    problems.push(`the Unread smart view is not selected (selected: ${JSON.stringify(findings.selectedNavLabels)})`);
  }
  if (findings.darkClass !== (theme === "dark")) {
    problems.push(`the html dark class does not match the "${theme}" color scheme`);
  }
  if (findings.agentationVisible) {
    problems.push("the dev-only Agentation toolbar is visible");
  }
  if (findings.toastVisible) {
    problems.push("a toast is visible");
  }
  return problems;
}

async function capture(
  browser: Browser,
  port: number,
  theme: ScreenshotTheme,
  formats: Set<PlannedOutput["format"]>,
): Promise<Map<PlannedOutput["format"], Buffer>> {
  const origin = `http://${HOST}:${port}`;
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: theme,
    locale: LOCALE,
    timezoneId: TIMEZONE,
    reducedMotion: "reduce",
  });
  try {
    // Block everything except the local dev server so favicons fall back to initials and nothing real is captured.
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:")) {
        return route.continue();
      }
      return route.abort();
    });

    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.clock.setFixedTime(FIXED_TIME);
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: PAGE_READY_TIMEOUT_MS });

    await page
      .waitForFunction(
        (title) => [...document.querySelectorAll("h1")].some((node) => node.textContent?.trim() === title),
        EXPECTED_ARTICLE_TITLE,
        { timeout: PAGE_READY_TIMEOUT_MS },
      )
      .catch(() => {
        // The inspection below reports what is actually on screen.
      });
    await page.evaluate(() => document.fonts.ready);

    const findings = await collectFindings(page);
    const problems = validateFindings(theme, findings);
    if (pageErrors.length > 0) {
      problems.push(`page errors: ${pageErrors.join("; ")}`);
    }
    if (problems.length > 0) {
      throw new Error(`Pre-capture inspection failed for the ${theme} theme:\n- ${problems.join("\n- ")}`);
    }

    const buffers = new Map<PlannedOutput["format"], Buffer>();
    for (const format of formats) {
      buffers.set(
        format,
        await page.screenshot({
          type: format === "png" ? "png" : "jpeg",
          ...(format === "jpg" ? { quality: JPEG_QUALITY } : {}),
          animations: "disabled",
          caret: "hide",
        }),
      );
    }
    return buffers;
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const { publish, port } = parseArgs(process.argv.slice(2));
  const outputs = planOutputs(process.platform, publish ? "publish" : "trial");

  const server = await startVite(port);
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    const written: string[] = [];

    for (const theme of SCREENSHOT_THEMES) {
      const themeOutputs = outputs.filter((output) => output.theme === theme);
      const buffers = await capture(browser, port, theme, new Set(themeOutputs.map((output) => output.format)));

      for (const output of themeOutputs) {
        const buffer = buffers.get(output.format);
        if (!buffer) {
          throw new Error(`No ${output.format} buffer was captured for ${output.path}.`);
        }
        const size = readImageSize(buffer);
        if (size.width !== EXPECTED_IMAGE_SIZE.width || size.height !== EXPECTED_IMAGE_SIZE.height) {
          throw new Error(
            `${output.path} is ${size.width}x${size.height}, expected ${EXPECTED_IMAGE_SIZE.width}x${EXPECTED_IMAGE_SIZE.height}.`,
          );
        }

        const target = path.resolve(REPO_ROOT, output.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, buffer);
        written.push(output.path);

        for (const copy of output.copyTo) {
          const copyTarget = path.resolve(REPO_ROOT, copy);
          await mkdir(path.dirname(copyTarget), { recursive: true });
          await copyFile(target, copyTarget);
          written.push(copy);
        }
      }
    }

    console.log(`[capture-store-screenshots] wrote ${written.length} file(s):`);
    for (const file of written) {
      console.log(`  ${file}`);
    }
  } finally {
    await browser?.close();
    server.stop();
  }
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("[capture-store-screenshots]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
