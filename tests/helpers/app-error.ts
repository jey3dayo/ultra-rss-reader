import { type AppError, AppErrorSchema } from "@/api/schemas";

export type TestUserVisibleAppError = Extract<AppError, { type: "UserVisible" }>;

export function testUserVisibleAppError(message: string): TestUserVisibleAppError {
  const error = AppErrorSchema.parse({ type: "UserVisible", message });
  if (error.type !== "UserVisible") {
    throw new Error("Expected UserVisible AppError");
  }
  return error;
}
