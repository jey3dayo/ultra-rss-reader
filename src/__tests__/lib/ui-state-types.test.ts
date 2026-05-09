import { describe, expectTypeOf, it } from "vitest";
import type { UiFeedbackAction } from "@/lib/ui/action.types";
import type { UiDisplayState, UiDisplayStateAction } from "@/lib/ui/display-state.types";
import type { ToastAction, ToastData } from "@/lib/ui/toast.types";

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

describe("ui state type boundaries", () => {
  it("shares only the minimal feedback action shape between toasts and display states", () => {
    expectTypeOf<ToastAction>().toEqualTypeOf<UiFeedbackAction>();
    expectTypeOf<UiDisplayStateAction>().toEqualTypeOf<UiFeedbackAction>();
    expectTypeOf<NonNullable<ToastData["actions"]>[number]>().toEqualTypeOf<UiFeedbackAction>();
    expectTypeOf<NonNullable<UiDisplayState["action"]>>().toEqualTypeOf<UiFeedbackAction>();
  });

  it("keeps toast payloads and display states intentionally separate", () => {
    expectTypeOf<ToastData["message"]>().toEqualTypeOf<string>();
    expectTypeOf<UiDisplayState["message"]>().toEqualTypeOf<string>();
    expectTypeOf<HasKey<ToastData, "title">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<UiDisplayState, "title">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<ToastData, "progress">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<UiDisplayState, "progress">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<ToastData, "severity">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<UiDisplayState, "severity">>().toEqualTypeOf<false>();
  });
});
