import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { OrbitsIllustration } from "@/components/home/orbits-illustration";
import { GalleryLink } from "@/components/shared/gallery-link";
import { GravitationLawLink } from "@/components/shared/gravitation-law-link";
import { ArrowRightIcon } from "@/components/shared/icons";
import { FOCUS_RING_CLASS } from "@/components/shared/link-class";
import { pageTitle } from "@/lib/page-title";
import { FINDER_PATH } from "@/lib/routes";

// The root layout's title template does not reach the page of its own
// segment, so the home applies the same template itself.
export const metadata: Metadata = {
  title: { absolute: pageTitle("La gravitación y los tres cuerpos") },
};

const BUTTON_CLASS = `group inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors ${FOCUS_RING_CLASS}`;
const PRIMARY_BUTTON_CLASS = `${BUTTON_CLASS} bg-violet-600 text-white shadow-sm hover:bg-violet-700 dark:bg-violet-500 dark:text-slate-950 dark:hover:bg-violet-400`;
const SECONDARY_BUTTON_CLASS = `${BUTTON_CLASS} border border-slate-400 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`;
const ARROW_CLASS =
  "size-5 transition-transform motion-safe:group-hover:translate-x-0.5";

export default function Home(): ReactElement {
  return (
    <main className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-[1fr_minmax(0,24rem)] md:py-16">
      <div>
        <p className="text-sm font-semibold tracking-wide text-violet-700 uppercase dark:text-violet-300">
          Física que se toca
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          ¿Por qué caen los cuerpos y cómo se influyen mutuamente?
        </h1>
        <p className="mt-4 max-w-prose text-lg text-pretty text-slate-600 dark:text-slate-400">
          Experimenta alterando parámetros gravitacionales, anticipa su
          comportamiento y repasa la ley de Newton. Después, observa la
          geometría de seis órbitas periódicas del problema de los tres cuerpos
          calculadas directamente frente a ti. Para terminar, acepta el reto de
          encontrar tu propia configuración estable.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <GravitationLawLink className={PRIMARY_BUTTON_CLASS}>
            Aprende la ley de la gravitación
            <ArrowRightIcon className={ARROW_CLASS} />
          </GravitationLawLink>
          <GalleryLink className={SECONDARY_BUTTON_CLASS}>
            Explora órbitas de tres cuerpos
            <ArrowRightIcon className={ARROW_CLASS} />
          </GalleryLink>
          <Link href={FINDER_PATH} className={SECONDARY_BUTTON_CLASS}>
            Busca tu solución
            <ArrowRightIcon className={ARROW_CLASS} />
          </Link>
        </div>
      </div>
      <OrbitsIllustration className="mx-auto w-full max-w-64 md:max-w-none" />
    </main>
  );
}
