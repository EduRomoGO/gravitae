import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { GalleryPauseButton } from "@/components/gallery/gallery-pause-button";
import { GalleryReturn } from "@/components/gallery/gallery-return";
import { HowToRead } from "@/components/gallery/how-to-read";
import { SolutionCard } from "@/components/gallery/solution-card";
import { TEXT_LINK_CLASS } from "@/components/shared/link-class";
import { SOLUTIONS } from "@/lib/orbits/solutions";
import { FINDER_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Galería de los tres cuerpos",
};

export default function GalleryPage(): ReactElement {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">
        Galería de los tres cuerpos
      </h1>
      <p className="mt-2 max-w-prose text-slate-600 dark:text-slate-400">
        Con dos cuerpos, la ley de la gravitación de Newton da una fórmula que
        predice dónde está cada uno en cualquier instante. Con tres no existe
        una fórmula general: Heinrich Bruns, en 1887, y Henri Poincaré poco
        después demostraron que faltan las cantidades conservadas que la harían
        posible, y la serie infinita que Karl Sundman encontró en 1912 converge
        demasiado despacio para usarse. Por eso el movimiento se calcula paso a
        paso con un ordenador, y en general es caótico. Aun así, existen
        configuraciones cuyas órbitas se repiten para siempre; estas son seis,
        calculadas en tu navegador. Elige una para ver su simulación, o{" "}
        <Link href={FINDER_PATH} className={TEXT_LINK_CLASS}>
          busca tu propia órbita
        </Link>
        .
      </p>
      <GalleryPauseButton />
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SOLUTIONS.map((solution) => (
          <li key={solution.slug}>
            <SolutionCard solution={solution} />
          </li>
        ))}
      </ul>
      <HowToRead />
      <GalleryReturn />
    </main>
  );
}
