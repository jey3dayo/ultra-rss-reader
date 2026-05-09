import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("omits falsey class inputs and keeps truthy class names", () => {
    expect(cn("inline-flex", false && "hidden", null, undefined, 0, "", "items-center")).toBe(
      "inline-flex items-center",
    );
  });

  it("resolves Tailwind class conflicts with the later utility", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
