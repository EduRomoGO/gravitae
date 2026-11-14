// The gravitation law lesson, told as a chain of questions voiced by Atomy:
// each section opens with a question, the reader predicts, plays with an
// experiment, and only then reads the concept; each answer leaves the next
// question. The steps appear one at a time: each ends with an experiment and
// the next shows once it is resolved. Each step sits in its own bordered
// block, with the explanation and the reflection that close it inside.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactElement, ReactNode } from "react";
import { ATOMY_INTRO_COOKIE } from "@/components/atomy/atomy-cookie";
import { AtomyLessonGate } from "@/components/learn/atomy/atomy-lesson-gate";
import { Astronauts } from "@/components/learn/experiments/astronauts";
import { DropRace } from "@/components/learn/experiments/drop-race";
import { GrowingSphere } from "@/components/learn/experiments/growing-sphere";
import { MassThreads } from "@/components/learn/experiments/mass-threads";
import { PlanetRanking } from "@/components/learn/experiments/planet-ranking";
import { Skaters } from "@/components/learn/experiments/skaters";
import { SpringScale } from "@/components/learn/experiments/spring-scale";
import { Tower } from "@/components/learn/experiments/tower";
import { LessonSection } from "@/components/learn/lesson/lesson-section";
import { Predict } from "@/components/learn/lesson/predict";
import { choices, ranking } from "@/components/learn/lesson/responses";
import type { SectionId } from "@/lib/lesson/sections";
import {
  massTimes,
  PLANET_NAMES,
  RIGHT_NAMES,
  SATURN,
  URANUS,
} from "@/components/learn/experiments/planets";
import { Revealed, Step, Steps } from "@/components/learn/lesson/steps";
import { GalleryLink } from "@/components/shared/gallery-link";
import { TEXT_LINK_CLASS } from "@/components/shared/link-class";
import { readServerMode } from "@/lib/atomy/server-mode";
import { formatDecimal, formatThousands, formatUpTo } from "@/lib/format";
import {
  DROP_HEIGHT_M,
  EARTH_MASS_KG,
  EARTH_RADIUS_KM,
  fallTime,
  G,
  MOON_MASS_KG,
  MOON_RADIUS_KM,
  PERSON_MASS_KG,
  SURFACE_G,
} from "@/lib/gravitation/figures";
import {
  ASTRONAUTS,
  gravitationalForce,
  weightAtDistance,
} from "@/lib/gravitation/law";

export const metadata: Metadata = {
  title: "Aprende la ley de la gravitación universal de Newton",
};

// The figures the texts quote, rounded as the experiments show them.
const EARTH_G = formatDecimal(SURFACE_G.Tierra);
const MOON_G = formatDecimal(SURFACE_G.Luna);
const EARTH_FALL = fallTime(SURFACE_G.Tierra);
const MOON_FALL = fallTime(SURFACE_G.Luna);
/** At twice the distance from the centre, as the lift shows it. */
const WEIGHT_AT_TWICE = formatUpTo(weightAtDistance(SURFACE_G.Tierra, 2));
const WEIGHT_AT_HALF = formatDecimal(SURFACE_G.Tierra / 2);
/** The Moon against the Earth: less mass, but a closer centre. */
const MOON_MASS_RATIO = EARTH_MASS_KG / MOON_MASS_KG;
const MOON_RADIUS_RATIO = EARTH_RADIUS_KM / MOON_RADIUS_KM;
const MOON_CLOSER_FACTOR = MOON_RADIUS_RATIO ** 2;
const MOON_PULL_RATIO = MOON_MASS_RATIO / MOON_CLOSER_FACTOR;
/** Between the two astronauts, at their starting distance. */
const ASTRONAUTS_FORCE_N = gravitationalForce(
  ASTRONAUTS.massKg,
  ASTRONAUTS.massKg,
  ASTRONAUTS.startM,
);

const OPENSTAX_13_1 =
  "https://openstax.org/books/f%C3%ADsica-universitaria-volumen-1/pages/13-1-ley-de-la-gravitacion-universal-de-newton";

function Section({
  id,
  title,
  children,
}: {
  id: SectionId;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="mt-12 first:mt-0"
    >
      <h2 id={`${id}-titulo`} className="text-xl font-semibold sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-4 leading-relaxed">
        <LessonSection id={id}>{children}</LessonSection>
      </div>
    </section>
  );
}

