import { ChevronDown, ChevronUp, Copy, MoveDiagonal2, X } from "lucide-react";
import { useId, useState } from "react";
import { DebugHudActionButton } from "@/components/debug/debug-hud-action-button";
import { DebugHudFrame } from "@/components/debug/debug-hud-frame";
import type { BrowserDebugGeometryRow } from "@/lib/browser-debug-geometry";
import { cn } from "@/lib/utils";

const EMPTY_BROWSER_GEOMETRY_ROWS: BrowserDebugGeometryRow[] = [];
const DEBUG_HUD_INNER_CARD_CLASS =
  "debug-hud-inner-card rounded-lg border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const DEBUG_HUD_INNER_CARD_LIGHT_CLASS = `${DEBUG_HUD_INNER_CARD_CLASS} bg-white/[0.045]`;
const DEBUG_HUD_INNER_CARD_DARK_CLASS = `${DEBUG_HUD_INNER_CARD_CLASS} bg-black/24`;
const DEBUG_HUD_QUIET_BADGE_CLASS =
  "rounded-full border border-white/8 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/58";
const DEBUG_HUD_POSITIONS = ["bottom-right", "top-left", "top-right", "bottom-left"] as const;

type DebugHudPosition = (typeof DEBUG_HUD_POSITIONS)[number];

