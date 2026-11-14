import type { Metadata } from "next";
import type { ReactElement } from "react";
import { FinderApp } from "@/components/gallery/finder/finder-app";
import { GalleryLink } from "@/components/shared/gallery-link";
import { NAV_LINK_CLASS } from "@/components/shared/link-class";
import { readServerMode } from "@/lib/atomy/server-mode";

export const metadata: Metadata = {
  title: "Busca tu propia órbita",
  description:
    "Elige la velocidad inicial de tres cuerpos en línea, simula su movimiento y corrígela hasta que la órbita se repita.",
};

export default async function FinderPage(): Promise<ReactElement> {
  const serverMode = await readServerMode();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <GalleryLink className={`inline-block text-sm ${NAV_LINK_CLASS}`}>
        ← Galería
      </GalleryLink>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
        Busca tu propia órbita
      </h1>
      <div className="mt-2 max-w-prose space-y-2 text-slate-600 dark:text-slate-400">
        <p>
          Tres cuerpos iguales parten en línea, como en cinco de las órbitas de
          la galería. Elige con qué velocidad salen y el navegador simula su
          movimiento y busca el instante en que vuelven más cerca de su punto de
          partida. «Empezar» muestra a los cuerpos recorriendo esa trayectoria,
          aunque acaben chocando.
        </p>
        <p>
          Casi ninguna velocidad da una órbita que se repita. «Cerrar la órbita»
          corrige la velocidad y el periodo a partir de ese regreso, como
          hicieron Šuvakov y Dmitrašinović para encontrar sus órbitas: si el
          regreso ya era cercano, la órbita se cierra.
        </p>
      </div>
      <FinderApp serverMode={serverMode} />
    </main>
  );
}
