import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeading } from "@/components/shared/section-heading";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "./add-account-services";
import type { ServicePickerProps } from "./add-account-services.types";

export function ServicePicker({ onSelect }: ServicePickerProps) {
  const { t } = useTranslation("settings");

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("account.heading")}…</h2>
      <div className="space-y-4">
        {SERVICE_CATEGORIES.map((category) => {
          const labelId = `service-category-${category.labelKey}`;
          return (
            <fieldset key={category.labelKey} aria-labelledby={labelId}>
              <legend id={labelId}>
                <SectionHeading>{t(category.labelKey as "account.category_local")}</SectionHeading>
              </legend>
              <ul className="space-y-0.5">
                {category.services.map((service) => (
                  <li key={service.kind}>
                    <button
                      type="button"
                      disabled={service.disabled}
                      onClick={() => {
                        if (!service.disabled) {
                          onSelect(service.kind as AddAccountProviderKind);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5",
                        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        service.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent",
                      )}
                    >
                      <div
                        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", service.iconBg)}
                      >
                        <service.icon className="h-[18px] w-[18px] text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{t(service.nameKey as "account.local_feeds")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t(service.descKey as "account.local_desc")}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
