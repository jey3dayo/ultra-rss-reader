import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsSection } from "@/components/settings/settings-section";

describe("SettingsSection", () => {
  it("renders the shared section surface with heading, body, and note", () => {
    const { container } = render(
      <SettingsSection heading="Account" note="Keep your account details current.">
        <p>Body content</p>
      </SettingsSection>,
    );

    const surface = container.querySelector('[data-surface-card="section"]');

    expect(surface).not.toBeNull();
    expect(surface).toHaveAttribute("data-surface-card", "section");
    expect(surface).toHaveClass("rounded-[var(--radius-surface-section)]");
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText("Keep your account details current.")).toBeInTheDocument();
  });
});
