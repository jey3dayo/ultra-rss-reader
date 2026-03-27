import { SectionHeading } from "@/components/settings/settings-components";

export function BionicReadingSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Bionic Reading</h2>

      <section className="mb-6">
        <SectionHeading>About</SectionHeading>
        <p className="text-sm text-muted-foreground">What is Bionic Reading?</p>
        <p className="mt-1 text-xs text-muted-foreground">bionic-reading.com</p>
      </section>

      <section>
        <SectionHeading>Preview and Configuration</SectionHeading>
        <p className="text-sm text-foreground">With Bionic Reading you read texts faster, better and more focused.</p>
        <p className="mt-3 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          Coming soon -- settings will be available in a future update.
        </p>
      </section>
    </div>
  );
}
