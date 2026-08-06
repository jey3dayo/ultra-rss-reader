import * as v from "valibot";
import * as s from "@/api/schemas/validation";

export const importSettingsProfileArgs = s.strictObject({
  profileJson: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

export const exportSettingsProfileToFileArgs = s.strictObject({
  path: v.pipe(v.string(), v.trim(), v.minLength(1)),
});
