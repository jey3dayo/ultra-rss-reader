import { createElement } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import {
  createSampleAccounts,
  type MutableTestFixture,
  type ReadonlyFixtureSeed,
  sampleAccountSeeds,
} from "./fixtures";
import { renderStory } from "./render-story";

describe("fixture type smoke", () => {
  it("keeps readonly fixture seeds separate from mutable clones", () => {
    expectTypeOf(sampleAccountSeeds).toEqualTypeOf<ReadonlyFixtureSeed<AccountDto>>();
    expectTypeOf(createSampleAccounts()).toEqualTypeOf<MutableTestFixture<AccountDto>>();

    if (Date.now() < 0) {
      const seedAccount = sampleAccountSeeds[0];
      if (seedAccount?.capabilities) {
        // @ts-expect-error negative type contract: ReadonlyFixtureSeed<AccountDto> rejects direct seed mutation.
        seedAccount.name = "Direct Seed Mutation";
        // @ts-expect-error negative type contract: ReadonlyFixtureSeed<AccountDto> keeps nested fields readonly.
        seedAccount.capabilities.supports_search = true;
      }
      // @ts-expect-error negative type contract: ReadonlyFixtureSeed<AccountDto> rejects collection mutation.
      sampleAccountSeeds.push(...createSampleAccounts());
      const mutableAccounts = createSampleAccounts();
      const mutableAccount = mutableAccounts[0];
      if (mutableAccount?.capabilities) {
        mutableAccount.name = "Mutable Clone";
        mutableAccount.capabilities.supports_search = true;
      }
      mutableAccounts.push(...createSampleAccounts());
    }
  });

  it("keeps renderStory caller options at the Testing Library boundary", () => {
    if (Date.now() < 0) {
      renderStory(
        {
          component: ({ label }: { label: string }) => createElement("span", null, label),
          args: { label: "base" },
        },
        {
          args: { label: "story" },
        },
        // @ts-expect-error negative type contract: renderStory third argument rejects non-RenderOptions callers.
        true,
      );
    }
  });
});
