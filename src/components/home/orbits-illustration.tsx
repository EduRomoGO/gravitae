import type { ReactElement } from "react";
import { BODY_COLORS } from "@/components/shared/body-colors";

// Decorative drawing of the home: three bodies going round one circle, the
// Lagrange solution, over the figure-eight one. It turns by CSS, and stays
// still when the system asks for reduced motion.

const CENTER = 200;
const LAGRANGE_RADIUS = 120;
const BODY_RADIUS = 13;
const FIGURE_EIGHT =
  "M200 200C240 132 352 124 362 200C352 276 240 268 200 200C160 132 48 124 38 200C48 276 160 268 200 200Z";
const STARS = [
  [34, 48, 1.6],
  [88, 22, 1.1],
  [352, 40, 1.8],
  [372, 118, 1.1],
  [22, 300, 1.2],
  [60, 368, 1.8],
  [330, 360, 1.3],
  [384, 290, 1.6],
  [150, 30, 1],
  [250, 378, 1.1],
] as const;

const SPIN_CLASS =
  "origin-center [transform-box:view-box] motion-safe:animate-[spin_36s_linear_infinite]";

export function OrbitsIllustration({
  className = "",
}: {
  className?: string;
}): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="home-glow">
          <stop offset="0" stopColor="rgb(139 92 246 / 0.28)" />
          <stop offset="1" stopColor="rgb(139 92 246 / 0)" />
        </radialGradient>
      </defs>
      <circle cx={CENTER} cy={CENTER} r="200" fill="url(#home-glow)" />
      <g className="fill-slate-400 dark:fill-slate-500">
        {STARS.map(([x, y, r]) => (
          <circle key={`${String(x)}-${String(y)}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <path
        d={FIGURE_EIGHT}
        fill="none"
        className="stroke-slate-300 dark:stroke-slate-700"
        strokeWidth="2"
        strokeDasharray="4 8"
        strokeLinecap="round"
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={LAGRANGE_RADIUS}
        fill="none"
        className="stroke-violet-300 dark:stroke-violet-800"
        strokeWidth="2"
      />
      <g className={SPIN_CLASS}>
        {BODY_COLORS.map((color, index) => {
          const angle = (index * 2 * Math.PI) / 3 - Math.PI / 2;
          return (
            <circle
              key={color}
              cx={CENTER + LAGRANGE_RADIUS * Math.cos(angle)}
              cy={CENTER + LAGRANGE_RADIUS * Math.sin(angle)}
              r={BODY_RADIUS}
              fill={color}
            />
          );
        })}
      </g>
    </svg>
  );
}
