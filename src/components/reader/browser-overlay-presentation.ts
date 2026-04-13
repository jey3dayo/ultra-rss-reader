export function getBrowserOverlayCloseButtonClass(isCompactViewer: boolean) {
  return isCompactViewer
    ? "pointer-events-auto border border-white/10 bg-black/32 text-white/92 shadow-[0_10px_26px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/18 hover:bg-white/12 hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)] focus-visible:border-white/18 focus-visible:bg-white/14 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/18 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/20 active:bg-white/18 active:shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
    : "pointer-events-auto border border-white/12 bg-black/30 text-white/96 shadow-[0_12px_30px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/20 hover:bg-black/44 hover:text-white hover:shadow-[0_14px_32px_rgba(0,0,0,0.3)] focus-visible:border-white/22 focus-visible:bg-black/48 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/22 active:bg-black/54 active:shadow-[0_10px_20px_rgba(0,0,0,0.24)]";
}

export function getBrowserOverlayActionButtonClass(isCompactViewer: boolean) {
  return isCompactViewer
    ? "pointer-events-auto border border-white/10 bg-black/32 text-white/92 shadow-[0_10px_26px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/18 hover:bg-white/12 hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)] focus-visible:border-white/18 focus-visible:bg-white/14 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/18 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/20 active:bg-white/18 active:shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
    : "pointer-events-auto border border-white/12 bg-black/26 text-white/94 shadow-[0_12px_30px_rgba(0,0,0,0.3)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/20 hover:bg-black/40 hover:text-white hover:shadow-[0_14px_32px_rgba(0,0,0,0.28)] focus-visible:border-white/22 focus-visible:bg-black/44 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/22 active:bg-black/50 active:shadow-[0_10px_20px_rgba(0,0,0,0.24)]";
}

export function getBrowserOverlayStageClass(scope: "content-pane" | "main-stage") {
  return scope === "main-stage"
    ? "absolute z-10 overflow-hidden bg-background"
    : "absolute z-10 overflow-hidden border border-white/6 bg-background shadow-[0_20px_48px_rgba(0,0,0,0.24)]";
}
