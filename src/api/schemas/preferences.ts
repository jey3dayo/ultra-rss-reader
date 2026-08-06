import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import {
  isReservedUnknownPreferenceKey,
  isRetiredBackendPassthroughPreferenceKey,
  isValidPreferenceValue,
  preferenceKeyMaxLength,
  preferenceValueMaxUtf8Bytes,
} from "@/schemas/preference-values";

const textEncoder = new TextEncoder();

export const PreferencesDtoSchema = v.pipe(
  s.record(v.string(), v.string(), "Expected preferences to be an object"),
  v.rawCheck(({ dataset, addIssue }: v.RawCheckContext<Record<string, string>>) => {
    if (!dataset.typed) {
      return;
    }

    const preferences = dataset.value;
    for (const [key, value] of Object.entries(preferences)) {
      const path: v.ObjectPathItem = {
        type: "object",
        origin: "value",
        input: preferences,
        key,
        value,
      };

      if (key.trim().length === 0) {
        addIssue({ message: "Preference key must not be blank", path: [path] });
      }

      if (key.length > preferenceKeyMaxLength) {
        addIssue({ message: `Preference key must be ${preferenceKeyMaxLength} characters or less`, path: [path] });
      }

      if (isReservedUnknownPreferenceKey(key)) {
        addIssue({ message: `Unknown preference key uses a reserved prefix: ${key}`, path: [path] });
      }

      if (isRetiredBackendPassthroughPreferenceKey(key)) {
        addIssue({ message: `Preference key is retired: ${key}`, path: [path] });
      }

      if (!isValidPreferenceValue(key, value)) {
        addIssue({ message: `Invalid value for preference key: ${key}`, path: [path] });
      }

      if (textEncoder.encode(value).length > preferenceValueMaxUtf8Bytes) {
        addIssue({
          message: `Preference value must be ${preferenceValueMaxUtf8Bytes} UTF-8 bytes or less`,
          path: [path],
        });
      }
    }
  }),
);

export type PreferencesDto = v.InferOutput<typeof PreferencesDtoSchema>;
