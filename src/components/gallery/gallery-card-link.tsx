"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useCardDeparture } from "@/components/gallery/gallery-return";
import type { SolutionSlug } from "@/lib/orbits/solutions";
import { solutionPath } from "@/lib/routes";

const CardAttended = createContext(false);

/**
 * Whether the pointer is over, or the keyboard focus is on, the card that
 * contains the caller: the keyboard gets what the pointer gets.
 */
export function useCardAttended(): boolean {
  return useContext(CardAttended);
}

/** A card's link, which records where the gallery was left when it is followed. */
export function GalleryCardLink({
  slug,
  className,
  children,
}: {
  slug: SolutionSlug;
  className?: string;
  children: ReactNode;
}): ReactElement {
  const [pointerOver, setPointerOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const linkProps = useCardDeparture(slug);
  return (
    <Link
      {...linkProps}
      href={solutionPath(slug)}
      className={className}
      onMouseEnter={() => {
        setPointerOver(true);
      }}
      onMouseLeave={() => {
        setPointerOver(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
    >
      <CardAttended value={pointerOver || focused}>{children}</CardAttended>
    </Link>
  );
}
