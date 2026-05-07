import { type ComponentProps, useLayoutEffect, useRef } from "react";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_DATA_PHASE_ATTRIBUTE,
  MOTION_DATA_STAGGER_ATTRIBUTE,
  MOTION_DIGIT_ANIMATING_CLASS_NAME,
  MOTION_DIGIT_CLASS_NAME,
  MOTION_DIGIT_GROUP_CLASS_NAME,
  MOTION_DIGIT_STAGGER_ONE,
  MOTION_DIGIT_STAGGER_TWO,
  MOTION_PHASE_ENTERING,
  type MotionDigitStagger,
} from "@/constants";
import { cn } from "@/lib/utils";

type MotionNumberProps = Omit<ComponentProps<"span">, "children"> & {
  value: number | string;
  variant?: "content-swap" | "digit-pop";
};

type MotionDigitItem = {
  char: string;
  key: string;
  stagger: MotionDigitStagger | undefined;
};

function createMotionDigitItems(chars: readonly string[], textValue: string): MotionDigitItem[] {
  const items: MotionDigitItem[] = [];
  let prefix = "";

  for (const char of chars) {
    const position = items.length;
    let stagger: MotionDigitStagger | undefined;

    if (position === chars.length - 2) {
      stagger = MOTION_DIGIT_STAGGER_ONE;
    } else if (position === chars.length - 1) {
      stagger = MOTION_DIGIT_STAGGER_TWO;
    }

    prefix += char;
    items.push({
      char,
      key: `${textValue}:${prefix}`,
      stagger,
    });
  }

  return items;
}

export function MotionNumber({ value, variant = "content-swap", className, ...props }: MotionNumberProps) {
  const groupRef = useRef<HTMLSpanElement>(null);
  const animatedTextValueRef = useRef<string | null>(null);
  const textValue = String(value);
  const chars = Array.from(textValue);
  const digitItems = createMotionDigitItems(chars, textValue);

  useLayoutEffect(() => {
    if (animatedTextValueRef.current === textValue) {
      return;
    }

    const group = groupRef.current;

    if (!group) {
      return;
    }

    animatedTextValueRef.current = textValue;
    group.classList.remove(MOTION_DIGIT_ANIMATING_CLASS_NAME);
    void group.offsetHeight;
    group.classList.add(MOTION_DIGIT_ANIMATING_CLASS_NAME);
  });

  if (variant === "content-swap") {
    return (
      <span
        {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
        className={cn(MOTION_CONTENT_SWAP_CLASS_NAME, "tabular-nums", className)}
        {...props}
      >
        {value}
      </span>
    );
  }

  return (
    <span
      ref={groupRef}
      className={cn(MOTION_DIGIT_GROUP_CLASS_NAME, MOTION_DIGIT_ANIMATING_CLASS_NAME, "tabular-nums", className)}
      {...props}
    >
      {digitItems.map(({ char, key, stagger }) => {
        return (
          <span key={key} className={MOTION_DIGIT_CLASS_NAME} {...{ [MOTION_DATA_STAGGER_ATTRIBUTE]: stagger }}>
            {char}
          </span>
        );
      })}
    </span>
  );
}
