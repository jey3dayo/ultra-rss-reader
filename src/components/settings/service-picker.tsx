import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LabelChip } from "@/components/shared/label-chip";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { SectionHeading } from "@/components/shared/section-heading";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "./add-account-services";
import type { ServicePickerProps } from "./add-account-services.types";

export function ServicePicker({ onSelect }: ServicePickerProps) {
  const { t } = useTranslation("settings");

  return (
    <div
      data-testid="service-picker-surface"
      className="rounded-lg border border-border bg-surface-1 p-6 shadow-elevation-1"
    >
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
                    <NavRowButton
                      disabled={service.disabled}
                      onClick={() => {
                        if (!service.disabled) {
                          onSelect(service.kind as AddAccountProviderKind);
                        }
                      }}
                      className={cn("items-center rounded-md px-3 py-2.5")}
                      leading={
                        <div
                          className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", service.iconBg)}
                        >
                          <service.icon className="h-[18px] w-[18px] text-white" />
                        </div>
                      }
                      title={
                        <div className="flex items-center gap-2">
                          <span>{t(service.nameKey as "account.local_feeds")}</span>
                          {service.beta ? (
                            <LabelChip tone="warning" size="compact" className="rounded-md px-1.5 py-0.5">
                              {t("account.beta_badge")}
                            </LabelChip>
                          ) : null}
                        </div>
                      }
                      description={<div>{t(service.descKey as "account.local_desc")}</div>}
                      trailing={service.disabled ? null : <ChevronRight className="h-4 w-4 text-foreground-soft" />}
                    />
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
