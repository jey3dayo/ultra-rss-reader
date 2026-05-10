import type { StoryContext } from "@storybook/react-vite";
import { type RenderOptions, render } from "@testing-library/react";
import type { ElementType, ReactNode } from "react";
import { createElement } from "react";
import preview from "../../.storybook/preview";

export type StoryArgs = Record<string, unknown>;
type StoryParameters = Record<string, unknown>;
type StoryGlobals = Record<string, unknown>;
type StoryRenderContext<TArgs extends StoryArgs> = Pick<StoryContext<TArgs>, "args" | "parameters" | "globals">;
type StoryRenderContextUpdate<TArgs extends StoryArgs> = {
  args?: Partial<TArgs>;
  parameters?: StoryParameters;
  globals?: StoryGlobals;
};
type StoryRender<TArgs extends StoryArgs> = (args: TArgs, context: StoryContext<TArgs>) => ReactNode;
type ResolvedStoryFromStorybookBoundary<TArgs extends StoryArgs> = {
  args: TArgs;
  context: StoryContext<TArgs>;
  decorators: StoryDecorator<TArgs>[];
};
export type StoryDecorator<TArgs extends StoryArgs> = (
  Story: (update?: StoryRenderContextUpdate<TArgs>) => ReactNode,
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

function mergeStoryRenderContext<TArgs extends StoryArgs>(
  context: StoryContext<TArgs>,
  update: StoryRenderContextUpdate<TArgs> | undefined,
): StoryContext<TArgs> {
  if (update === undefined) {
    return context;
  }

  return createStoryRenderContext(
    mergePartialStoryArgsShape(context.args, update.args) as TArgs,
    { ...context.parameters, ...(update.parameters ?? {}) },
    { ...context.globals, ...(update.globals ?? {}) },
  ) as StoryContext<TArgs>;
}

function isStoryDecorator<TArgs extends StoryArgs>(decorator: unknown): decorator is StoryDecorator<TArgs> {
  return typeof decorator === "function";
}

function collectStoryDecorators<TArgs extends StoryArgs>(
  decorators: StoryMeta<TArgs>["decorators"] | unknown,
): StoryDecorator<TArgs>[] {
  const candidateDecorators = Array.isArray(decorators) ? decorators : decorators ? [decorators] : [];
  const storyDecorators: StoryDecorator<TArgs>[] = [];

  for (const decorator of candidateDecorators) {
    if (isStoryDecorator<TArgs>(decorator)) {
      storyDecorators.push(decorator);
    }
  }

  return storyDecorators;
}

function resolveStoryFromStorybookBoundary<TArgs extends StoryArgs>(
  meta: StoryMeta<TArgs>,
  story: StoryLike<TArgs>,
): ResolvedStoryFromStorybookBoundary<TArgs> {
  const args = mergePartialStoryArgsShape(meta.args, story.args) as TArgs;
  const parameters = {
    ...(preview.parameters ?? {}),
    ...(meta.parameters ?? {}),
    ...(story.parameters ?? {}),
  };
  const globals = { ...(meta.globals ?? {}), ...(story.globals ?? {}) };
  const context = createStoryRenderContext(args, parameters, globals) as StoryContext<TArgs>;

  return {
    args,
    context,
    decorators: [
      ...collectStoryDecorators<TArgs>(preview.decorators),
      ...collectStoryDecorators<TArgs>(meta.decorators),
      ...collectStoryDecorators<TArgs>(story.decorators),
    ],
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
  const { context, decorators } = resolveStoryFromStorybookBoundary(meta, story);
  const renderStoryFn = story.render ?? meta.render;
  const renderResolvedStory = (storyContext: StoryContext<TArgs>) =>
    renderStoryFn ? renderStoryFn(storyContext.args, storyContext) : createElement(meta.component, storyContext.args);
  const renderDecoratedStory = (decoratorIndex: number, storyContext: StoryContext<TArgs>): ReactNode => {
    const decorator = decorators[decoratorIndex];

    if (decorator === undefined) {
      return renderResolvedStory(storyContext);
    }

    return decorator(
      (update) => renderDecoratedStory(decoratorIndex + 1, mergeStoryRenderContext(storyContext, update)),
      storyContext,
    );
  };
  const ui = renderDecoratedStory(0, context);
  return render(ui, options);
}
