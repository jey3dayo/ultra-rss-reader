import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderStory, type StoryDecorator } from "./render-story";

describe("renderStory", () => {
  it("composes meta decorators outside story decorators in Storybook order", () => {
    const calls: string[] = [];
    const createDecorator =
      (name: string): StoryDecorator<{ label: string }> =>
      (Story, context) => {
        calls.push(`${name}:before:${context.args.label}`);
        const output = Story();
        calls.push(`${name}:after:${context.args.label}`);
        return createElement("div", { "data-decorator": name }, output);
      };

    const { container } = renderStory(
      {
        component: ({ label }: { label: string }) => {
          calls.push(`component:${label}`);
          return createElement("span", null, label);
        },
        args: { label: "meta" },
        decorators: [createDecorator("meta-first"), createDecorator("meta-second")],
      },
      {
        args: { label: "story" },
        decorators: [createDecorator("story-first"), createDecorator("story-second")],
      },
    );

    expect(calls).toEqual([
      "meta-first:before:story",
      "meta-second:before:story",
      "story-first:before:story",
      "story-second:before:story",
      "story-second:after:story",
      "story-first:after:story",
      "meta-second:after:story",
      "meta-first:after:story",
      "component:story",
    ]);
    expect(
      Array.from(container.querySelectorAll("[data-decorator]")).map((node) => node.getAttribute("data-decorator")),
    ).toEqual(["meta-first", "meta-second", "story-first", "story-second"]);
  });

  it("lets decorators render Story with updated args and context without mutating sibling context", () => {
    const snapshots: Array<{
      source: string;
      args: { label: string; tone: string };
      parameters: Record<string, unknown>;
      globals: Record<string, unknown>;
    }> = [];
    const capture =
      (source: string): StoryDecorator<{ label: string; tone: string }> =>
      (Story, context) => {
        snapshots.push({
          source,
          args: context.args,
          parameters: context.parameters,
          globals: context.globals,
        });

        return source === "story"
          ? Story({
              args: { label: "decorated" },
              parameters: { viewport: "narrow" },
              globals: { theme: "contrast" },
            })
          : Story();
      };

    renderStory<{ label: string; tone: string }>(
      {
        component: ({ label }: { label: string; tone: string }) => createElement("span", null, label),
        args: { label: "meta", tone: "neutral" },
        parameters: { layout: "centered", viewport: "desktop" },
        globals: { locale: "en", theme: "light" },
        decorators: [capture("meta")],
      },
      {
        args: { label: "story" },
        parameters: { viewport: "mobile" },
        globals: { theme: "dark" },
        render: (args, context) => {
          snapshots.push({
            source: "render",
            args,
            parameters: context.parameters,
            globals: context.globals,
          });
          return createElement("span", null, `${args.label}:${args.tone}`);
        },
        decorators: [capture("story")],
      },
    );

    expect(snapshots).toEqual([
      {
        source: "meta",
        args: { label: "story", tone: "neutral" },
        parameters: { layout: "centered", viewport: "mobile" },
        globals: { locale: "en", theme: "dark" },
      },
      {
        source: "story",
        args: { label: "story", tone: "neutral" },
        parameters: { layout: "centered", viewport: "mobile" },
        globals: { locale: "en", theme: "dark" },
      },
      {
        source: "render",
        args: { label: "decorated", tone: "neutral" },
        parameters: { layout: "centered", viewport: "narrow" },
        globals: { locale: "en", theme: "contrast" },
      },
    ]);
  });
});
