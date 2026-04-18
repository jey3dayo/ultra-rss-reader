import type { ProviderIconProps } from "./provider-icons.types";

export function FreshRssLogoIcon({ className, ...props }: ProviderIconProps) {
  return (
    <svg viewBox="0 0 256 256" fill="none" aria-hidden="true" className={className} {...props}>
      <circle cx="128" cy="128" r="33" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="24" strokeLinecap="round">
        <g opacity="0.32">
          <path d="M12 128a116 116 0 0 1 116-116" />
          <path d="M54 128a74 74 0 0 1 74-74" />
        </g>
        <path d="M128 12a116 116 0 0 1 116 116" />
        <path d="M128 54a74 74 0 0 1 74 74" />
      </g>
    </svg>
  );
}