/**
 * The ids of the lesson's steps, in the order they unlock. Each is the id of
 * the prediction that closes the step, except the last, which has none.
 */
const STEP_ORDER = [
  "caida",
  "tiron",
  "planeta",
  "distancia",
  "esfera",
  "cualquiera",
  "iguales",
  "mesa",
  "tres",
] as const;
type StepId = (typeof STEP_ORDER)[number];

/**
 * A step of the lesson as one bordered block: what it asks, its experiment
 * and, once the experiment is resolved, the explanation and the reflection
 * (<Next>) that close it. Those parts go in <Revealed>, so they show within
 * this block at the same moment the next block appears below.
 */
function StepBlock({
  id,
  children,
}: {
  id: StepId;
  children: ReactNode;
}): ReactElement {
  return (
    <Step id={id}>
      <div className="mt-6 rounded-2xl border border-slate-200 px-3 py-5 sm:p-6 dark:border-slate-800">
        {children}
      </div>
    </Step>
  );
}

function Next({ children }: { children: ReactNode }): ReactElement {
  return (
    <p className="border-l-4 border-blue-600 pl-3 font-semibold">{children}</p>
  );
}

/** A value of a substituted formula with a brace below naming what it is. */
function Braced({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <span className="inline-flex flex-col items-center">
      <span className="whitespace-nowrap">{children}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="h-2 w-full min-w-6 text-slate-500"
      >
        <path
          d="M1 1 Q1 5 8 5 H44 Q50 5 50 9 Q50 5 56 5 H92 Q99 5 99 1"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="max-w-20 text-center text-xs leading-tight sm:max-w-32 text-slate-600 dark:text-slate-400">
        {label}
      </span>
    </span>
  );
}

/**
 * A numerator over a denominator with a bar as wide as the wider of the two.
 * A screen reader reads the bar as "dividido entre".
 */
function Fraction({
  numerator,
  denominator,
}: {
  numerator: ReactNode;
  denominator: ReactNode;
}): ReactElement {
  return (
    <span className="inline-flex flex-col items-stretch text-center">
      <span className="px-1 pb-1.5">{numerator}</span>
      <span className="sr-only">dividido entre</span>
      <span aria-hidden="true" className="border-t-2 border-current" />
      <span className="px-1 pt-1.5">{denominator}</span>
    </span>
  );
}

/**
 * The law with the Earth's figures and 1 kg, each value braced, as a
 * fraction: the product of G and the masses over the radius squared.
 */
function EarthSubstitution(): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:text-lg">
      <span className="whitespace-nowrap">
        <em>F</em> =
      </span>
      <Fraction
        numerator={
          <span className="flex items-start justify-center gap-x-1 sm:gap-x-1.5">
            <Braced label="G">
              {formatDecimal(G * 1e11, 2)} × 10<sup>−11</sup>
            </Braced>
            <span>×</span>
            <Braced label="masa de la Tierra (kg)">
              {formatDecimal(EARTH_MASS_KG / 1e24, 2)} × 10<sup>24</sup>
            </Braced>
            <span>×</span>
            <Braced label="masa del objeto (kg)">1</Braced>
          </span>
        }
        denominator={
          <span className="flex items-start justify-center">
            <span>(</span>
            <Braced label="radio de la Tierra (m)">
              {formatDecimal(EARTH_RADIUS_KM / 1000, 2)} × 10<sup>6</sup>
            </Braced>
            <span>
              )<sup>2</sup>
            </span>
          </span>
        }
      />
      <span className="whitespace-nowrap">≈ {EARTH_G} N</span>
    </div>
  );
}

