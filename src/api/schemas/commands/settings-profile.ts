import { z } from "zod";

export const importSettingsProfileArgs = z.strictObject({
  profileJson: z.string().trim().min(1),
});

export const exportSettingsProfileToFileArgs = z.strictObject({
  path: z.string().trim().min(1),
});
