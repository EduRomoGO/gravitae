import Link from "next/link";
import type { ReactElement } from "react";
import { BODY_COLORS } from "@/components/shared/body-colors";
import { HOW_TO_READ_ANCHORS } from "@/components/gallery/how-to-read";
import {
  FOCUS_RING_CLASS,
  TEXT_LINK_CLASS,
} from "@/components/shared/link-class";
import { formatCoordinate } from "@/lib/format";
import {
  BODY_INDICES,
  type Solution,
  type Vector2,
} from "@/lib/orbits/solutions";
import { galleryAnchorPath } from "@/lib/routes";

function formatVector([x, y]: Vector2): string {
  return `(${formatCoordinate(x)}, ${formatCoordinate(y)})`;
}

const CELL_CLASS =
  "border-b border-slate-200 py-2 pr-3 align-top tabular-nums dark:border-slate-800";
const HEADER_CLASS =
  "border-b border-slate-300 py-2 pr-3 font-semibold dark:border-slate-700";

/** The initial conditions of a solution, who found the orbit, and where the numbers come from. */
export function InitialConditions({
  solution,
}: {
  solution: Solution;
}): ReactElement {
  const { positions, velocities, conditionsSource, discovery } = solution;

  return (
    <>
      <section aria-labelledby="condiciones-iniciales" className="mt-8">
        <h2
          id="condiciones-iniciales"
          className="text-xl font-semibold sm:text-2xl"
        >
          Condiciones iniciales
          <sup className="ml-0.5 text-base font-normal">
            <Link
              href={galleryAnchorPath(HOW_TO_READ_ANCHORS.initialConditions)}
              scroll={false}
              aria-label="Qué son las condiciones iniciales"
              className={`rounded ${FOCUS_RING_CLASS}`}
            >
              *
            </Link>
          </sup>
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Posición y velocidad de cada cuerpo en el instante 0
            </caption>
            <thead>
              <tr>
                <th scope="col" className={HEADER_CLASS}>
                  Cuerpo
                </th>
                <th scope="col" className={HEADER_CLASS}>
                  Posición (x, y)
                </th>
                <th scope="col" className={HEADER_CLASS}>
                  Velocidad (x, y)
                </th>
              </tr>
            </thead>
            <tbody>
              {BODY_INDICES.map((body) => (
                <tr key={body}>
                  <th scope="row" className={`${CELL_CLASS} font-normal`}>
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block size-3 rounded-full align-middle"
                      style={{ background: BODY_COLORS[body] }}
                    />
                    {body + 1}
                  </th>
                  <td className={CELL_CLASS}>
                    {formatVector(positions[body])}
                  </td>
                  <td className={CELL_CLASS}>
                    {formatVector(velocities[body])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-400">
          Fuente:{" "}
          {conditionsSource.href === undefined ? (
            conditionsSource.reference
          ) : (
            <a
              href={conditionsSource.href}
              target="_blank"
              rel="noopener noreferrer"
              className={TEXT_LINK_CLASS}
            >
              {conditionsSource.reference}
            </a>
          )}
          .
        </p>
        <div className="mt-3 space-y-3 leading-relaxed">
          <p>{discovery}</p>
          <p>{conditionsSource.note}</p>
        </div>
      </section>
    </>
  );
}
