import { getBrowserGeometryStripItems } from "@/lib/browser-debug-geometry";
import type { BrowserDiagnosticsRailProps } from "./browser-view.types";

export function BrowserDiagnosticsRail({
  layoutDiagnostics,
  nativeDiagnostics,
  compact,
  top,
}: BrowserDiagnosticsRailProps) {
  const items = getBrowserGeometryStripItems({ layoutDiagnostics, nativeDiagnostics }, compact);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="browser-overlay-diagnostics"
      style={{ top: `${top}px` }}
      className={
        compact
          ? "pointer-events-none absolute left-1/2 z-[90] w-[calc(100vw-7.5rem)] max-w-[calc(100vw-7.5rem)] -translate-x-1/2"
          : "pointer-events-none absolute left-1/2 z-[90] w-[min(780px,calc(100vw-11rem))] -translate-x-1/2"
      }
    >
      <div
        className={
          compact
            ? "mx-auto flex min-w-0 max-w-full items-center justify-start gap-2 overflow-x-auto rounded-2xl border border-white/12 bg-black/68 px-3 py-1.5 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]"
            : "mx-auto flex min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/12 bg-black/62 px-4 py-2 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]"
        }
      >
        {items.map((item, index) => (
          <span key={item} className="contents">
            <span className="shrink-0">{item}</span>
            {index < items.length - 1 ? <span className="shrink-0 text-white/44">•</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
