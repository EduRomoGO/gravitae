// Icons drawn inline, in the colour of the text around them. Decorative: the
// control that holds one names its action in text, so every icon is hidden
// from assistive technology.

import type { ReactElement, ReactNode } from "react";

function Icon({
  className = "size-4",
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

interface IconProps {
  className?: string | undefined;
}

export function PlayIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <path
        d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z"
        fill="currentColor"
      />
    </Icon>
  );
}

export function PauseIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    </Icon>
  );
}

export function RestartIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.3" />
      <path d="M3 3v5.3h5.3" />
    </Icon>
  );
}

export function ArrowRightIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

/** An apple falling towards the ground: the gravitation law. */
export function FallingAppleIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <path d="M12 7.5c-1.6-1.2-5-1.2-6 1.8-1 3 .8 7.2 3.4 7.7.9.2 1.7-.3 2.6-.3s1.7.5 2.6.3c2.6-.5 4.4-4.7 3.4-7.7-1-3-4.4-3-6-1.8Z" />
      <path d="M12 7.5c0-1.6.6-3 2-4" />
      <path d="M4 21h16" />
    </Icon>
  );
}

/** Three bodies on one orbit: the three-body orbits. */
export function OrbitIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
      <circle cx="12" cy="4" r="2.2" fill="currentColor" />
      <circle cx="5.07" cy="16" r="2.2" fill="currentColor" />
      <circle cx="18.93" cy="16" r="2.2" fill="currentColor" />
    </Icon>
  );
}

/** An atom: the mark of the site. */
export function AtomIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <ellipse cx="12" cy="12" rx="10" ry="4.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** A magnifying glass: the finder of orbits. */
export function SearchIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </Icon>
  );
}

/** Three bars: the button that opens the header's menu on a phone. */
export function MenuIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  );
}

export function CloseIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}
