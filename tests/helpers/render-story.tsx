import type { StoryContext } from "@storybook/react-vite";
import { type RenderOptions, render } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { createElement } from "react";

export type StoryArgs = Record<string, unknown>;
type StoryRender<TArgs extends StoryArgs> = (args: TArgs, context: StoryContext<TArgs>) => ReactNode;

function createStoryContext<TArgs extends StoryArgs>() {
  return {} as StoryContext<TArgs>;
}

export type StoryMeta<TArgs extends StoryArgs = StoryArgs> = {
  component: ElementType;
  args?: Partial<TArgs>;
  render?: StoryRender<TArgs> | undefined;
};

export type StoryLike<TArgs extends StoryArgs = StoryArgs> = Pick<StoryMeta<TArgs>, "args" | "render">;

export function renderStory<TArgs extends StoryArgs>(
  meta: StoryMeta<TArgs>,
  story: StoryLike<TArgs>,
  options?: RenderOptions,
) {
  const args = { ...(meta.args ?? {}), ...(story.args ?? {}) } as TArgs;
  const renderStoryFn = story.render ?? meta.render;
  const ui = renderStoryFn ? renderStoryFn(args, createStoryContext<TArgs>()) : createElement(meta.component, args);
  return render(ui, options);
}
