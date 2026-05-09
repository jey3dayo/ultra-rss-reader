import { z } from "zod";

const appErrorMessageSchema = z.string().refine((message) => message.trim().length > 0, {
  message: "AppError message must not be empty",
});

export const AppErrorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("UserVisible"), message: appErrorMessageSchema }),
  z.object({ type: z.literal("Retryable"), message: appErrorMessageSchema }),
]);

export type AppError = z.infer<typeof AppErrorSchema>;
