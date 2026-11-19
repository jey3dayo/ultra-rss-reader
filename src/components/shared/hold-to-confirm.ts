import { type MouseEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { MOTION_DATA_HOLD_ATTRIBUTE, MOTION_HOLD_CONFIRM_DURATION_MS } from "@/constants";

type UseHoldToConfirmOptions = {
  enabled: boolean;
  onConfirm: () => void;
};

/**
 * Pointer press-and-hold gate for destructive confirms. Keyboard activation stays
 * immediate so the action does not depend on key repeat behavior.
 */
export function useHoldToConfirm({ enabled, onConfirm }: UseHoldToConfirmOptions) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelHold = useCallback(() => {
    clearTimer();
    activePointerIdRef.current = null;
    // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- accepted risk (hold-to-confirm teardown), .claude/rules/react-doctor-triage.md "Adjust State On Prop Change Findings"
    setHolding(false);
  }, [clearTimer]);

  const cancelPointerHold = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      cancelHold();
    },
    [cancelHold],
  );

  useEffect(() => cancelHold, [cancelHold]);

  // Disabling detaches the pointer handlers, so a release can no longer clear the
  // press. Reset the state itself or a later re-enable would resume a fill with no
  // timer behind it.
  useEffect(() => {
    if (!enabled) {
      cancelHold();
    }
  }, [cancelHold, enabled]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!enabled || timerRef.current !== null) {
        return;
      }

      activePointerIdRef.current = event.pointerId;
      setHolding(true);
      const handle = setTimeout(() => {
        // Ignore a timer that a newer press or a cleanup already replaced.
        if (timerRef.current !== handle) {
          return;
        }
        timerRef.current = null;
        activePointerIdRef.current = null;
        setHolding(false);
        onConfirm();
      }, MOTION_HOLD_CONFIRM_DURATION_MS);
      timerRef.current = handle;
    },
    [enabled, onConfirm],
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      // detail === 0 is keyboard activation (Enter / Space); pointer clicks are
      // handled by the hold timer instead.
      if (enabled && event.detail > 0) {
        return;
      }

      onConfirm();
    },
    [enabled, onConfirm],
  );

  return {
    holding: holding && enabled,
    cancelHold,
    cancelPointerHold,
    handlePointerDown,
    handleClick,
  };
}

type HoldButtonPropsInput = {
  holdEnabled: boolean;
  holding: boolean;
  handlePointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  cancelPointerHold: (event: PointerEvent<HTMLButtonElement>) => void;
  cancelHold: () => void;
};

export function resolveHoldButtonProps({
  holdEnabled,
  holding,
  handlePointerDown,
  cancelPointerHold,
  cancelHold,
}: HoldButtonPropsInput) {
  if (!holdEnabled) {
    return {};
  }
  return {
    onPointerDown: handlePointerDown,
    onPointerUp: cancelPointerHold,
    onPointerLeave: cancelPointerHold,
    onPointerCancel: cancelPointerHold,
    onBlur: cancelHold,
    [MOTION_DATA_HOLD_ATTRIBUTE]: holding ? "true" : "false",
  };
}
