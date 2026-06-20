import { Monitor, Rss, Thermometer } from "lucide-react";
import type { ComponentType } from "react";
import { FreshRssLogoIcon } from "@/components/icons/provider-icons";
import { PROVIDER_ICON_BG_CLASS } from "@/design-system";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";

type DisabledServiceKind = "Feedbin" | "Feedly" | "Fever" | "NewsBlur";

export type ServiceCategoryLabelKey =
  | "account.category_local"
  | "account.category_self_hosted"
  | "account.category_services";
export type ServiceNameKey =
  | "account.local_feeds"
  | "account.freshrss"
  | "account.fever"
  | "account.feedbin"
  | "account.feedly"
  | "account.newsblur";
export type ServiceDescriptionKey =
  | "account.local_desc"
  | "account.freshrss_desc"
  | "account.fever_desc"
  | "account.feedbin_hold_desc"
  | "account.feedly_hold_desc";

export type ServicePresentation = {
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  name: string;
  description: string;
};

type ServiceDefinitionBase = {
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  nameKey: ServiceNameKey;
  descKey: ServiceDescriptionKey;
  beta?: boolean;
};

export type EnabledServiceDefinition = ServiceDefinitionBase & {
  kind: AddAccountProviderKind;
  disabled?: false;
};

export type DisabledServiceDefinition = ServiceDefinitionBase & {
  kind: DisabledServiceKind;
  disabled: true;
};

export type ServiceDefinition = EnabledServiceDefinition | DisabledServiceDefinition;

export type ServiceCategory = {
  labelKey: ServiceCategoryLabelKey;
  services: ServiceDefinition[];
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    labelKey: "account.category_local",
    services: [
      {
        kind: "Local",
        icon: Monitor,
        iconBg: PROVIDER_ICON_BG_CLASS.Local,
        nameKey: "account.local_feeds",
        descKey: "account.local_desc",
      },
    ],
  },
  {
    labelKey: "account.category_self_hosted",
    services: [
      {
        kind: "FreshRss",
        icon: FreshRssLogoIcon,
        iconBg: PROVIDER_ICON_BG_CLASS.FreshRss,
        nameKey: "account.freshrss",
        descKey: "account.freshrss_desc",
      },
      {
        kind: "Fever",
        icon: Thermometer,
        iconBg: PROVIDER_ICON_BG_CLASS.Fever,
        nameKey: "account.fever",
        descKey: "account.fever_desc",
        disabled: true,
      },
    ],
  },
  {
    labelKey: "account.category_services",
    services: [
      {
        kind: "Feedly",
        icon: Rss,
        iconBg: PROVIDER_ICON_BG_CLASS.Feedly,
        nameKey: "account.feedly",
        descKey: "account.feedly_hold_desc",
        disabled: true,
      },
      {
        kind: "NewsBlur",
        icon: Rss,
        iconBg: "bg-[#E9A33A]",
        nameKey: "account.newsblur",
        descKey: "account.feedly_hold_desc",
        disabled: true,
      },
      {
        kind: "Feedbin",
        icon: Rss,
        iconBg: "bg-[#F04E23]",
        nameKey: "account.feedbin",
        descKey: "account.feedbin_hold_desc",
        disabled: true,
      },
    ],
  },
];

export function findServiceDefinition(kind: AddAccountProviderKind): ServiceDefinition | null {
  for (const category of SERVICE_CATEGORIES) {
    for (const service of category.services) {
      if (service.kind === kind) {
        return service;
      }
    }
  }

  return null;
}

function isEnabledServiceDefinition(service: ServiceDefinition): service is EnabledServiceDefinition {
  return !service.disabled;
}

function isDisabledServiceDefinition(service: ServiceDefinition): service is DisabledServiceDefinition {
  return service.disabled === true;
}

export function getEnabledServiceDefinitions(): EnabledServiceDefinition[] {
  return SERVICE_CATEGORIES.flatMap((category) => category.services.filter(isEnabledServiceDefinition));
}

export function getDisabledServiceDefinitions(): DisabledServiceDefinition[] {
  return SERVICE_CATEGORIES.flatMap((category) => category.services.filter(isDisabledServiceDefinition));
}
