import { z } from "zod";

export const AppErrorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("UserVisible"), message: z.string() }),
  z.object({ type: z.literal("Retryable"), message: z.string() }),
]);

export type AppError = z.infer<typeof AppErrorSchema>;
