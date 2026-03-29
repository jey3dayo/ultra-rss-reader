import { useCallback, useRef, useState } from "react";
import { AccountConfigForm } from "@/components/settings/account-config-form";
import { ServicePicker } from "@/components/settings/service-picker";
import type { AddAccountProviderKind } from "@/lib/add-account-form";

type Step = { type: "pick" } | { type: "config"; kind: AddAccountProviderKind };

export function AddAccountForm() {
  const [step, setStep] = useState<Step>({ type: "pick" });
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((kind: AddAccountProviderKind) => {
    setDirection("forward");
    setStep({ type: "config", kind });
  }, []);

  const handleBack = useCallback(() => {
    setDirection("backward");
    setStep({ type: "pick" });
  }, []);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <div
        className="transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          transform: step.type === "pick" ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Step 1: Service Picker (always rendered for transition) */}
        <div className="w-full">
          <ServicePicker onSelect={handleSelect} />
        </div>
      </div>

      {/* Step 2: Account Config Form (slides in from right) */}
      {step.type === "config" && (
        <div
          className="absolute inset-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            transform: "translateX(0)",
            animation: direction === "forward" ? "slideInFromRight 200ms ease-out" : undefined,
          }}
        >
          <AccountConfigForm kind={step.kind} onBack={handleBack} />
        </div>
      )}

      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes slideInFromRight {
            from { transform: translateX(0); }
            to { transform: translateX(0); }
          }
        }
      `}</style>
    </div>
  );
}
