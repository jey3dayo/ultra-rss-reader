"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

export type CollapsibleProps = CollapsiblePrimitive.Root.Props;
export type CollapsibleTriggerProps = CollapsiblePrimitive.Trigger.Props;
export type CollapsibleContentProps = CollapsiblePrimitive.Panel.Props;

function Collapsible({ ...props }: CollapsibleProps) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsibleTriggerProps) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent({ ...props }: CollapsibleContentProps) {
  return <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
