import { Monitor, Rss, Thermometer } from "lucide-react";
import { FreshRssLogoIcon, InoreaderLogoIcon } from "@/components/icons/provider-icons";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import type { ServiceCategory, ServiceDefinition } from "./add-account-services.types";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    labelKey: "account.category_local",
    services: [
      {
        kind: "Local",
        icon: Monitor,
        iconBg: "bg-orange-500",
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
        iconBg: "bg-[#0062BE]",
        nameKey: "account.freshrss",
        descKey: "account.freshrss_desc",
      },
      {
        kind: "Fever",
        icon: Thermometer,
        iconBg: "bg-gray-500",
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
        iconBg: "bg-[#2BB24C]",
        nameKey: "account.feedly",
        descKey: "account.coming_soon",
        disabled: true,
      },
      {
        kind: "Inoreader",
        icon: InoreaderLogoIcon,
        iconBg: "bg-[#1875F3]",
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