const DEBUG_HUD_POSITION_CLASS: Record<DebugHudPosition, string> = {
  "bottom-right": "right-4 bottom-4",
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-left": "bottom-4 left-4",
};

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
  onCloseClick: () => void;
  onCopyPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  defaultExpanded?: boolean;
  defaultShowGeometry?: boolean;
  temporarilyHidden?: boolean;
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
  onCloseClick,
  onCopyPointerDown,
  defaultExpanded = false,
  defaultShowGeometry = false,
  temporarilyHidden = false,
}: FocusDebugHudViewProps) {
  const [expanded, setExpanded] = useState(() => defaultExpanded);
  const [showGeometry, setShowGeometry] = useState(() => defaultShowGeometry);
  const [position, setPosition] = useState<DebugHudPosition>("bottom-right");
  const tracePanelId = useId();
  const geometryPanelId = useId();

  const visibleTraces = expanded ? traces : traces.slice(-2);
  const latestTrace = traces.length > 0 ? traces[traces.length - 1] : "No trace yet";
  const collapsedSummary = extractCollapsedSummaryParts(activeElementDescription);
  const moveHud = () => {
    setPosition((currentPosition) => {
      const currentIndex = DEBUG_HUD_POSITIONS.indexOf(currentPosition);
      return DEBUG_HUD_POSITIONS[(currentIndex + 1) % DEBUG_HUD_POSITIONS.length];
    });
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[2147483647] max-w-[min(28rem,calc(100vw-1rem))]",
        DEBUG_HUD_POSITION_CLASS[position],
        temporarilyHidden && "hidden",
      )}
      aria-hidden={temporarilyHidden || undefined}
    >
      <DebugHudFrame
        as="section"
        data-debug-hud=""
        surface={expanded ? "panelExpanded" : "panelCollapsed"}
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden transition-[width,height,opacity,background-color,border-color,box-shadow] duration-200",
          expanded ? "w-[min(24rem,calc(100vw-1rem))]" : "w-[min(20rem,calc(100vw-1rem))]",
          expanded ? "h-[min(22rem,calc(100vh-2rem))]" : "h-auto",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/48">Debug HUD</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className={DEBUG_HUD_QUIET_BADGE_CLASS}>{`pane=${focusedPane}`}</span>
              <span className={DEBUG_HUD_QUIET_BADGE_CLASS}>{`mode=${contentMode}`}</span>
            </div>
          </div>
          <div className="-mr-1 flex items-center gap-1">
            <DebugHudActionButton type="button" onClick={moveHud} aria-label="Move debug HUD" className="size-8 px-0">
              <MoveDiagonal2 className="size-3.5" />
            </DebugHudActionButton>
            <DebugHudActionButton
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-label={expanded ? "Collapse debug HUD" : "Expand debug HUD"}
              aria-expanded={expanded}
              aria-controls={tracePanelId}
              className="size-8 px-0"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </DebugHudActionButton>
            <DebugHudActionButton
              type="button"
              aria-label="Copy debug HUD"
              onClick={onCopyClick}
              onPointerDown={onCopyPointerDown}
              className="size-8 px-0"
            >
              <Copy className="size-3.5" />
            </DebugHudActionButton>
            <DebugHudActionButton
              type="button"
              aria-label="Hide debug HUD"
              onClick={onCloseClick}
              className="size-8 px-0"
            >
              <X className="size-3.5" />
            </DebugHudActionButton>
          </div>
        </header>

        {expanded ? (
          <div className="grid grid-cols-1 gap-2 border-b border-white/10 px-3 py-2">
            <div
              className={cn(
                DEBUG_HUD_INNER_CARD_LIGHT_CLASS,
                "px-2.5 py-2 font-mono text-[11px] leading-5 text-white/84",
              )}
            >
              <div className="mb-1 whitespace-nowrap text-[10px] tracking-[0.12em] text-white/42">Focused element</div>
              <div className="truncate">{`article=${selectedArticleId ?? "none"}`}</div>
              <div className="line-clamp-2 text-white/60">{activeElementDescription}</div>
            </div>
            <div
              className={cn(
                DEBUG_HUD_INNER_CARD_LIGHT_CLASS,
                "flex min-w-[7.5rem] flex-wrap content-start gap-1.5 px-2.5 py-2",
              )}
            >
              <span className={DEBUG_HUD_QUIET_BADGE_CLASS}>{`closing=${String(browserCloseInFlight)}`}</span>
              <span className={DEBUG_HUD_QUIET_BADGE_CLASS}>{`pending=${pendingBrowserCloseAction ?? "none"}`}</span>
            </div>
          </div>
        ) : (
          <div className="border-b border-white/10 px-3 py-2">
            <div className={cn(DEBUG_HUD_INNER_CARD_LIGHT_CLASS, "px-2.5 py-2")}>
              <div className="line-clamp-2 text-[12px] font-medium leading-5 text-white/84">
                {collapsedSummary.label}
              </div>
              {collapsedSummary.meta ? (
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/34">
                  {collapsedSummary.meta}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={DEBUG_HUD_QUIET_BADGE_CLASS}>{`closing=${String(browserCloseInFlight)}`}</span>
                <span className={DEBUG_HUD_QUIET_BADGE_CLASS}>{`pending=${pendingBrowserCloseAction ?? "none"}`}</span>
              </div>
            </div>
          </div>
        )}

        {expanded && browserGeometryRows.length > 0 ? (
          <div className="border-b border-white/10 px-3 py-2">
            <div className={cn(DEBUG_HUD_INNER_CARD_LIGHT_CLASS, "px-2.5 py-2")}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/42">Geometry</div>
                <DebugHudActionButton
                  type="button"
                  onClick={() => setShowGeometry((current) => !current)}
                  aria-expanded={showGeometry}
                  aria-controls={geometryPanelId}
                  className="h-8 border-transparent bg-transparent px-2 text-[11px] text-white/56 shadow-none hover:border-transparent hover:bg-white/[0.04] hover:text-white/82 focus-visible:border-transparent focus-visible:bg-white/[0.04] focus-visible:text-white/82"
                >
                  {showGeometry ? "Hide" : "Show"}
                </DebugHudActionButton>
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
            <div className={cn(DEBUG_HUD_INNER_CARD_DARK_CLASS, "flex h-full min-h-0 flex-col overflow-hidden")}>
              <div className="border-b border-white/8 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/42">
                Recent events
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
            <div className={cn(DEBUG_HUD_INNER_CARD_DARK_CLASS, "px-2.5 py-2")}>
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
      </DebugHudFrame>
    </div>
  );
}
