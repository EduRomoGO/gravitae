import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { TEXT_LINK_CLASS } from "@/components/shared/link-class";
import { galleryAnchorPath } from "@/lib/routes";

/** Anchors of the gallery's explanations, which each detail links to. */
export const HOW_TO_READ_ANCHORS = {
  units: "unidades",
  initialConditions: "condiciones-iniciales",
  instantZero: "instante-cero",
  stability: "estabilidad",
} as const;

type Anchor = (typeof HOW_TO_READ_ANCHORS)[keyof typeof HOW_TO_READ_ANCHORS];

/**
 * A link from a detail to one of the gallery's explanations. The gallery
 * scrolls to the anchor itself (`GalleryReturn`), so the link does not scroll.
 */
export function HowToReadLink({
  anchor,
  children,
}: {
  anchor: Anchor;
  children: ReactNode;
}): ReactElement {
  return (
    <Link
      href={galleryAnchorPath(anchor)}
      scroll={false}
      className={TEXT_LINK_CLASS}
    >
      {children}
    </Link>
  );
}

// Clears the sticky site header when the gallery scrolls to an anchor.
const ANCHOR_CLASS = "scroll-mt-20";

function Explanation({
  id,
  title,
  children,
}: {
  id: Anchor;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      id={id}
      className={`${ANCHOR_CLASS} mb-6 break-inside-avoid`}
    >
      <h3 id={`${id}-titulo`} className="text-lg font-semibold">
        {title}
      </h3>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

/** What the six details have in common, explained once in the gallery. */
export function HowToRead(): ReactElement {
  return (
    <section aria-labelledby="glosario" className="mt-12 leading-relaxed">
      <h2 id="glosario" className="text-xl font-semibold sm:text-2xl">
        Glosario de las órbitas
      </h2>
      {/* One column of prose width on mobile, two balanced columns on desktop. */}
      <div className="mt-6 max-w-prose lg:max-w-none lg:columns-2 lg:gap-12">
        <Explanation
          id={HOW_TO_READ_ANCHORS.initialConditions}
          title="Condiciones iniciales"
        >
          <p>
            Las condiciones iniciales son la posición y la velocidad de cada
            cuerpo en el instante 0. La ley de la gravitación determina la
            aceleración de cada cuerpo, no su velocidad, y por eso hacen falta
            las dos. A partir de estos seis pares de números, el navegador
            calcula el resto de la órbita.
          </p>
        </Explanation>
        <Explanation
          id={HOW_TO_READ_ANCHORS.instantZero}
          title="El instante cero"
        >
          <p>
            Las condiciones iniciales no describen un arranque. En estas órbitas
            los cuerpos nunca están parados: recorren la misma figura una y otra
            vez, sin principio ni final. Para calcularla hace falta elegir un
            instante como referencia, igual que se marca un punto cualquiera de
            una pista para empezar a contar las vueltas, y anotar dónde está
            cada cuerpo y a qué velocidad pasa por ese punto. Ese instante es t
            = 0. Los cuerpos llegan a él ya en movimiento, siguiendo la figura,
            y por eso en t = 0 se ve una estela detrás de cada uno: es el tramo
            que acaban de recorrer. Al pulsar «Reiniciar», la animación vuelve a
            esa marca, no a un momento en que los cuerpos estuvieran quietos. El
            detalle de cada solución indica qué instante de su figura es la
            marca.
          </p>
        </Explanation>
        <Explanation id={HOW_TO_READ_ANCHORS.units} title="Unidades">
          <p>
            Las órbitas se calculan en unidades en las que la constante de
            gravitación <em>G</em> vale 1 y cada cuerpo tiene masa 1. Al fijar
            esos valores, la unidad de tiempo deja de ser libre y no equivale a
            una cantidad fija de segundos: depende de la masa y la distancia
            reales que se asignen a cada 1. La forma de la órbita no cambia con
            esa elección, de modo que la misma figura vale para tres estrellas y
            para tres bolas de 1 kg. «Una vuelta» es el tiempo que tarda la
            figura en repetirse, medido en esa unidad.
          </p>
        </Explanation>
        <Explanation id={HOW_TO_READ_ANCHORS.stability} title="Estabilidad">
          <p>
            Según la literatura, una órbita es estable si una pequeña
            perturbación de las condiciones iniciales conserva su forma, e
            inestable si la amplifica hasta perderla. En una simulación numérica
            esa perturbación la aportan el redondeo y el error de cada paso.
          </p>
          <p>
            Esta aplicación calcula una sola vuelta y la repite, de modo que
            ninguna de las seis órbitas se deforma en pantalla, sea estable o
            inestable. La clasificación de cada una procede de la literatura; la
            aplicación no la calcula.
          </p>
        </Explanation>
      </div>
    </section>
  );
}
