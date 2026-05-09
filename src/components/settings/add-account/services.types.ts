import type { ComponentType } from "react";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";

export type ServiceKind = AddAccountProviderKind | "Feedbin" | "Feedly" | "Fever" | "Inoreader" | "NewsBlur";

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
  | "account.inoreader"
  | "account.newsblur";
export type ServiceDescriptionKey =
  | "account.local_desc"
  | "account.freshrss_desc"
  | "account.fever_desc"
  | "account.feedbin_hold_desc"
  | "account.feedly_hold_desc";

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
  kind: Exclude<ServiceKind, AddAccountProviderKind>;
  disabled: true;
};

export type ServiceDefinition = EnabledServiceDefinition | DisabledServiceDefinition;

export type ServiceCategory = {
  labelKey: ServiceCategoryLabelKey;
  services: ServiceDefinition[];
};
