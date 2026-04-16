export function getBrowserOverlayLeadingActionClass(isCompactViewer: boolean) {
  return isCompactViewer
    ? "pointer-events-auto size-11 rounded-full border border-border/75 bg-background/78 text-foreground shadow-elevation-2 backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-border-strong hover:bg-card/92 hover:text-foreground focus-visible:border-border-strong focus-visible:bg-card/96 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0 active:scale-[0.97] active:border-border-strong active:bg-card active:shadow-elevation-1 md:size-8"
    : "pointer-events-auto h-8 rounded-full border border-border/75 bg-background/78 px-3 text-[0.78rem] font-medium tracking-[0.02em] text-foreground shadow-elevation-2 backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-border-strong hover:bg-card/92 hover:text-foreground focus-visible:border-border-strong focus-visible:bg-card/96 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0 active:scale-[0.97] active:border-border-strong active:bg-card active:shadow-elevation-1";
}

export function getBrowserOverlayActionButtonClass(isCompactViewer: boolean) {
  return isCompactViewer
    ? "pointer-events-auto rounded-full border border-border/75 bg-background/78 text-foreground shadow-elevation-2 backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-border-strong hover:bg-card/92 hover:text-foreground focus-visible:border-border-strong focus-visible:bg-card/96 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0 active:scale-[0.97] active:border-border-strong active:bg-card active:shadow-elevation-1"
    : "pointer-events-auto rounded-full border border-border/75 bg-background/78 text-foreground shadow-elevation-2 backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-border-strong hover:bg-card/92 hover:text-foreground focus-visible:border-border-strong focus-visible:bg-card/96 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0 active:scale-[0.97] active:border-border-strong active:bg-card active:shadow-elevation-1";
}

export function getBrowserOverlayStageClass(scope: "content-pane" | "main-stage") {
  return scope === "main-stage"
    ? "absolute z-10 overflow-hidden bg-background"
    : "absolute z-10 overflow-hidden border border-border/60 bg-background shadow-elevation-3";
}
