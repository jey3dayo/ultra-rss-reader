import { z } from "zod";

export const importSettingsProfileArgs = z
  .object({
    profileJson: z.string().trim().min(1),
  })
  .strict();

export const exportSettingsProfileToFileArgs = z
  .object({
    path: z.string().trim().min(1),
  })
  .strict();
