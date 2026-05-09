import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { Input as InputPrimitive } from "@base-ui/react/input";
import type { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { Select as SelectPrimitive } from "@base-ui/react/select";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { Ref } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { ConfirmDialogVariant } from "@/components/shared/dialog.types";
import type { Button, buttonVariants } from "@/components/ui/button";
import type { CollapsibleContentProps, CollapsibleProps, CollapsibleTriggerProps } from "@/components/ui/collapsible";
import type {
  DialogCloseProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogOverlayPreset,
  DialogOverlayProps,
  DialogPortalProps,
  DialogProps,
  DialogTitleProps,
  DialogTriggerProps,
} from "@/components/ui/dialog";
import type { InputProps } from "@/components/ui/input";
import type { ScrollAreaProps } from "@/components/ui/scroll-area";
import type {
  SelectGroupLabelProps,
  SelectGroupProps,
  SelectItemProps,
  SelectPopupProps,
  SelectProps,
  SelectSeparatorProps,
  SelectTriggerProps,
  SelectValueProps,
} from "@/components/ui/select";
import packageJson from "../../../package.json";

describe("UI wrapper public API", () => {
  it("keeps Button and buttonVariants as the public styled Base UI Button surface", () => {
    expectTypeOf<typeof Button>().parameter(0).toMatchTypeOf<ButtonPrimitive.Props>();
    expectTypeOf<typeof Button>().parameter(0).toMatchTypeOf<VariantProps<typeof buttonVariants>>();
    expectTypeOf<VariantProps<typeof buttonVariants>>().toHaveProperty("variant");
    expectTypeOf<VariantProps<typeof buttonVariants>>().toHaveProperty("size");
  });

  it("keeps Dialog wrapper props as public Base UI pass-through contracts", () => {
    expectTypeOf<DialogProps>().toEqualTypeOf<DialogPrimitive.Root.Props>();
    expectTypeOf<DialogTriggerProps>().toEqualTypeOf<DialogPrimitive.Trigger.Props>();
    expectTypeOf<DialogPortalProps>().toEqualTypeOf<DialogPrimitive.Portal.Props>();
    expectTypeOf<DialogCloseProps>().toEqualTypeOf<DialogPrimitive.Close.Props>();
    expectTypeOf<DialogOverlayProps>().toEqualTypeOf<DialogPrimitive.Backdrop.Props>();
    expectTypeOf<DialogOverlayPreset>().toEqualTypeOf<"modal" | "readable">();
    expectTypeOf<DialogContentProps>().toMatchTypeOf<DialogPrimitive.Popup.Props>();
    expectTypeOf<DialogContentProps>().toHaveProperty("showCloseButton").toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DialogContentProps>().toHaveProperty("closeLabel").toEqualTypeOf<string | undefined>();
    expectTypeOf<DialogContentProps>().toHaveProperty("overlayPreset").toEqualTypeOf<DialogOverlayPreset | undefined>();
    expectTypeOf<DialogContentProps>().toHaveProperty("overlayClassName").toEqualTypeOf<string | undefined>();
    expectTypeOf<DialogHeaderProps>().toMatchTypeOf<React.ComponentProps<"div">>();
    expectTypeOf<DialogFooterProps>().toMatchTypeOf<React.ComponentProps<"div">>();
    expectTypeOf<DialogFooterProps>().toHaveProperty("showCloseButton").toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DialogFooterProps>().toHaveProperty("closeLabel").toEqualTypeOf<string | undefined>();
    expectTypeOf<DialogTitleProps>().toEqualTypeOf<DialogPrimitive.Title.Props>();
    expectTypeOf<DialogDescriptionProps>().toEqualTypeOf<DialogPrimitive.Description.Props>();
  });

  it("keeps InputProps as the public Base UI Input pass-through surface", () => {
    expectTypeOf<InputProps>().toEqualTypeOf<InputPrimitive.Props>();
  });

  it("keeps Select wrapper props as public Base UI pass-through contracts", () => {
    expectTypeOf<SelectProps>().toEqualTypeOf<SelectPrimitive.Root.Props<string>>();
    expectTypeOf<SelectTriggerProps>().toEqualTypeOf<SelectPrimitive.Trigger.Props>();
    expectTypeOf<SelectValueProps>().toEqualTypeOf<SelectPrimitive.Value.Props>();
    expectTypeOf<SelectPopupProps>().toEqualTypeOf<SelectPrimitive.Popup.Props>();
    expectTypeOf<SelectItemProps>().toEqualTypeOf<SelectPrimitive.Item.Props>();
    expectTypeOf<SelectGroupProps>().toEqualTypeOf<SelectPrimitive.Group.Props>();
    expectTypeOf<SelectGroupLabelProps>().toEqualTypeOf<SelectPrimitive.GroupLabel.Props>();
    expectTypeOf<SelectSeparatorProps>().toEqualTypeOf<React.ComponentProps<"div">>();
  });

  it("keeps ScrollAreaProps as the public Base UI Root pass-through surface", () => {
    expectTypeOf<ScrollAreaProps>().toMatchTypeOf<ScrollAreaPrimitive.Root.Props>();
    expectTypeOf<ScrollAreaProps>().toHaveProperty("contentClassName").toEqualTypeOf<string | undefined>();
    expectTypeOf<ScrollAreaProps>().toHaveProperty("scrollbarClassName").toEqualTypeOf<string | undefined>();
    expectTypeOf<ScrollAreaProps>().toHaveProperty("thumbClassName").toEqualTypeOf<string | undefined>();
    expectTypeOf<ScrollAreaProps>().toHaveProperty("viewportRef").toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
  });

  it("keeps Collapsible wrapper props as public Base UI pass-through contracts", () => {
    expectTypeOf<CollapsibleProps>().toEqualTypeOf<CollapsiblePrimitive.Root.Props>();
    expectTypeOf<CollapsibleTriggerProps>().toEqualTypeOf<CollapsiblePrimitive.Trigger.Props>();
    expectTypeOf<CollapsibleContentProps>().toEqualTypeOf<CollapsiblePrimitive.Panel.Props>();
  });

  it("keeps UI primitive wrappers allowlisted as intentional public exports", () => {
    expect(packageJson.knip?.ignoreIssues).toEqual({
      "src/components/ui/{button,collapsible,dialog,input,scroll-area,select}.tsx": ["exports", "types"],
    });
  });

  it("keeps confirm dialog variants as a shared store/view contract", () => {
    expectTypeOf<ConfirmDialogVariant>().toEqualTypeOf<"default" | "warning" | "destructive">();
  });
});
