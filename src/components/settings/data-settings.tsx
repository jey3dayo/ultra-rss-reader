import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDatabaseInfo, vacuumDatabase } from "@/api/tauri-commands";
import { SectionHeading } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((s) => s.showToast);
  const setSettingsLoading = useUiStore((s) => s.setSettingsLoading);
  const [totalSize, setTotalSize] = useState<number | null>(null);
  const [vacuuming, setVacuuming] = useState(false);

  const fetchDbInfo = useCallback(async () => {
    Result.pipe(
      await getDatabaseInfo(),
      Result.inspect((info) => setTotalSize(info.total_size_bytes)),
      Result.inspectError((e) => console.error("Failed to get database info:", e)),
    );
  }, []);

  useEffect(() => {
    fetchDbInfo();
  }, [fetchDbInfo]);

  const handleVacuum = async () => {
    if (vacuuming) return;
    const sizeBefore = totalSize;
    setVacuuming(true);
    setSettingsLoading(true);
    try {
      Result.pipe(
        await vacuumDatabase(),
        Result.inspect((info) => {
          setTotalSize(info.total_size_bytes);
          const saved = sizeBefore != null ? sizeBefore - info.total_size_bytes : 0;
          showToast(t("data.vacuum_success", { saved: saved > 0 ? `-${formatBytes(saved)}` : formatBytes(0) }));
        }),
        Result.inspectError((e) => {
          console.error("VACUUM failed:", e);
          showToast(t("data.vacuum_failed", { message: e.message }));
        }),
      );
    } finally {
      setVacuuming(false);
      setSettingsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("data.heading")}</h2>
      <section className="mb-6">
        <SectionHeading>{t("data.database")}</SectionHeading>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">{t("data.database_size")}</span>
          <span className="text-sm text-muted-foreground">{totalSize != null ? formatBytes(totalSize) : "..."}</span>
        </div>
      </section>
      <section>
        <SectionHeading>{t("data.optimization")}</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">{t("data.vacuum_description")}</p>
        <Button variant="outline" size="sm" disabled={vacuuming} onClick={handleVacuum}>
          {vacuuming ? t("data.vacuuming") : t("data.vacuum")}
        </Button>
      </section>
    </div>
  );
}
