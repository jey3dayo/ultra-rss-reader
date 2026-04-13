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

export function InoreaderLogoIcon({ className, ...props }: ProviderIconProps) {
  return (
    <svg viewBox="0 0 180 180" fill="none" aria-hidden="true" className={className} {...props}>
      <path
        fill="currentColor"
        d="M90 33.046875C121.454342 33.046875 146.953125 58.545658 146.953125 90S121.454342 146.953125 90 146.953125 33.046875 121.454342 33.046875 90 58.545658 33.046875 90 33.046875Zm17.085938 22.78125C97.649635 55.828125 90 63.47776 90 72.914062S97.649635 90 107.085938 90 124.171875 82.350365 124.171875 72.914062 116.52224 55.828125 107.085938 55.828125Z"
      />
    </svg>
  );
}
