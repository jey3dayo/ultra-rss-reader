import { Result } from "@praha/byethrow";
import type { DevRuntimeOptions } from "@/api/tauri-commands";
import { getDevRuntimeOptions } from "@/api/tauri-commands";
import { type DevScenarioId, isDevScenarioId } from "@/dev/scenario-ids";
import { hasTauriRuntime } from "@/lib/window/window-chrome";

export type DevIntent = DevScenarioId | null;
export type DevWindowSize = {
  width: number | null;
  height: number | null;
};

const DEV_INTENT_ENV_KEYS = ["VITE_DEV_INTENT"] as const;
const DEV_WEB_URL_ENV_KEYS = ["VITE_DEV_WEB_URL"] as const;
const DEV_WINDOW_WIDTH_ENV_KEYS = ["VITE_DEV_WINDOW_WIDTH"] as const;
const DEV_WINDOW_HEIGHT_ENV_KEYS = ["VITE_DEV_WINDOW_HEIGHT"] as const;
let runtimeDevOptionsCache: DevRuntimeOptions | null | undefined;
let runtimeDevOptionsErrorCache: LoadDevRuntimeOptionsError | null = null;
let runtimeDevOptionsPromise: Result.ResultAsync<DevRuntimeOptions, LoadDevRuntimeOptionsError> | null = null;

type ParsePositiveIntegerError = "missing_value" | "invalid_integer" | "non_positive_integer";
type ParseDevIntentError = "missing_value" | "unknown_dev_intent";
export type LoadDevRuntimeOptionsError = "not_dev_build" | "tauri_unavailable" | "request_failed";
type ReadDevWindowSizeFieldState =
  | { kind: "missing" }
  | { kind: "invalid"; reason: ParsePositiveIntegerError }
  | { kind: "value"; value: number };

function readFirstNonEmptyEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function parsePositiveIntegerResult(value: string | undefined): Result.Result<number, ParsePositiveIntegerError> {
  if (!value) {
    return Result.fail("missing_value");
  }

  if (!/^\d+$/.test(value)) {
    return Result.fail("invalid_integer");
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Result.fail("non_positive_integer");
  }

  return Result.succeed(parsed);
}

function resolveDevWindowSizeFieldState(value: string | undefined): ReadDevWindowSizeFieldState {
  const parsed = parsePositiveIntegerResult(value);

  if (Result.isSuccess(parsed)) {
    return { kind: "value", value: Result.unwrap(parsed) };
  }

  const error = Result.unwrapError(parsed);
  if (error === "missing_value") {
    return { kind: "missing" };
  }

  return { kind: "invalid", reason: error };
}

function parsePositiveIntegerOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function readRuntimeDevIntent(): DevIntent {
  return parseDevIntent(runtimeDevOptionsCache?.dev_intent ?? undefined);
}

function readRuntimeDevWebUrl(): string | null {
  const value = runtimeDevOptionsCache?.dev_web_url;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRuntimeDevWindowSize(): DevWindowSize | null {
  const width = parsePositiveIntegerOrNull(runtimeDevOptionsCache?.dev_window_width);
  const height = parsePositiveIntegerOrNull(runtimeDevOptionsCache?.dev_window_height);

  if (width === null && height === null) {
    return null;
  }

  return {
    width,
    height,
  };
}

function parseDevIntentResult(value: string | undefined): Result.Result<DevIntent, ParseDevIntentError> {
  if (!value) {
    return Result.fail("missing_value");
  }

  return isDevScenarioId(value) ? Result.succeed(value) : Result.fail("unknown_dev_intent");
}

function resolveLoadedDevRuntimeOptions(
  result: Awaited<ReturnType<typeof getDevRuntimeOptions>>,
): Result.Result<DevRuntimeOptions, LoadDevRuntimeOptionsError> {
  if (Result.isFailure(result)) {
    console.warn("Failed to load runtime dev options:", Result.unwrapError(result));
    return Result.fail("request_failed");
  }

  return Result.succeed(Result.unwrap(result));
}

export function parseDevIntent(value: string | undefined): DevIntent {
  const intent = parseDevIntentResult(value);
  return Result.isSuccess(intent) ? Result.unwrap(intent) : null;
}

export function readDevIntent(): DevIntent {
  if (!import.meta.env.DEV) {
    return null;
  }

  return parseDevIntent(readFirstNonEmptyEnv(DEV_INTENT_ENV_KEYS)) ?? readRuntimeDevIntent();
}

export function readDevWebUrl(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  return readFirstNonEmptyEnv(DEV_WEB_URL_ENV_KEYS) ?? readRuntimeDevWebUrl();
}

export function readDevWindowSize(): DevWindowSize | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const widthState = resolveDevWindowSizeFieldState(readFirstNonEmptyEnv(DEV_WINDOW_WIDTH_ENV_KEYS));
  const heightState = resolveDevWindowSizeFieldState(readFirstNonEmptyEnv(DEV_WINDOW_HEIGHT_ENV_KEYS));

  if (widthState.kind === "missing" && heightState.kind === "missing") {
    return readRuntimeDevWindowSize();
  }

  if (widthState.kind !== "value" && heightState.kind !== "value") {
    return null;
  }

  return {
    width: widthState.kind === "value" ? widthState.value : null,
    height: heightState.kind === "value" ? heightState.value : null,
  };
}

export async function loadDevRuntimeOptionsResult(): Result.ResultAsync<DevRuntimeOptions, LoadDevRuntimeOptionsError> {
  if (!import.meta.env.DEV) {
    runtimeDevOptionsCache = null;
    runtimeDevOptionsErrorCache = "not_dev_build";
    return Result.fail("not_dev_build");
  }

  if (runtimeDevOptionsCache !== undefined) {
    return runtimeDevOptionsCache
      ? Result.succeed(runtimeDevOptionsCache)
      : Result.fail(runtimeDevOptionsErrorCache ?? "request_failed");
  }

  if (!hasTauriRuntime()) {
    runtimeDevOptionsCache = null;
    runtimeDevOptionsErrorCache = "tauri_unavailable";
    return Result.fail("tauri_unavailable");
  }

  runtimeDevOptionsPromise ??= getDevRuntimeOptions().then((result) => {
    const resolved = resolveLoadedDevRuntimeOptions(result);
    if (Result.isFailure(resolved)) {
      runtimeDevOptionsCache = null;
      runtimeDevOptionsErrorCache = Result.unwrapError(resolved);
      return resolved;
    }

    const options = Result.unwrap(resolved);
    runtimeDevOptionsCache = options;
    runtimeDevOptionsErrorCache = null;
    return resolved;
  });

  const resolved = await runtimeDevOptionsPromise;
  runtimeDevOptionsPromise = null;
  return resolved;
}

export async function loadDevRuntimeOptions(): Promise<DevRuntimeOptions | null> {
  const result = await loadDevRuntimeOptionsResult();
  return Result.isSuccess(result) ? Result.unwrap(result) : null;
}

export function resetDevRuntimeOptionsCacheForTests(): void {
  runtimeDevOptionsCache = undefined;
  runtimeDevOptionsErrorCache = null;
  runtimeDevOptionsPromise = null;
}
