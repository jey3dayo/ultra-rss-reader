import type { StoryContext } from "@storybook/react-vite";
import { type RenderOptions, render } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { createElement } from "react";

export type StoryArgs = Record<string, unknown>;
type StoryRender<TArgs extends StoryArgs> = (args: TArgs, context: StoryContext<TArgs>) => ReactNode;
export type StoryDecorator<TArgs extends StoryArgs> = (
  Story: () => ReactNode,
  context: StoryContext<TArgs>,
) => ReactNode;

function createStoryContext<TArgs extends StoryArgs>(args: TArgs) {
  return { args } as StoryContext<TArgs>;
}

export type StoryMeta<TArgs extends StoryArgs = StoryArgs> = {
  component: ElementType;
  args?: Partial<TArgs>;
  render?: StoryRender<TArgs> | undefined;
  decorators?: unknown;
};

export type StoryLike<TArgs extends StoryArgs = StoryArgs> = Pick<StoryMeta<TArgs>, "args" | "render" | "decorators">;

export function renderStory<TArgs extends StoryArgs>(
  meta: StoryMeta<TArgs>,
  story: StoryLike<TArgs>,
  options?: RenderOptions,
) {
  const args = { ...(meta.args ?? {}), ...(story.args ?? {}) } as TArgs;
  const renderStoryFn = story.render ?? meta.render;
  const context = createStoryContext(args);
  const baseStory = () => (renderStoryFn ? renderStoryFn(args, context) : createElement(meta.component, args));
  const decorators = [
    ...(Array.isArray(meta.decorators) ? meta.decorators : meta.decorators ? [meta.decorators] : []),
    ...(Array.isArray(story.decorators) ? story.decorators : story.decorators ? [story.decorators] : []),
  ] as StoryDecorator<TArgs>[];
  const ui = decorators.reduceRight<() => ReactNode>(
    (Story, decorator) => () => decorator(Story, context),
    baseStory,
  )();
  return render(ui, options);
}
