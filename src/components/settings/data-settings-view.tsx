import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";

export type DataSettingsViewProps = {
  title: string;
  databaseHeading: string;
  databaseSizeLabel: string;
  databaseSizeValue: string;
  optimizationHeading: string;
  vacuumDescription: string;
  vacuumLabel: string;
  vacuuming: boolean;
  logsHeading: string;
  openLogDirDescription: string;
  openLogDirLabel: string;
  onVacuum: () => void;
  onOpenLogDir: () => void;
};

export function DataSettingsView({
  title,
  databaseHeading,
  databaseSizeLabel,
  databaseSizeValue,
  optimizationHeading,
  vacuumDescription,
  vacuumLabel,
  vacuuming,
  logsHeading,
  openLogDirDescription,
  openLogDirLabel,
  onVacuum,
  onOpenLogDir,
}: DataSettingsViewProps) {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{title}</h2>
      <section className="mb-5 sm:mb-6">
        <SectionHeading className="mb-2 sm:mb-3">{databaseHeading}</SectionHeading>
        <LabeledControlRow label={databaseSizeLabel}>
          <span className="text-sm text-muted-foreground">{databaseSizeValue}</span>
        </LabeledControlRow>
      </section>
      <section className="mb-5 sm:mb-6">
        <SectionHeading className="mb-2 sm:mb-3">{optimizationHeading}</SectionHeading>
        <p className="mb-2.5 text-xs text-muted-foreground sm:mb-3">{vacuumDescription}</p>
        <Button variant="outline" size="sm" disabled={vacuuming} onClick={onVacuum}>
          {vacuumLabel}
        </Button>
      </section>
      <section>
        <SectionHeading className="mb-2 sm:mb-3">{logsHeading}</SectionHeading>
        <p className="mb-2.5 text-xs text-muted-foreground sm:mb-3">{openLogDirDescription}</p>
        <Button variant="outline" size="sm" onClick={onOpenLogDir}>
          {openLogDirLabel}
        </Button>
      </section>
    </div>
  );
}
