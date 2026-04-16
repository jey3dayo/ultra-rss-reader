import { Monitor, Rss, Thermometer } from "lucide-react";
import { FreshRssLogoIcon, InoreaderLogoIcon } from "@/components/icons/provider-icons";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import type { ServiceCategory, ServiceDefinition } from "./add-account-services.types";

export const PROVIDER_ICON_BG_CLASS = {
  Local: "bg-orange-500",
  FreshRss: "bg-[#0062BE]",
  Fever: "bg-gray-500",
  Feedly: "bg-[#2BB24C]",
  Inoreader: "bg-[#1875F3]",
} as const satisfies Record<ServiceDefinition["kind"], string>;

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
        descKey: "account.coming_soon",
        disabled: true,
      },
      {
        kind: "Inoreader",
        icon: InoreaderLogoIcon,
        iconBg: PROVIDER_ICON_BG_CLASS.Inoreader,
        nameKey: "account.inoreader",
        descKey: "account.coming_soon",
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
