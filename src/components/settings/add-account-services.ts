import { Monitor, Thermometer } from "lucide-react";
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
        kind: "Inoreader",
        icon: InoreaderLogoIcon,
        iconBg: "bg-[#1875F3]",
        nameKey: "account.inoreader",
        descKey: "account.inoreader_desc",
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
