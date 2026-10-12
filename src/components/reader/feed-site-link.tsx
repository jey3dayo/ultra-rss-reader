import { Globe } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "@/design-system";

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
    <Link href={href} title={title} dir={dir} onClick={handleClick} onAuxClick={handleAuxClick} className={className}>
      {icon ? <Globe aria-hidden="true" className="size-[1.1em] shrink-0" /> : null}
      {children}
    </Link>
  );
}
