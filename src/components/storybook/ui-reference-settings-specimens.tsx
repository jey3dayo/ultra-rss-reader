import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useState } from "react";
import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { SectionHeading } from "@/components/shared/section-heading";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AnnotatedNote, ReferencePage } from "./ui-reference-canvas-specimens";

type FormRowsSpecimenProps = {
  livePreview: boolean;
  onLivePreviewChange: (next: boolean) => void;
};

export function ReferenceRadioGroup() {
  const [value, setValue] = useState("comfortable");

  return (
    <LabeledControlRow label="Reading mode" labelId="reference-reading-mode">
      <div className="flex w-full justify-end">
        <div className="w-full sm:max-w-[20rem]">
          <RadioGroup
            aria-labelledby="reference-reading-mode"
            aria-label="Reading mode"
            value={value}
            onValueChange={setValue}
            className="flex flex-wrap justify-end gap-2"
          >
            {[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ].map((option) => {
              const checked = value === option.value;

              return (
                // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Radio renders its own hidden input
                <label
                  key={option.value}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm shadow-elevation-1 transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    checked
                      ? "border-border-strong bg-surface-3 text-foreground"
                      : "border-border bg-surface-1 text-foreground/72 hover:bg-surface-2",
                  )}
                >
                  <Radio.Root
                    value={option.value}
                    aria-label={option.label}
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                      checked ? "border-primary bg-primary/10" : "border-border-strong bg-background",
                    )}
                  >
                    <Radio.Indicator className="size-2 rounded-full bg-primary" />
                  </Radio.Root>
                  <span aria-hidden="true">{option.label}</span>
                </label>
              );
            })}
          </RadioGroup>
        </div>
      </div>
    </LabeledControlRow>
  );
}

export function FormRowsSpecimen({ livePreview, onLivePreviewChange }: FormRowsSpecimenProps) {
  return (
    <SettingsSection
      heading="Form rows"
      note="Input / select / switch は既存の labeled row を再利用し、注釈は短く添える。"
    >
      <LabeledInputRow
        label="Display name"
        name="display_name"
        value="Main reader"
        onChange={() => {}}
        placeholder="Main reader"
        controlClassName="flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end"
        inputClassName="h-10 flex-1"
        actionLabel="Reset"
        actionClassName="h-10 px-4 text-sm font-medium"
        onAction={() => {}}
        actionDisabled={false}
      />
      <LabeledInputRow
        label="Tag name"
        name="tag_name"
        value="News"
        onChange={() => {}}
        placeholder="News"
        controlClassName="flex-col items-stretch sm:flex-row sm:items-center"
        inputClassName="h-10 flex-1"
        actionLabel="Create"
        actionAriaLabel="Create"
        actionClassName="h-10 w-full justify-center px-4 text-sm font-medium sm:w-auto"
        onAction={() => {}}
        actionDisabled={false}
      />
      <LabeledInputRow
        label="Feed URL"
        name="feed_url"
        type="url"
        value=""
        onChange={() => {}}
        placeholder="https://example.com/feed.xml"
        actionLabel="Discover"
        actionAriaLabel="Discover feed"
        actionPlacement="inside"
        onAction={() => {}}
      />
      <LabeledSelectRow
        label="Density"
        name="density"
        value="comfortable"
        options={[
          { value: "compact", label: "Compact" },
          { value: "comfortable", label: "Comfortable" },
          { value: "spacious", label: "Spacious" },
        ]}
        onChange={() => {}}
        triggerClassName="min-w-[11rem]"
      />
      <LabeledSwitchRow label="Live Preview" checked={livePreview} onChange={onLivePreviewChange} />
      <LabeledSwitchRow
        label="フィード切り替え時にトップへスクロール"
        checked={true}
        onChange={() => {}}
        labelClassName="sm:whitespace-nowrap"
      />
      <ReferenceRadioGroup />
    </SettingsSection>
  );
}

export function PrimitiveControlMatrixSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Primitive control states</SectionHeading>
      <div
        data-testid="reference-primitive-control-matrix"
        className="grid gap-3 rounded-md border border-border/70 bg-surface-1/90 p-3 md:grid-cols-2"
      >
        <div className="grid gap-2">
          <label htmlFor="reference-primitive-input-default" className="font-sans text-xs text-foreground/72">
            Input / default
          </label>
          <Input
            id="reference-primitive-input-default"
            aria-label="Primitive input default"
            defaultValue="https://example.com/feed.xml"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="reference-primitive-input-invalid" className="font-sans text-xs text-foreground/72">
            Input / invalid
          </label>
          <Input
            id="reference-primitive-input-invalid"
            aria-label="Primitive input invalid"
            defaultValue="freshrss.local"
            aria-invalid="true"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="reference-primitive-input-disabled" className="font-sans text-xs text-foreground/72">
            Input / disabled
          </label>
          <Input
            id="reference-primitive-input-disabled"
            aria-label="Primitive input disabled"
            defaultValue="Locked account"
            disabled
          />
        </div>
        <div className="grid gap-2">
          <span className="font-sans text-xs text-foreground/72">Select / default</span>
          <Select defaultValue="Comfortable">
            <SelectTrigger aria-label="Primitive select default" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="Compact">Compact</SelectItem>
              <SelectItem value="Comfortable">Comfortable</SelectItem>
              <SelectItem value="Spacious">Spacious</SelectItem>
            </SelectPopup>
          </Select>
        </div>
        <div className="grid gap-2">
          <span className="font-sans text-xs text-foreground/72">Select / invalid</span>
          <Select defaultValue="Missing folder">
            <SelectTrigger aria-label="Primitive select invalid" aria-invalid="true" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="Missing folder">Missing folder</SelectItem>
              <SelectItem value="Inbox">Inbox</SelectItem>
            </SelectPopup>
          </Select>
        </div>
        <div className="grid gap-2">
          <span className="font-sans text-xs text-foreground/72">Select / disabled</span>
          <Select defaultValue="Offline">
            <SelectTrigger aria-label="Primitive select disabled" className="w-full" disabled>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="Offline">Offline</SelectItem>
            </SelectPopup>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Checkbox / checked</span>
          <Checkbox aria-label="Primitive checkbox checked" checked onCheckedChange={() => {}} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Checkbox / disabled</span>
          <Checkbox aria-label="Primitive checkbox disabled" disabled />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Switch / checked</span>
          <Switch aria-label="Primitive switch checked" checked onCheckedChange={() => {}} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Switch / disabled</span>
          <Switch aria-label="Primitive switch disabled" disabled />
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        Low-level primitives stay thin. Use this matrix to verify base states before promoting a repeated product
        pattern into shared.
      </p>
    </SurfaceCard>
  );
}

export function ValidationRowSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Validation row</SectionHeading>
      <div data-testid="reference-validation-frame" className="rounded-md border border-border/70 bg-surface-1/90 p-3">
        <LabeledInputRow
          label="Server URL"
          name="invalid_server_url"
          value="freshrss.local"
          onChange={() => {}}
          placeholder="https://your-freshrss.example"
          inputClassName="border-state-danger-border ring-destructive/10"
        />
        <p className="pt-2 pl-[0.02rem] font-serif text-xs leading-[1.45] text-state-danger-foreground">
          URL は `https://` から始めてください。
        </p>
      </div>
    </SurfaceCard>
  );
}

export function DisabledSwitchSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Disabled switch</SectionHeading>
      <div
        data-testid="reference-disabled-switch-frame"
        className="rounded-md border border-border/70 bg-surface-1/90 px-3 py-2"
      >
        <LabeledControlRow label="ミュート時に自動既読">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-dashed border-border/70 px-2.5 py-1 text-[11px] text-foreground/72">
              工事中
            </span>
            <GradientSwitch checked={false} disabled aria-label="ミュート時に自動既読" />
          </div>
        </LabeledControlRow>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        利用予定だが今は無効、という状態の見本。注記と disabled control を同時に見せる。
      </p>
    </SurfaceCard>
  );
}

export function SettingsHeaderSummarySpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Settings header summary</SectionHeading>
      <div
        data-testid="reference-settings-header-summary-frame"
        className="grid gap-3 rounded-md border border-border/70 bg-card/30 p-3 shadow-none lg:grid-cols-3"
      >
        <div className="rounded-md border border-border/70 bg-background/88 p-3">
          <p className="mb-3 font-sans text-[20px] tracking-[-0.03em] text-foreground">FreshRSS</p>
          <AccountConnectionSummary statusLabel="確認済み" statusTone="success" detail="今日 01:06" />
        </div>
        <div className="rounded-md border border-border/70 bg-background/88 p-3">
          <p className="mb-3 font-sans text-[20px] tracking-[-0.03em] text-foreground">FreshRSS</p>
          <AccountConnectionSummary statusLabel="未確認" statusTone="warning" detail="まだ取得できていません" />
        </div>
        <div className="rounded-md border border-border/70 bg-background/88 p-3">
          <p className="mb-3 font-sans text-[20px] tracking-[-0.03em] text-foreground">FreshRSS</p>
          <AccountConnectionSummary statusLabel="未認証" statusTone="danger" detail="認証に失敗しています" />
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        settings の見出し右で account status を要約する見本。入力行ではなく header-level summary として扱う。
      </p>
    </SurfaceCard>
  );
}

export { AnnotatedNote, ReferencePage };
