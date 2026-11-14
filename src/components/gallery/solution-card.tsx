import type { ReactElement } from "react";
import { GalleryCardLink } from "@/components/gallery/gallery-card-link";
import { FOCUS_RING_CLASS } from "@/components/shared/link-class";
import { OrbitThumbnail } from "@/components/gallery/orbit-thumbnail";
import { formatSimulationTime } from "@/lib/format";
import type { Solution } from "@/lib/orbits/solutions";

/**
 * Name, lap and link come from the server; only the animated drawing does not.
 *
 * The card rises on hover, and Firefox counts that transform when it anchors
 * the scroll: with a card as the anchor, its rise scrolls the page as well.
 * `overflow-anchor: none` keeps the card out of the anchor selection.
 */
export function SolutionCard({
  solution,
}: {
  solution: Solution;
}): ReactElement {
  return (
    <GalleryCardLink
      slug={solution.slug}
      className={`block rounded-2xl border border-slate-200 bg-white transition hover:border-violet-300 motion-safe:hover:-translate-y-0.5 [overflow-anchor:none] dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-violet-700 ${FOCUS_RING_CLASS}`}
    >
      <OrbitThumbnail slug={solution.slug} />
      <div className="px-4 pb-4">
        <h2 className="text-lg font-medium">{solution.name}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Una vuelta: {formatSimulationTime(solution.period)} unidades de tiempo
        </p>
      </div>
    </GalleryCardLink>
  );
}
