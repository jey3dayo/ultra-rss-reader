import { describe, expect, it } from "vitest";
import { mockArticles } from "@/dev-mock-data";

describe("dev mock data", () => {
  it("does not include the known ORB-blocked thumbnail URL", () => {
    const blockedUrl = "https://images.unsplash.com/photo-1529927120475-1f638e42f5c3?w=400&h=300&fit=crop";

    expect(mockArticles.some((article) => article.thumbnail === blockedUrl)).toBe(false);
  });
});
