import { cn } from "cn";
import { Globe } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

type FeedSiteLinkProps = {
  href: string;
  title: string;
  onOpen: (href: string, options: { external: boolean }) => void;
  className?: string;
  dir?: "auto" | "ltr" | "rtl";
  icon?: boolean;
  children: ReactNode;
};

export function FeedSiteLink({ href, title, onOpen, className, dir, icon = false, children }: FeedSiteLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onOpen(href, { external: event.metaKey || event.ctrlKey });
  }

  function handleAuxClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    onOpen(href, { external: true });
  }

  return (
    <a
      href={href}
      title={title}
      dir={dir}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      className={cn(
        "underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
        className,
      )}
    >
      {icon ? <Globe aria-hidden="true" className="size-[1.1em] shrink-0" /> : null}
      {children}
    </a>
  );
}
