import { parse } from "valibot";
import { type AppError, AppErrorSchema } from "@/api/schemas";

export type TestUserVisibleAppError = Extract<AppError, { type: "UserVisible" }>;
export type TestRetryableAppError = Extract<AppError, { type: "Retryable" }>;
export type TestDiagnosticsAppError = Extract<AppError, { type: "Diagnostics" }>;

export function testUserVisibleAppError(message: string): TestUserVisibleAppError {
  const error = parse(AppErrorSchema, { type: "UserVisible", message });
  if (error.type !== "UserVisible") {
    throw new Error("Expected UserVisible AppError");
  }
  return error;
}

export function testRetryableAppError(message: string): TestRetryableAppError {
  const error = parse(AppErrorSchema, { type: "Retryable", message });
  if (error.type !== "Retryable") {
    throw new Error("Expected Retryable AppError");
  }
  return error;
}

export function testDiagnosticsAppError(message: string): TestDiagnosticsAppError {
  const error = parse(AppErrorSchema, { type: "Diagnostics", message });
  if (error.type !== "Diagnostics") {
    throw new Error("Expected Diagnostics AppError");
  }
  return error;
}
