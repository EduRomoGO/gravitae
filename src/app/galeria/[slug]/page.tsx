import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { GalleryLink } from "@/components/shared/gallery-link";
import {
  HOW_TO_READ_ANCHORS,
  HowToReadLink,
} from "@/components/gallery/how-to-read";
import { InitialConditions } from "@/components/gallery/initial-conditions";
import { OrbitPlayer } from "@/components/gallery/orbit-player";
import { SolutionTitle } from "@/components/gallery/solution-title";
import {
  adjacentSolutions,
  getSolution,
  isSolutionSlug,
  SOLUTION_SLUGS,
  type SolutionSlug,
} from "@/lib/orbits/solutions";
import { NAV_LINK_CLASS } from "@/components/shared/link-class";
import { formatSimulationTime } from "@/lib/format";
import { solutionPath } from "@/lib/routes";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// A slug outside the catalogue returns 404 instead of being rendered on demand.
export const dynamicParams = false;

export function generateStaticParams(): { slug: SolutionSlug }[] {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/galeria/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isSolutionSlug(slug)) notFound();
  const solution = getSolution(slug);
  // The shape tells the solutions apart; four of the six share their description.
  return { title: solution.name, description: solution.shape };
}

export default async function SolutionDetailPage({
  params,
}: PageProps<"/galeria/[slug]">): Promise<ReactElement> {
  const { slug } = await params;
  if (!isSolutionSlug(slug)) notFound();
  const solution = getSolution(slug);
  const { previous, next } = adjacentSolutions(solution.slug);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <GalleryLink className={`inline-block text-sm ${NAV_LINK_CLASS}`}>
        ← Galería
      </GalleryLink>
      <SolutionTitle name={solution.name} />
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {solution.description}
      </p>
      <OrbitPlayer slug={solution.slug} />
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-600 dark:text-slate-400">Una vuelta</dt>
        <dd>
          {formatSimulationTime(solution.period)} unidades de tiempo.{" "}
          <HowToReadLink anchor={HOW_TO_READ_ANCHORS.units}>
            Qué es la unidad de tiempo
          </HowToReadLink>
        </dd>
        <dt className="text-slate-600 dark:text-slate-400">Instante 0</dt>
        <dd>
          {capitalize(solution.instantZeroMark)}.{" "}
          <HowToReadLink anchor={HOW_TO_READ_ANCHORS.instantZero}>
            Qué es el instante 0
          </HowToReadLink>
        </dd>
        <dt className="text-slate-600 dark:text-slate-400">Estabilidad</dt>
        <dd>
          {solution.stable ? "Estable" : "Inestable"}, según la literatura.{" "}
          <HowToReadLink anchor={HOW_TO_READ_ANCHORS.stability}>
            Qué significa {solution.stable ? "estable" : "inestable"}
          </HowToReadLink>
        </dd>
      </dl>
      <InitialConditions solution={solution} />
      <nav
        aria-label="Otras soluciones"
        className="mt-8 flex justify-between gap-2 text-sm"
      >
        <Link href={solutionPath(previous.slug)} className={NAV_LINK_CLASS}>
          ← Solución: {previous.name}
        </Link>
        <Link href={solutionPath(next.slug)} className={NAV_LINK_CLASS}>
          Solución: {next.name} →
        </Link>
      </nav>
    </main>
  );
}
