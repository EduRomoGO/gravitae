"use client";

// Text inside an SVG shrinks with the drawing: on a phone a 560-unit viewBox
// renders about 300 px wide, and a 12-unit label would read at 6 px. The
// experiments size every label in CSS pixels instead, and grow it in viewBox
// units by the zoom this hook measures, so it reads the same on every screen.
// The layout around each label grows with it.

import {
  useLayoutEffect,
  useState,
  type ReactElement,
  type RefObject,
  type SVGProps,
} from "react";

/** Font sizes in CSS pixels: tick marks and captions, names, read values. */
export const FONT = { small: 12, label: 13, value: 13 } as const;

/**
 * From this zoom on, about a 430 px wide drawing of 560 units, a drawing
 * whose labels no longer fit switches to its narrow layout.
 */
export const NARROW_ZOOM = 1.3;

/** Width of one character in ems, rounded up for digits and capitals. */
const CHARACTER_WIDTH = 0.6;
/** Width of a space or a mark of punctuation in ems. */
const NARROW_WIDTH = 0.3;
const NARROW = new Set([" ", ",", ".", ":", "/", "(", ")"]);
/** Distance between the baselines of two lines, in ems. */
export const LINE_HEIGHT = 1.25;

/**
 * How many viewBox units one CSS pixel takes in the element `ref` holds,
 * drawn `viewBoxWidth` units wide: 1 while the drawing renders at that width
 * or wider, about 1,9 for a 560-unit drawing on a phone. Before the first
 * measure, as on the server, it is 1.
 */
export function useTextZoom(
  ref: RefObject<Element | null>,
  viewBoxWidth: number,
): number {
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    function measure(width: number) {
      if (width <= 0) return;
      // Rounded, so a resize of a pixel does not lay the drawing out again.
      setZoom(Math.round(Math.max(1, viewBoxWidth / width) * 20) / 20);
    }
    measure(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref, viewBoxWidth]);
  return zoom;
}

/** Width a line of `text` takes at `fontSize`, an upper estimate. */
export function textWidth(text: string, fontSize: number): number {
  let ems = 0;
  for (const character of text)
    ems += NARROW.has(character) ? NARROW_WIDTH : CHARACTER_WIDTH;
  return ems * fontSize;
}

/** `text` broken between words into lines no wider than `maxWidth`. */
export function wrap(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (
      last !== undefined &&
      textWidth(`${last} ${word}`, fontSize) <= maxWidth
    )
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * Several lines of one `<text>`, the first baseline at `y`. Each line but the
 * last keeps its trailing space, so the text reads as one sentence.
 */
export function Lines({
  lines,
  x,
  y,
  fontSize,
  ...props
}: {
  lines: readonly string[];
  x: number;
  y: number;
  fontSize: number;
} & Omit<SVGProps<SVGTextElement>, "x" | "y" | "fontSize">): ReactElement {
  return (
    <text x={x} y={y} style={{ fontSize }} {...props}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : fontSize * LINE_HEIGHT}>
          {i < lines.length - 1 ? `${line} ` : line}
        </tspan>
      ))}
    </text>
  );
}
