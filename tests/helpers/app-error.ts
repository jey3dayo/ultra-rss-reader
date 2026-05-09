import { type AppError, AppErrorSchema } from "@/api/schemas";

export type TestUserVisibleAppError = Extract<AppError, { type: "UserVisible" }>;
export type TestRetryableAppError = Extract<AppError, { type: "Retryable" }>;

export function testUserVisibleAppError(message: string): TestUserVisibleAppError {
  const error = AppErrorSchema.parse({ type: "UserVisible", message });
  if (error.type !== "UserVisible") {
    throw new Error("Expected UserVisible AppError");
  }
  return error;
}

export function testRetryableAppError(message: string): TestRetryableAppError {
  const error = AppErrorSchema.parse({ type: "Retryable", message });
  if (error.type !== "Retryable") {
    throw new Error("Expected Retryable AppError");
  }
  return error;
}
