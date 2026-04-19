import { type RenderOptions, render } from "@testing-library/react";
import type { ElementType, ReactElement } from "react";
import { createElement } from "react";

export type StoryMeta = {
  component: ElementType;
  args?: object;
  render?: ((args: never, context: never) => ReactElement) | undefined;
};

export type StoryLike = Pick<StoryMeta, "args" | "render">;

export function renderStory(meta: StoryMeta, story: StoryLike, options?: RenderOptions) {
  const args = { ...(meta.args ?? {}), ...(story.args ?? {}) };
  const renderStoryFn = story.render ?? meta.render;
  const ui = renderStoryFn ? renderStoryFn(args as never, {} as never) : createElement(meta.component, args);
  return render(ui, options);
}
