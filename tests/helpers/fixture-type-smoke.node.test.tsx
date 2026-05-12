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
import { createHookDataResult, type PartialHookDataResult } from "./typed-test-factories";

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
      // @ts-expect-error negative type contract: fixture seeds reject Date values.
      const _dateSeed: ReadonlyFixtureSeed<{ value: Date }> = [{ value: new Date() }];
      // @ts-expect-error negative type contract: fixture seeds reject Map values.
      const _mapSeed: ReadonlyFixtureSeed<{ value: Map<string, string> }> = [{ value: new Map() }];
      // @ts-expect-error negative type contract: fixture seeds reject function values.
      const _functionSeed: ReadonlyFixtureSeed<{ value: () => string }> = [{ value: () => "value" }];
      // @ts-expect-error negative type contract: fixture seeds reject undefined fields.
      const _undefinedSeed: ReadonlyFixtureSeed<{ value: undefined }> = [{ value: undefined }];
      void _dateSeed;
      void _mapSeed;
      void _functionSeed;
      void _undefinedSeed;
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

  it("keeps hook data result factories explicit about partial query result shape", () => {
    type QueryResult = {
      data: string[];
      isLoading: boolean;
      error: Error | null;
    };

    const partialResult = {
      data: ["feed"],
      isLoading: false,
    } satisfies PartialHookDataResult<QueryResult>;

    expectTypeOf(partialResult).toExtend<{
      data: string[];
      isLoading?: boolean;
      error?: Error | null;
    }>();
    expectTypeOf(createHookDataResult<QueryResult>(["feed"], { isLoading: false })).toEqualTypeOf<QueryResult>();
  });
});
