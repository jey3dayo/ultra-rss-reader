import { type KeyboardEvent, useCallback, useEffect, useRef } from "react";
import type { UseArticleTagPickerPopoverParams } from "./article-tag-picker.types";
import { focusRovingButton } from "./roving-focus";

export function useArticleTagPickerPopover({
  isExpanded,
  availableTagCount,
  onExpandedChange,
}: UseArticleTagPickerPopoverParams) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const tagOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreFocusOnCloseRef = useRef(false);
  const hasFocusedOnOpenRef = useRef(false);

  const closePicker = useCallback(
    (restoreFocus = false) => {
      restoreFocusOnCloseRef.current = restoreFocus;
      onExpandedChange(false);
    },
    [onExpandedChange],
  );

  useEffect(() => {
    if (isExpanded || !restoreFocusOnCloseRef.current) {
      return;
    }

    restoreFocusOnCloseRef.current = false;
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        closePicker();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [closePicker, isExpanded]);

  useEffect(() => {
    if (!isExpanded || hasFocusedOnOpenRef.current) {
      return;
    }

    hasFocusedOnOpenRef.current = true;

    const frameId = requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        activeElement !== document.body &&
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
      hasFocusedOnOpenRef.current = false;
    }
  }, [isExpanded]);

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
      const currentIndex = tagOptionRefs.current.indexOf(document.activeElement as HTMLButtonElement);

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
        focusRovingButton(tagOptionRefs, availableTagCount, currentIndex >= 0 ? currentIndex - 1 : availableTagCount - 1);
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
    handleTriggerKeyDown,
    handleListboxKeyDown,
  };
}
