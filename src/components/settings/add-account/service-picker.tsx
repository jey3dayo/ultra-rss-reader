import { ChevronRight } from "lucide-react";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { SectionHeading } from "@/components/shared/section-heading";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import { cn } from "@/lib/utils";
import type { ServiceDefinition, ServicePresentation } from "./services.types";

type DisabledServicePickerKind = Extract<ServiceDefinition, { disabled: true }>["kind"];

type ServicePickerService =
  | (ServicePresentation & {
      kind: AddAccountProviderKind;
      disabled?: false;
      disabledLabel?: never;
    })
  | (ServicePresentation & {
      kind: DisabledServicePickerKind;
      disabled: true;
      disabledLabel?: string;
    });

export type ServicePickerCategory = {
  id: string;
  label: string;
  services: ServicePickerService[];
};

type ServicePickerProps = {
  title: string;
  categories: ServicePickerCategory[];
  onSelect: (kind: AddAccountProviderKind) => void;
};

export function ServicePicker({ title, categories, onSelect }: ServicePickerProps) {
  return (
    <div
      data-testid="service-picker-surface"
      className="rounded-lg border border-border bg-surface-1 p-6 shadow-elevation-1"
    >
      <h2 className="mb-6 text-center text-lg font-semibold">{title}</h2>
      <div className="space-y-4">
        {categories.map((category) => {
          const labelId = `service-category-${category.id}`;
          return (
            <fieldset key={category.id} aria-labelledby={labelId}>
              <legend id={labelId}>
                <SectionHeading>{category.label}</SectionHeading>
              </legend>
              <ul className="space-y-0.5">
                {category.services.map((service) => (
                  <li key={service.kind}>
                    <NavRowButton
                      disabled={service.disabled}
                      onClick={() => {
                        if (!service.disabled) {
                          onSelect(service.kind);
                        }
                      }}
                      className={cn("items-center rounded-md px-3 py-2.5")}
                      leading={
                        <div
                          className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", service.iconBg)}
                        >
                          <service.icon className="size-4.5 text-white" />
                        </div>
                      }
                      title={
                        <div className="flex items-center gap-2">
                          <span>{service.name}</span>
                        </div>
                      }
                      description={
                        <div>
                          <span>{service.description}</span>
                          {service.disabled && service.disabledLabel ? (
                            <span className="ml-2">{service.disabledLabel}</span>
                          ) : null}
                        </div>
                      }
                      trailing={service.disabled ? null : <ChevronRight className="size-4 text-foreground-soft" />}
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
