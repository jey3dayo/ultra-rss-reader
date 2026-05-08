import { describe, expect, it } from "vitest";
import { getOptionLabelByValue } from "@/lib/ui/options";

describe("getOptionLabelByValue", () => {
  const options = [
    { value: "standard", label: "Standard" },
    { value: "preview", label: "Preview" },
  ] as const;

  it("resolves known option labels", () => {
    expect(getOptionLabelByValue(options, "preview")).toBe("Preview");
  });

  it("falls back to raw unknown values and an empty null label", () => {
    expect(getOptionLabelByValue(options, "custom")).toBe("custom");
    expect(getOptionLabelByValue(options, null)).toBe("");
  });

  it("resolves empty option labels for null and empty values", () => {
    const optionsWithEmpty = [{ value: "", label: "Use default" }, ...options] as const;

    expect(getOptionLabelByValue(optionsWithEmpty, "")).toBe("Use default");
    expect(getOptionLabelByValue(optionsWithEmpty, null)).toBe("Use default");
  });
});
