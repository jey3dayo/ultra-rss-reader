import type { StoryContext } from "@storybook/react-vite";
import { type RenderOptions, render } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { createElement } from "react";

export type StoryArgs = Record<string, unknown>;
type StoryParameters = Record<string, unknown>;
type StoryGlobals = Record<string, unknown>;
type StoryRenderContext<TArgs extends StoryArgs> = Pick<StoryContext<TArgs>, "args" | "parameters" | "globals">;
type StoryRender<TArgs extends StoryArgs> = (args: TArgs, context: StoryContext<TArgs>) => ReactNode;
type ResolvedStoryFromStorybookBoundary<TArgs extends StoryArgs> = {
  args: TArgs;
  context: StoryContext<TArgs>;
  decorators: StoryDecorator<TArgs>[];
};
export type StoryDecorator<TArgs extends StoryArgs> = (
  Story: () => ReactNode,
  context: StoryContext<TArgs>,
) => ReactNode;

function mergePartialStoryArgsShape<TArgs extends StoryArgs>(
  metaArgs: Partial<TArgs> | undefined,
  storyArgs: Partial<TArgs> | undefined,
): StoryArgs {
  return { ...(metaArgs ?? {}), ...(storyArgs ?? {}) } satisfies StoryArgs;
}

function createStoryRenderContext<TArgs extends StoryArgs>(
  args: TArgs,
  parameters: StoryParameters,
  globals: StoryGlobals,
): StoryRenderContext<TArgs> {
  return {
    args,
    parameters,
    globals,
  } satisfies StoryRenderContext<TArgs>;
}

function isStoryDecorator<TArgs extends StoryArgs>(decorator: unknown): decorator is StoryDecorator<TArgs> {
  return typeof decorator === "function";
}

function collectStoryDecorators<TArgs extends StoryArgs>(
  decorators: StoryMeta<TArgs>["decorators"],
): StoryDecorator<TArgs>[] {
  return (Array.isArray(decorators) ? decorators : decorators ? [decorators] : []).filter(isStoryDecorator<TArgs>);
}

function resolveStoryFromStorybookBoundary<TArgs extends StoryArgs>(
  meta: StoryMeta<TArgs>,
  story: StoryLike<TArgs>,
): ResolvedStoryFromStorybookBoundary<TArgs> {
  const args = mergePartialStoryArgsShape(meta.args, story.args) as TArgs;
  const parameters = {
    ...(meta.parameters ?? {}),
    ...(story.parameters ?? {}),
  };
  const globals = { ...(meta.globals ?? {}), ...(story.globals ?? {}) };
  const context = createStoryRenderContext(args, parameters, globals) as StoryContext<TArgs>;

  return {
    args,
    context,
    decorators: [...collectStoryDecorators(meta.decorators), ...collectStoryDecorators(story.decorators)],
  } satisfies ResolvedStoryFromStorybookBoundary<TArgs>;
}

function assertRenderStoryOptionsFromCallBoundary(
  options: RenderOptions | undefined,
): asserts options is RenderOptions | undefined {
  if (options === undefined) {
    return;
  }

  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError("renderStory third argument must be Testing Library RenderOptions.");
  }
}

export type StoryMeta<TArgs extends StoryArgs = StoryArgs> = {
  component: ElementType;
  args?: Partial<TArgs>;
  parameters?: StoryParameters;
  globals?: StoryGlobals;
  render?: StoryRender<TArgs> | undefined;
  decorators?: unknown;
};

export type StoryLike<TArgs extends StoryArgs = StoryArgs> = Pick<
  StoryMeta<TArgs>,
  "args" | "parameters" | "globals" | "render" | "decorators"
>;

export function renderStory<TArgs extends StoryArgs>(
  meta: StoryMeta<TArgs>,
  story: StoryLike<TArgs>,
  options?: RenderOptions,
) {
  assertRenderStoryOptionsFromCallBoundary(options);
  const { args, context, decorators } = resolveStoryFromStorybookBoundary(meta, story);
  const renderStoryFn = story.render ?? meta.render;
  const baseStory = () => (renderStoryFn ? renderStoryFn(args, context) : createElement(meta.component, args));
  const ui = decorators.reduceRight<() => ReactNode>(
    (Story, decorator) => () => decorator(Story, context),
    baseStory,
  )();
  return render(ui, options);
}
