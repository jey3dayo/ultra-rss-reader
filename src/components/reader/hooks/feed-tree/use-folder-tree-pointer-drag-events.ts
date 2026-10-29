import { useEffect, useLayoutEffect, useRef } from "react";
import type { UseFolderTreePointerDragEventsParams } from "@/components/reader/hooks/feed-tree/folder-tree-drag.types";
import { applyDragEdgeAutoScroll } from "@/lib/sidebar/drag-edge-auto-scroll";
import {
  getFolderTreePointerDragSessionForPointer,
  shouldStartFolderTreePointerDrag,
  updateFolderTreePointerDragSessionPosition,
} from "@/lib/sidebar/folder-tree-drag-session";
import {
  isSameFolderReorderDropTarget,
  resolveFolderReorderInsertionIndex,
} from "@/lib/sidebar/folder-tree-drop-target";
import { bindWindowEvents, createKeyboardEventListener, createPointerEventListener } from "@/lib/window/window-events";

export function useFolderTreePointerDragEvents({
  isPointerTracking,
  pointerDragRef,
  scrollContainerRef,
  setPointerDragPreview,
  setDropTarget,
  queueSuppressHandleClickReset,
  clearPointerTracking,
  onDragStartFolder,
  onDragFolderInsertionChange,
  onDropFolderReorder,
  onDragEnd,
}: UseFolderTreePointerDragEventsParams) {
  const latestParamsRef = useRef<Omit<UseFolderTreePointerDragEventsParams, "isPointerTracking" | "pointerDragRef">>({
    scrollContainerRef,
    setPointerDragPreview,
    setDropTarget,
    queueSuppressHandleClickReset,
    clearPointerTracking,
    onDragStartFolder,
    onDragFolderInsertionChange,
    onDropFolderReorder,
    onDragEnd,
  });

  useLayoutEffect(() => {
    latestParamsRef.current = {
      scrollContainerRef,
      setPointerDragPreview,
      setDropTarget,
      queueSuppressHandleClickReset,
      clearPointerTracking,
      onDragStartFolder,
      onDragFolderInsertionChange,
      onDropFolderReorder,
      onDragEnd,
    };
  });

  useEffect(() => {
    if (!isPointerTracking) {
      return;
    }

    const finishPointerDrag = (shouldCancel: boolean) => {
      const session = pointerDragRef.current;
      const {
        queueSuppressHandleClickReset: suppressReset,
        clearPointerTracking: clearTracking,
        onDragEnd: dragEnd,
        onDropFolderReorder: dropReorder,
      } = latestParamsRef.current;

      if (!session) {
        return;
      }

      if (session.isDragging && !shouldCancel && session.dropTarget) {
        dropReorder?.(session.folder.id, session.dropTarget.insertionIndex);
      }

      if (session.isDragging) {
        suppressReset?.();
      }
      clearTracking();
      dragEnd?.();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = getFolderTreePointerDragSessionForPointer(pointerDragRef.current, event.pointerId);
      if (!session) {
        return;
      }

      updateFolderTreePointerDragSessionPosition(session, event.clientX, event.clientY);
      const {
        scrollContainerRef: scrollRef,
        setPointerDragPreview: setPreview,
        setDropTarget: setTarget,
        onDragStartFolder: dragStart,
        onDragFolderInsertionChange: insertionChange,
      } = latestParamsRef.current;

      if (!session.isDragging && shouldStartFolderTreePointerDrag(session, event.clientX, event.clientY)) {
        session.isDragging = true;
        dragStart?.(session.folder);
        setPreview({ folder: session.folder, x: event.clientX, y: event.clientY });
      }

      if (!session.isDragging) {
        return;
      }

      applyDragEdgeAutoScroll({
        clientY: event.clientY,
        scrollContainer: scrollRef?.current ?? null,
      });

      const nextTarget = resolveFolderReorderInsertionIndex(event.clientX, event.clientY);
      if (!isSameFolderReorderDropTarget(session.dropTarget, nextTarget)) {
        session.dropTarget = nextTarget;
        setTarget(nextTarget);
        insertionChange?.(nextTarget?.insertionIndex ?? null);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const session = getFolderTreePointerDragSessionForPointer(pointerDragRef.current, event.pointerId);
      if (!session) {
        return;
      }
      finishPointerDrag(false);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const session = getFolderTreePointerDragSessionForPointer(pointerDragRef.current, event.pointerId);
      if (!session) {
        return;
      }
      finishPointerDrag(true);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !pointerDragRef.current) {
        return;
      }
      finishPointerDrag(true);
    };

    const handleWindowBlur = () => {
      if (!pointerDragRef.current) {
        return;
      }
      finishPointerDrag(true);
    };

    return bindWindowEvents([
      { type: "pointermove", listener: createPointerEventListener(handlePointerMove) },
      { type: "pointerup", listener: createPointerEventListener(handlePointerUp) },
      { type: "pointercancel", listener: createPointerEventListener(handlePointerCancel) },
      { type: "keydown", listener: createKeyboardEventListener(handleEscape) },
      { type: "blur", listener: handleWindowBlur },
    ]);
  }, [isPointerTracking, pointerDragRef]);
}
