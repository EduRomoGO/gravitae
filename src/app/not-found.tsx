import type { Metadata } from "next";
import type { ReactElement } from "react";
import { GalleryLink } from "@/components/shared/gallery-link";
import { GravitationLawLink } from "@/components/shared/gravitation-law-link";
import { TEXT_LINK_CLASS } from "@/components/shared/link-class";
import { pageTitle } from "@/lib/page-title";

// The root layout's title template does not reach the not-found of its own
// segment, so the page applies the same template itself.
export const metadata: Metadata = {
  title: { absolute: pageTitle("Página no encontrada") },
};

export default function NotFound(): ReactElement {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">
        Página no encontrada
      </h1>
      <p className="mt-2 max-w-prose text-slate-600 dark:text-slate-400">
        Esta dirección no lleva a ninguna página. Puedes seguir por{" "}
        <GravitationLawLink className={TEXT_LINK_CLASS}>
          la lección
        </GravitationLawLink>{" "}
        o por{" "}
        <GalleryLink className={TEXT_LINK_CLASS}>
          la galería de órbitas
        </GalleryLink>
        .
      </p>
    </main>
  );
}
