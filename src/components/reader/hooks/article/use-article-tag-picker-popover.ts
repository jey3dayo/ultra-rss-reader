import { type KeyboardEvent, useCallback, useEffect, useRef } from "react";
import { isOutsideElement } from "@/lib/dom/dom-target";
import { focusRovingButton, getActiveRovingButtonIndex } from "@/lib/dom/roving-focus";
import type { ArticleTagPickerViewProps } from "../../article-tag-picker-view";

type UseArticleTagPickerPopoverParams = {
  isExpanded: boolean;
  availableTagCount: number;
  onExpandedChange: ArticleTagPickerViewProps["onExpandedChange"];
  onNewTagNameChange: ArticleTagPickerViewProps["onNewTagNameChange"];
};

function getRuntimeDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

export function useArticleTagPickerPopover({
  isExpanded,
  availableTagCount,
  onExpandedChange,
  onNewTagNameChange,
}: UseArticleTagPickerPopoverParams) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const tagOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreFocusOnCloseRef = useRef(false);
  const restoreFocusFrameRef = useRef<number | null>(null);
  const hasFocusedOnOpenRef = useRef(false);
  const isMountedRef = useRef(true);
  const wasExpandedRef = useRef(isExpanded);
  const previousAvailableTagCountRef = useRef(availableTagCount);

  const cancelRestoreFocusFrame = useCallback(() => {
    if (restoreFocusFrameRef.current !== null) {
      cancelAnimationFrame(restoreFocusFrameRef.current);
      restoreFocusFrameRef.current = null;
    }
  }, []);

  const closePicker = useCallback(
    (restoreFocus = false) => {
      restoreFocusOnCloseRef.current = restoreFocus;
      onExpandedChange(false);
    },
    [onExpandedChange],
  );

  const requestFocusRestoreOnClose = useCallback(() => {
    restoreFocusOnCloseRef.current = true;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelRestoreFocusFrame();
    };
  }, [cancelRestoreFocusFrame]);

  useEffect(() => {
    if (isExpanded) {
      cancelRestoreFocusFrame();
      return;
    }

    if (!restoreFocusOnCloseRef.current) {
      return;
    }

    restoreFocusOnCloseRef.current = false;
    cancelRestoreFocusFrame();
    restoreFocusFrameRef.current = requestAnimationFrame(() => {
      restoreFocusFrameRef.current = null;
      if (!isMountedRef.current) {
        return;
      }

      triggerRef.current?.focus();
    });
  }, [cancelRestoreFocusFrame, isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handlePointerOrTouchDown = (event: PointerEvent | TouchEvent) => {
      if (isOutsideElement(pickerRef.current, event)) {
        closePicker();
      }
    };

    const ownerDocument = pickerRef.current?.ownerDocument ?? getRuntimeDocument();
    if (!ownerDocument) {
      return;
    }

    const eventTypes = ["pointerdown", "touchstart"] as const;
    const boundEventTypes: Array<(typeof eventTypes)[number]> = [];

    try {
      for (const eventType of eventTypes) {
        ownerDocument.addEventListener(eventType, handlePointerOrTouchDown);
        boundEventTypes.push(eventType);
      }
    } catch (error) {
      for (const eventType of boundEventTypes) {
        ownerDocument.removeEventListener(eventType, handlePointerOrTouchDown);
      }
      console.warn("Failed to bind article tag picker outside-click listener.", error);
      return;
    }

    return () => {
      try {
        for (const eventType of boundEventTypes) {
          ownerDocument.removeEventListener(eventType, handlePointerOrTouchDown);
        }
      } catch (error) {
        console.warn("Failed to cleanup article tag picker outside-click listener.", error);
      }
    };
  }, [closePicker, isExpanded]);

  useEffect(() => {
    if (!isExpanded || hasFocusedOnOpenRef.current) {
      return;
    }

    hasFocusedOnOpenRef.current = true;

    const frameId = requestAnimationFrame(() => {
      const ownerDocument = pickerRef.current?.ownerDocument ?? getRuntimeDocument();
      const activeElement = ownerDocument?.activeElement ?? null;
      if (
        activeElement &&
        activeElement !== ownerDocument?.body &&
        activeElement !== triggerRef.current &&
        pickerRef.current?.contains(activeElement)
      ) {
        return;
      }

      if (availableTagCount > 0) {
        tagOptionRefs.current[0]?.focus();
        return;
      }

      newTagInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, [availableTagCount, isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      previousAvailableTagCountRef.current = availableTagCount;
      hasFocusedOnOpenRef.current = false;
    }
  }, [availableTagCount, isExpanded]);

  useEffect(() => {
    const previousAvailableTagCount = previousAvailableTagCountRef.current;
    previousAvailableTagCountRef.current = availableTagCount;

    if (!isExpanded || availableTagCount >= previousAvailableTagCount) {
      return;
    }

    closePicker(true);
  }, [availableTagCount, closePicker, isExpanded]);

  useEffect(() => {
    if (wasExpandedRef.current && !isExpanded) {
      onNewTagNameChange("");
    }

    wasExpandedRef.current = isExpanded;
  }, [isExpanded, onNewTagNameChange]);

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown" && !isExpanded) {
        event.preventDefault();
        event.stopPropagation();
        onExpandedChange(true);
      }

      if (event.key === "Escape" && isExpanded) {
        event.preventDefault();
        event.stopPropagation();
        closePicker(true);
      }
    },
    [closePicker, isExpanded, onExpandedChange],
  );

  const handleListboxKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = getActiveRovingButtonIndex(tagOptionRefs, event.currentTarget.ownerDocument.activeElement);

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePicker(true);
      }

      if (event.key === "ArrowDown" && availableTagCount > 0) {
        event.preventDefault();
        event.stopPropagation();
        focusRovingButton(tagOptionRefs, availableTagCount, currentIndex >= 0 ? currentIndex + 1 : 0);
      }

      if (event.key === "ArrowUp" && availableTagCount > 0) {
        event.preventDefault();
        event.stopPropagation();
        focusRovingButton(
          tagOptionRefs,
          availableTagCount,
          currentIndex >= 0 ? currentIndex - 1 : availableTagCount - 1,
        );
      }

      if (event.key === "Home" && availableTagCount > 0) {
        event.preventDefault();
        event.stopPropagation();
        focusRovingButton(tagOptionRefs, availableTagCount, 0);
      }

      if (event.key === "End" && availableTagCount > 0) {
        event.preventDefault();
        event.stopPropagation();
        focusRovingButton(tagOptionRefs, availableTagCount, availableTagCount - 1);
      }
    },
    [availableTagCount, closePicker],
  );

  return {
    pickerRef,
    triggerRef,
    newTagInputRef,
    tagOptionRefs,
    closePicker,
    requestFocusRestoreOnClose,
    handleTriggerKeyDown,
    handleListboxKeyDown,
  };
}
