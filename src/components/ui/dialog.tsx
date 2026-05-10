"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MOTION_POPUP_DIALOG_CLASS_NAME, MOTION_POPUP_OVERLAY_CLASS_NAME } from "@/constants";
import { cn } from "@/lib/utils";
import { APP_STACKING_CLASS_NAMES } from "@/lib/window/window-chrome";

export type DialogProps = DialogPrimitive.Root.Props;
export type DialogTriggerProps = DialogPrimitive.Trigger.Props;
export type DialogPortalProps = DialogPrimitive.Portal.Props;
export type DialogCloseProps = DialogPrimitive.Close.Props;
export type DialogOverlayProps = DialogPrimitive.Backdrop.Props;
export type DialogOverlayPreset = "modal" | "readable";
export type DialogStackLayer = "dialog" | "commandPalette";
export type DialogContentProps = DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  closeLabel?: string;
  overlayPreset?: DialogOverlayPreset;
  overlayClassName?: string;
  stackLayer?: DialogStackLayer;
};
export type DialogHeaderProps = React.ComponentProps<"div">;
export type DialogFooterProps = React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
  closeLabel?: string;
};
export type DialogTitleProps = DialogPrimitive.Title.Props;
export type DialogDescriptionProps = DialogPrimitive.Description.Props;

type DialogTopLayerContextValue = {
  modal: DialogProps["modal"];
  open: DialogProps["open"];
};

const DialogTopLayerContext = React.createContext<DialogTopLayerContextValue>({ modal: true, open: undefined });

function hideElementsOutsideDialog(dialogId: string) {
  const dialogElements = Array.from(document.querySelectorAll(`[data-dialog-stack-id="${dialogId}"]`));
  const hiddenElements: Array<{
    element: HTMLElement;
    ariaHidden: string | null;
    inertAttribute: string | null;
    inert: boolean;
  }> = [];

  const collectOutsideElements = (element: HTMLElement): HTMLElement[] => {
    const isDialogElement = dialogElements.some(
      (dialogElement) =>
        element === dialogElement || element.contains(dialogElement) || dialogElement.contains(element),
    );

    if (isDialogElement) {
      if (dialogElements.some((dialogElement) => element.contains(dialogElement) && element !== dialogElement)) {
        return Array.from(element.children).flatMap((child) => collectOutsideElements(child as HTMLElement));
      }
      return [];
    }

    return [element];
  };

  const outsideElements = Array.from(document.body.children).flatMap((child) =>
    collectOutsideElements(child as HTMLElement),
  );

  for (const element of outsideElements) {
    hiddenElements.push({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inertAttribute: element.getAttribute("inert"),
      inert: element.inert,
    });
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    element.inert = true;
  }

  return () => {
    for (const { element, ariaHidden, inertAttribute, inert } of hiddenElements) {
      if (ariaHidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", ariaHidden);
      }
      if (inertAttribute === null) {
        element.removeAttribute("inert");
      } else {
        element.setAttribute("inert", inertAttribute);
      }
      element.inert = inert;
    }
  };
}

function Dialog({ modal = true, open, ...props }: DialogProps) {
  return (
    <DialogTopLayerContext value={{ modal, open }}>
      <DialogPrimitive.Root data-slot="dialog" modal={modal} open={open} {...props} />
    </DialogTopLayerContext>
  );
}

function DialogTrigger({ ...props }: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPortalProps) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function resolveDialogCloseLabel(closeLabel: string | undefined, fallbackLabel: string) {
  return closeLabel ?? fallbackLabel;
}

function getDialogOverlayPresetClass(preset: DialogOverlayPreset) {
  switch (preset) {
    case "readable":
      return "bg-dialog-overlay-readable bg-dialog-scrim-readable supports-backdrop-filter:backdrop-blur-none";
    default:
      return "bg-dialog-overlay bg-dialog-scrim supports-backdrop-filter:backdrop-blur-sm";
  }
}

function getDialogStackClass(layer: DialogStackLayer) {
  return layer === "commandPalette" ? APP_STACKING_CLASS_NAMES.commandPalette : APP_STACKING_CLASS_NAMES.dialog;
}

function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  const overlayClassName = [MOTION_POPUP_OVERLAY_CLASS_NAME, "fixed inset-0 isolate", className]
    .filter(Boolean)
    .join(" ");

  return <DialogPrimitive.Backdrop data-slot="dialog-overlay" className={overlayClassName} {...props} />;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel,
  overlayPreset = "modal",
  overlayClassName,
  stackLayer = "dialog",
  ...props
}: DialogContentProps) {
  const { t } = useTranslation();
  const { modal, open } = React.useContext(DialogTopLayerContext);
  const dialogId = React.useId();
  const resolvedOverlayClassName = [getDialogOverlayPresetClass(overlayPreset), overlayClassName]
    .filter(Boolean)
    .join(" ");
  const resolvedCloseLabel = resolveDialogCloseLabel(closeLabel, t(["dialog_close", "close"]));
  const stackClassName = getDialogStackClass(stackLayer);

  React.useEffect(() => {
    if (modal !== true || open === false) {
      return undefined;
    }

    if (open !== true) {
      const popupElement = document.querySelector<HTMLElement>(
        `[data-dialog-stack-id="${dialogId}"][data-slot="dialog-content"]`,
      );
      if (popupElement === null || !popupElement.hasAttribute("data-open")) {
        return undefined;
      }
    }

    return hideElementsOutsideDialog(dialogId);
  }, [dialogId, modal, open]);

  return (
    <DialogPortal>
      <DialogOverlay className={[stackClassName, resolvedOverlayClassName].join(" ")} data-dialog-stack-id={dialogId} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-dialog-stack-id={dialogId}
        data-stack-layer={stackLayer}
        className={cn(
          MOTION_POPUP_DIALOG_CLASS_NAME,
          "fixed top-1/2 left-1/2 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl border border-border bg-surface-2 p-5 text-sm text-popover-foreground shadow-elevation-3 outline-none focus-visible:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-sm",
          stackClassName,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">{resolvedCloseLabel}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function DialogFooter({ className, showCloseButton = false, closeLabel, children, ...props }: DialogFooterProps) {
  const { t } = useTranslation();
  const resolvedCloseLabel = resolveDialogCloseLabel(closeLabel, t(["dialog_close", "close"]));

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-5 -mb-5 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-surface-1 px-5 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>{resolvedCloseLabel}</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-[1.05rem] leading-none font-medium tracking-[0.01em]", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-foreground-soft *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