export default async function GravitationLawPage({
  searchParams,
}: PageProps<"/ley-gravitacion-universal-newton">): Promise<ReactElement> {
  const greeted = (await cookies()).get(ATOMY_INTRO_COOKIE)?.value === "seen";
  const serverMode = await readServerMode();
  // Development only: ?todo shows every step with its question answered, to
  // review the whole lesson in one go.
  const showAll =
    process.env.NODE_ENV !== "production" &&
    (await searchParams).todo !== undefined;
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <AtomyLessonGate
        greeted={greeted}
        serverMode={serverMode}
        showAll={showAll}
      >
        <Steps
          key={showAll ? "all" : "steps"}
          order={STEP_ORDER}
          showAll={showAll}
        >
          <StepBlock id="caida">
            <h1 className="text-2xl font-semibold sm:text-3xl">
              ¿Por qué en la Luna todo cae a cámara lenta?
            </h1>
            <p className="mt-3 leading-relaxed">
              En las grabaciones de las misiones Apolo, los astronautas realizan
              saltos de gran altura y descienden con una lentitud aparente. A
              continuación, desvelaremos de forma secuencial las variables
              físicas que explican este comportamiento.
            </p>

            <Section id="caida" title="Empecemos soltando tres cajas idénticas">
              <Predict
                id="caida"
                question={`Se sueltan simultáneamente tres cajas idénticas desde una altura de ${String(DROP_HEIGHT_M)} m en distintos cuerpos celestes. ¿Cuánto tarda en llegar al suelo la de la Tierra en comparación con la de la Luna?`}
                response={choices(
                  [
                    "Lo mismo",
                    `Unas ${formatDecimal(MOON_FALL / EARTH_FALL)} veces menos`,
                    "Seis veces menos",
                  ],
                  1,
                )}
                explanation={
                  <>
                    <p>
                      La caja en la Tierra tarda {formatDecimal(EARTH_FALL)} s
                      en alcanzar la superficie, mientras que en la Luna tarda{" "}
                      {formatDecimal(MOON_FALL)} s. Las marcas temporales de
                      cada segundo revelan la causa: en la Tierra, la gravedad
                      incrementa la velocidad del cuerpo en {EARTH_G} m/s cada
                      segundo; en la Luna, el incremento es de solo {MOON_G} m/s
                      cada segundo, aproximadamente seis veces menor.
                    </p>
                    <p>
                      Debido a esta menor aceleración, el cuerpo gana velocidad
                      más despacio, lo que genera ese efecto de cámara lenta
                      tanto en los objetos como en el descenso de los
                      astronautas.
                    </p>
                  </>
                }
              >
                <DropRace />
              </Predict>
            </Section>
          </StepBlock>

          <StepBlock id="tiron">
            <Section
              id="tiron"
              title="Las tres cajas son idénticas. Entonces, ¿qué cambia de un astro a otro?"
            >
              <Predict
                id="tiron"
                question="Trasladas un objeto de la Tierra a la Luna. ¿Qué magnitud física se altera?"
                response={choices(["Su masa", "Su peso", "Las dos cosas"], 1)}
                explanation={
                  <>
                    <p>
                      La cantidad de materia del objeto permanece intacta; esa
                      magnitud es su <strong>masa</strong> y se mide en
                      kilogramos (kg).
                    </p>
                    <p>
                      En el lenguaje cotidiano confundimos peso con masa al
                      afirmar «peso 70 kilos». Para mantener el rigor físico,
                      conviene reservar el término «masa» para la cantidad de
                      materia.
                    </p>
                    <p>
                      De este modo, la palabra «<strong>peso</strong>» queda
                      reservada para lo que mide un dinamómetro: la{" "}
                      <strong>fuerza</strong> con la que un cuerpo celeste atrae
                      a un objeto, expresada en <strong>newtons</strong> (N). En
                      la Luna, el muelle del dinamómetro se estira menos porque
                      la atracción gravitatoria lunar es inferior a la
                      terrestre.
                    </p>
                  </>
                }
              >
                <SpringScale />
              </Predict>
              <Revealed>
                <Next>
                  La Luna atrae con menos fuerza que la Tierra. Pero ¿a qué se
                  debe exactamente? ¿A que posee menos masa? ¿A que tiene menor
                  tamaño?
                </Next>
              </Revealed>
            </Section>
          </StepBlock>

          <StepBlock id="planeta">
            <Section
              id="planeta"
              title="¿Qué determina la atracción de un planeta? ¿Su masa? ¿Su tamaño?"
            >
              <p>
                La primera hipótesis lógica es que a mayor masa, mayor
                atracción. Comprobemos qué ocurre realmente.
              </p>
              <Predict
                id="planeta"
                question="¿En cuál de estos tres planetas pesaría más 1 kg, y en cuál menos?"
                response={ranking(PLANET_NAMES, RIGHT_NAMES, <PlanetRanking />)}
                explanation={
                  <p>
                    Saturno tiene {massTimes(SATURN.mass)} veces la masa de la
                    Tierra, y en él 1 kg pesa casi lo mismo que aquí. Urano
                    tiene {massTimes(URANUS.mass)} veces la masa, y en él pesa
                    menos. Así que la masa no basta para ordenarlos. Estos
                    planetas son tan grandes que, de pie en su superficie, estás
                    muy lejos de su centro.
                  </p>
                }
              />
              <Revealed>
                <p>
                  En realidad intervienen dos factores opuestos. Por un lado, la
                  masa del cuerpo celeste, que aumenta la atracción cuanto mayor
                  es. Por otro, la distancia hasta su centro de masas, que la
                  reduce. Es fundamental considerar que esta distancia se mide
                  siempre desde el <strong>centro</strong> geométrico: incluso
                  estando sobre la superficie terrestre, ya te encuentras a{" "}
                  {formatThousands(EARTH_RADIUS_KM)} km del centro de la Tierra.
                </p>
                <Next>
                  La distancia reduce la atracción, pero ¿en qué proporción
                  exacta lo hace?
                </Next>
              </Revealed>
            </Section>
          </StepBlock>

          <StepBlock id="distancia">
            <Section id="distancia" title="¿Cuánto importa estar más lejos?">
              <Predict
                id="distancia"
                question={`Elevas un cuerpo de 1 kg hasta situarlo al doble de distancia del centro de la Tierra. Si en la superficie marcaba ${EARTH_G} N, ¿qué valor registrará arriba?`}
                response={choices(
                  [
                    `${WEIGHT_AT_HALF} N, la mitad`,
                    `${WEIGHT_AT_TWICE} N, la cuarta parte`,
                    `${EARTH_G} N, lo mismo`,
                  ],
                  1,
                )}
                explanation={
                  <p>
                    Al duplicar la distancia, el peso se reduce a la cuarta
                    parte; al triplicarla, cae a la novena parte. Alejarse
                    reduce la atracción mucho más rápido de lo que sugiere la
                    intuición.
                  </p>
                }
              >
                <Tower />
              </Predict>
              <Step id="esfera">
                <Next>
                  Pero ¿por qué se reduce a la cuarta parte y no simplemente a
                  la mitad?
                </Next>
                <Predict
                  id="esfera"
                  question="Al duplicar la distancia, la atracción cae a la cuarta parte en lugar de a la mitad. ¿Cuál es la razón geométrica de este fenómeno?"
                  response={choices(
                    [
                      "Porque la atracción se gasta por el camino",
                      "Porque se reparte hacia arriba y hacia los lados a la vez",
                      "Porque B se ve más pequeño de lejos",
                    ],
                    1,
                  )}
                  explanation={
                    <p>
                      La atracción no desaparece, sino que se distribuye sobre
                      una esfera imaginaria que rodea al planeta y se expande
                      conforme aumenta la distancia. Al duplicar el radio de esa
                      esfera, su superficie crece en dos dimensiones a la vez (a
                      lo ancho y a lo alto), volviéndose 4 veces mayor (2 × 2).
                      Dado que el cuerpo receptor B mantiene siempre el mismo
                      tamaño, intercepta una fracción cuatro veces menor de esa
                      influencia. Siguiendo esta misma geometría, al triplicar
                      la distancia la superficie es 9 veces mayor (3 × 3) y la
                      fuerza se divide entre 9; al cuadruplicarla, el área es 16
                      veces mayor (4 × 4) y la fuerza se divide entre 16.
                    </p>
                  }
                >
                  <GrowingSphere />
                </Predict>
              </Step>
            </Section>
          </StepBlock>

          <StepBlock id="cualquiera">
            <Section
              id="cualquiera"
              title="¿Este fenómeno ocurre solo con los planetas?"
            >
              <p>
                La gran aportación de Newton fue demostrar que no. La fuerza que
                hace caer una caja es exactamente de la misma naturaleza que la
                atracción existente entre dos masas{" "}
                <strong>cualesquiera</strong>, ya sean la Tierra y la Luna o dos
                objetos A y B. En esta interacción intervienen ambas masas, como
                confirma el dinamómetro al registrar el doble de fuerza para 2
                kg que para 1 kg.
              </p>
              <p>
                Por ese alcance absoluto se denomina{" "}
                <strong>ley de la gravitación universal</strong>: rige para toda
                la materia del cosmos.
              </p>
              <Predict
                id="cualquiera"
                question="Si duplicas simultáneamente la masa de A y la de B, ¿cómo cambia la fuerza entre ambos?"
                response={choices(["×2", "×4", "×1, se queda igual"], 1)}
                explanation={
                  <p>
                    Cada unidad de masa de A ejerce una atracción sobre cada
                    unidad de masa de B, por lo que el total de interacciones
                    equivale al producto de ambas masas. Al duplicar las dos, el
                    número de interacciones se multiplica por 2 × 2 = 4,
                    cuadruplicando la fuerza resultante. Esta es la razón por la
                    que las masas se multiplican en la ecuación en lugar de
                    sumarse.
                  </p>
                }
              >
                <MassThreads />
              </Predict>
            </Section>
          </StepBlock>

          <StepBlock id="iguales">
            <Section
              id="formula"
              title="Todo lo descubierto, sintetizado en una ecuación"
            >
              <p>
                Newton condensó este mecanismo en una{" "}
                <a
                  href={OPENSTAX_13_1}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={TEXT_LINK_CLASS}
                >
                  ley
                </a>
                : entre dos cuerpos cualesquiera existe una fuerza de atracción
                directamente proporcional al producto de sus masas e
                inversamente proporcional al cuadrado de la distancia que separa
                sus centros. Cada pieza de este enunciado ya ha quedado
                comprobada; su expresión matemática es la siguiente.
              </p>
              <div className="flex items-center justify-center gap-x-2 text-lg">
                <span>
                  <em>F</em> =
                </span>
                <Fraction
                  numerator={
                    <>
                      <em>G</em> · <em>m</em>
                      <sub>1</sub> · <em>m</em>
                      <sub>2</sub>
                    </>
                  }
                  denominator={
                    <>
                      <em>r</em>
                      <sup>2</sup>
                    </>
                  }
                />
              </div>
              <p>
                En la fórmula, <em>m</em>
                <sub>1</sub> y <em>m</em>
                <sub>2</sub> representan las masas de los cuerpos, <em>r</em> es
                la distancia entre sus centros y <em>r</em>
                <sup>2</sup> expresa el factor de atenuación cuadrática.{" "}
                <em>G</em> es la constante de gravitación universal, un valor
                fijo en todo el universo que ajusta las unidades para obtener el
                resultado en newtons. Al introducir la masa y el radio
                terrestres junto con 1 kg, se obtiene exactamente {EARTH_G} N.
              </p>
              <EarthSubstitution />
              <p>
                Esta misma ecuación resuelve el interrogante inicial. La Luna
                posee unas {formatDecimal(MOON_MASS_RATIO, 0)} veces menos masa
                que la Tierra, lo que reduciría su atracción en esa misma
                proporción. Sin embargo, al ser más pequeña, su superficie está
                unas {formatDecimal(MOON_RADIUS_RATIO)} veces más cerca de su
                centro, lo que multiplica la atracción por{" "}
                {formatDecimal(MOON_RADIUS_RATIO)}
                <sup>2</sup> ≈ {formatDecimal(MOON_CLOSER_FACTOR)}. El balance
                neto implica que la Luna atrae unas{" "}
                {formatDecimal(MOON_PULL_RATIO, 0)} veces menos que la Tierra (
                {formatDecimal(SURFACE_G.Tierra / MOON_PULL_RATIO)} N por
                kilogramo), provocando ese descenso lento.
              </p>
              <Next>
                Sin embargo, la ecuación plantea una paradoja aparente: si la
                Tierra te atrae, tú también atraes a la Tierra con exactamente
                la misma fuerza…
              </Next>
            </Section>
          </StepBlock>

          <StepBlock id="iguales">
            <Section
              id="iguales"
              title="Si atraes a la Tierra con la misma fuerza que ella a ti, ¿por qué caes tú?"
            >
              <Predict
                id="iguales"
                question="Dos patinadores de distinta masa, en reposo sobre hielo sin rozamiento apreciable, se empujan mutuamente. ¿Quién recibe una fuerza mayor?"
                response={choices(
                  [
                    "El de más masa",
                    "El de menos masa",
                    "Los dos la misma",
                    "Depende de quién empuje más fuerte",
                  ],
                  2,
                )}
                explanation={
                  <>
                    <p>
                      Ambos reciben exactamente la misma fuerza en sentidos
                      opuestos, tal como dicta la{" "}
                      <strong>tercera ley de Newton</strong>. No obstante, sale
                      despedido a mayor velocidad el de menor masa porque, ante
                      una misma fuerza, la aceleración es inversamente
                      proporcional a la masa según la{" "}
                      <strong>segunda ley</strong> (<em>a</em> = <em>F</em> /{" "}
                      <em>m</em>).
                    </p>
                    <p>
                      Tampoco importa quién empuje con más intensidad: si uno
                      aplica mayor fuerza, la interacción crece por igual sobre
                      ambos, ya que es imposible ejercer una acción sin recibir
                      una reacción idéntica.
                    </p>
                    <p>
                      Sobre suelo firme sí puedes desplazar a alguien de mayor
                      masa sin moverte, pero esto ocurre porque el rozamiento de
                      tus pies contra el suelo compensa el empuje recibido.
                      Sobre el hielo, al desaparecer esa fricción, únicamente
                      interviene la masa.
                    </p>
                    <p>
                      Con la Tierra sucede exactamente lo mismo. Tú y el planeta
                      os atraéis con idéntica fuerza, pero la Tierra tiene unas
                      8 × 10<sup>22</sup> veces tu masa, por lo que su
                      aceleración es ese mismo factor de veces menor. Aunque el
                      planeta también se desplaza hacia ti, la distancia es tan
                      ínfima que resulta imposible de medir.
                    </p>
                  </>
                }
              >
                <Skaters />
              </Predict>
              <Revealed>
                <Next>
                  Pero si toda masa atrae a otra masa, entonces la mesa que
                  tienes al lado también te está atrayendo…
                </Next>
              </Revealed>
            </Section>
          </StepBlock>

          <StepBlock id="mesa">
            <Section
              id="mesa"
              title="¿Por qué no percibes la atracción de una mesa?"
            >
              <Predict
                id="mesa"
                question={`Dos astronautas de ${String(PERSON_MASS_KG)} kg flotan inmóviles en el espacio, separados ${String(ASTRONAUTS.startM)} m entre sus centros y aislados de cualquier otra influencia. ¿Qué sucederá?`}
                response={choices(
                  [
                    "Nada, se quedan quietos para siempre",
                    "Se juntan en unos segundos",
                    "Se juntan, pero tardan horas",
                  ],
                  2,
                )}
                explanation={
                  <>
                    <p>
                      Se atraen mutuamente y terminan juntándose, pero el
                      proceso tarda casi tres horas. La fuerza entre ambos es de
                      apenas {formatDecimal(ASTRONAUTS_FORCE_N * 1e7, 2)} × 10
                      <sup>−7</sup> N ({formatDecimal(ASTRONAUTS_FORCE_N, 9)}{" "}
                      N), inferior al peso de una pestaña.
                    </p>
                    <p>
                      La atracción entre dos personas u objetos cotidianos es
                      real, pero resulta unos dos mil millones de veces más
                      débil que el peso ejercido por la Tierra. En la superficie
                      terrestre, cualquier mínimo rozamiento anula por completo
                      este efecto.
                    </p>
                    <p>
                      La causa reside en la magnitud diminuta de la constante{" "}
                      <em>G</em> ({formatDecimal(G * 1e11, 2)} × 10
                      <sup>−11</sup> N·m²/kg²). Con masas cotidianas como
                      personas o mobiliario, la fuerza resultante es
                      imperceptible; se requiere una masa de escala planetaria
                      para que la gravedad sea evidente.
                    </p>
                  </>
                }
              >
                <Astronauts />
              </Predict>
            </Section>
          </StepBlock>

          <StepBlock id="tres">
            <Section
              id="tres"
              title="¿Y si en lugar de dos cuerpos intervienen tres?"
            >
              <p>
                Con dos cuerpos, la atracción mutua permite calcular y predecir
                sus trayectorias con exactitud. Al añadir un tercer cuerpo, cada
                masa queda sometida simultáneamente a la atracción de las otras
                dos; bajo la misma ley física, el sistema genera trayectorias
                caóticas que casi nunca se repiten, salvo en configuraciones
                orbitales muy concretas.
              </p>
              <p>
                <GalleryLink className={TEXT_LINK_CLASS}>
                  Explora seis órbitas de tres cuerpos
                </GalleryLink>
              </p>
            </Section>
          </StepBlock>
        </Steps>
      </AtomyLessonGate>
    </main>
  );
}
