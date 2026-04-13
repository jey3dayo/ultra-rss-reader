import { Copy } from "lucide-react";
import { useId, useState } from "react";
import type { BrowserDebugGeometryRow } from "@/lib/browser-debug-geometry";
import { cn } from "@/lib/utils";

const EMPTY_BROWSER_GEOMETRY_ROWS: BrowserDebugGeometryRow[] = [];

function extractCollapsedSummaryParts(description: string) {
  const labelMatch = description.match(/label=(.+)$/);
  const roleMatch = description.match(/role=([^\s|]+)/);
  const elementMatch = description.match(/^([^\s|]+)/);

  const label = labelMatch?.[1]?.trim() ?? description;
  const metaParts = [elementMatch?.[1], roleMatch ? `role=${roleMatch[1]}` : null].filter(Boolean);

  return {
    label,
    meta: metaParts.join(" | "),
  };
}

export type FocusDebugHudViewProps = {
  focusedPane: string;
  contentMode: string;
  selectedArticleId: string | null;
  browserCloseInFlight: boolean;
  pendingBrowserCloseAction: string | null;
  activeElementDescription: string;
  browserGeometryRows?: BrowserDebugGeometryRow[];
  traces: string[];
  onCopyClick: () => void;
  onCopyPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  defaultExpanded?: boolean;
  defaultShowGeometry?: boolean;
};

export function FocusDebugHudView({
  focusedPane,
  contentMode,
  selectedArticleId,
  browserCloseInFlight,
  pendingBrowserCloseAction,
  activeElementDescription,
  browserGeometryRows = EMPTY_BROWSER_GEOMETRY_ROWS,
  traces,
  onCopyClick,
  onCopyPointerDown,
  defaultExpanded = false,
  defaultShowGeometry = false,
}: FocusDebugHudViewProps) {
  const [expanded, setExpanded] = useState(() => defaultExpanded);
  const [showGeometry, setShowGeometry] = useState(() => defaultShowGeometry);
  const tracePanelId = useId();
  const geometryPanelId = useId();

  const visibleTraces = expanded ? traces : traces.slice(-2);
  const latestTrace = traces.length > 0 ? traces[traces.length - 1] : "No trace yet";
  const collapsedSummary = extractCollapsedSummaryParts(activeElementDescription);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[2147483647] max-w-[min(28rem,calc(100vw-1rem))]">
      <section
        data-debug-hud=""
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden transition-[width,height,opacity,background-color,border-color,box-shadow] duration-200",
          expanded ? "w-[min(24rem,calc(100vw-1rem))]" : "w-[min(20rem,calc(100vw-1rem))]",
          expanded ? "h-[min(22rem,calc(100vh-2rem))]" : "h-auto",
          expanded
            ? "rounded-2xl border border-white/8 bg-black/76 opacity-88 hover:opacity-60 focus-within:opacity-100"
            : "rounded-2xl border border-white/6 bg-black/56 opacity-80 hover:border-white/10 hover:bg-black/40 hover:opacity-35 focus-within:border-white/14 focus-within:bg-black/72 focus-within:opacity-100",
          "backdrop-blur-md",
          expanded ? "shadow-[0_16px_38px_rgba(0,0,0,0.36)]" : "shadow-[0_14px_30px_rgba(0,0,0,0.22)]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/48">Debug HUD</p>
            <p className="mt-1 font-mono text-[11px] leading-5 text-white/92">
              pane={focusedPane} mode={contentMode}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              aria-controls={tracePanelId}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2",
                "text-[11px] font-medium text-white/76 transition-colors",
                "hover:border-white/22 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/24",
              )}
            >
              {expanded ? "Less" : "More"}
            </button>
            <button
              type="button"
              aria-label="Copy debug HUD"
              onClick={onCopyClick}
              onPointerDown={onCopyPointerDown}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-white/14 bg-white/[0.04] px-3 py-2",
                "text-[11px] font-medium text-white/88 transition-colors",
                "hover:border-white/24 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/24",
              )}
            >
              <Copy className="size-3.5" />
              Copy
            </button>
          </div>
        </header>

        {expanded ? (
          <div className="grid gap-2 border-b border-white/10 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-xl border border-white/6 bg-white/[0.03] px-2.5 py-2 font-mono text-[11px] leading-5 text-white/84">
              <div className="truncate">{`article=${selectedArticleId ?? "none"}`}</div>
              <div className="line-clamp-2 text-white/60">{activeElementDescription}</div>
            </div>
            <div className="flex min-w-[7.5rem] flex-col justify-center rounded-xl border border-white/6 bg-white/[0.03] px-2.5 py-2 font-mono text-[11px] leading-5 text-white/72">
              <div>closing={String(browserCloseInFlight)}</div>
              <div>pending={pendingBrowserCloseAction ?? "none"}</div>
            </div>
          </div>
        ) : (
          <div className="border-b border-white/10 px-3 py-2">
            <div className="rounded-xl border border-white/6 bg-white/[0.03] px-2.5 py-2">
              <div className="line-clamp-2 text-[12px] font-medium leading-5 text-white/84">
                {collapsedSummary.label}
              </div>
              {collapsedSummary.meta ? (
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/34">
                  {collapsedSummary.meta}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/58">
                  closing={String(browserCloseInFlight)}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/58">
                  pending={pendingBrowserCloseAction ?? "none"}
                </span>
              </div>
            </div>
          </div>
        )}

        {expanded && browserGeometryRows.length > 0 ? (
          <div className="border-b border-white/10 px-3 py-2">
            <div className="rounded-xl border border-white/6 bg-white/[0.03] px-2.5 py-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/42">Geometry</div>
                <button
                  type="button"
                  onClick={() => setShowGeometry((current) => !current)}
                  aria-expanded={showGeometry}
                  aria-controls={geometryPanelId}
                  className={cn(
                    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 py-2",
                    "text-[10px] font-medium uppercase tracking-[0.16em] text-white/52 transition-colors",
                    "hover:bg-white/[0.04] hover:text-white/82 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/24",
                  )}
                >
                  {showGeometry ? "Hide" : "Show"}
                </button>
              </div>
              {showGeometry ? (
                <div
                  id={geometryPanelId}
                  className="grid gap-x-3 gap-y-1.5 font-mono text-[11px] leading-5 sm:grid-cols-[auto_minmax(0,1fr)]"
                >
                  {browserGeometryRows.map((row) => (
                    <div key={`${row.label}:${row.value}`} className="contents">
                      <div className="text-white/46">{row.label}</div>
                      <div className="break-words text-white/82">{row.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="font-mono text-[11px] leading-5 text-white/56">
                  {browserGeometryRows.map((row) => row.label).join(" · ")}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {expanded ? (
          <div id={tracePanelId} className="min-h-0 flex-1 px-2 py-2">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/8 bg-black/28">
              <div className="border-b border-white/8 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/42">
                Trace
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2 font-mono text-[11px] leading-5 text-white/68">
                {visibleTraces.length > 0 ? (
                  visibleTraces.map((trace) => (
                    <div key={trace} className="break-words">
                      {trace}
                    </div>
                  ))
                ) : (
                  <div className="text-white/36">No trace yet</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2">
            <div className="rounded-xl border border-white/8 bg-black/28 px-2.5 py-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/42">Recent events</div>
              <div className="mt-1.5 font-mono text-[11px] leading-5 text-white/68">
                <div className="line-clamp-2 break-words">{latestTrace}</div>
                {visibleTraces.length > 1 ? (
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/34">
                    +{visibleTraces.length - 1} more
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
