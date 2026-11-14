/** A point or a velocity in the plane of the orbit: `[x, y]`. */
export type Vector2 = readonly [number, number];

/** The index of each of the three bodies: 0 is body 1. */
export const BODY_INDICES = [0, 1, 2] as const;

export type BodyIndex = (typeof BODY_INDICES)[number];

/** One vector per body, in the order body 1, body 2, body 3. */
export type PerBody = readonly [Vector2, Vector2, Vector2];

export const SOLUTION_SLUGS = [
  "lagrange",
  "figura-de-ocho",
  "butterfly-i",
  "goggles",
  "moth-i",
  "yin-yang-i",
] as const;

export type SolutionSlug = (typeof SOLUTION_SLUGS)[number];

/** The outer bodies' initial velocity in the collinear scheme; the middle one starts with minus twice it. */
export interface Seed {
  readonly vx: number;
  readonly vy: number;
}

/** Where each body is and how fast it moves at t = 0. */
export interface InitialConditions {
  readonly positions: PerBody;
  readonly velocities: PerBody;
}

/**
 * How a catalogue orbit starts: from a seed of the collinear scheme, or from
 * positions and velocities given one by one.
 */
export type CatalogueStart =
  | { readonly scheme: "collinear"; readonly seed: Seed }
  | { readonly scheme: "explicit"; readonly conditions: InitialConditions };

interface SolutionDefinition {
  readonly name: string;
  readonly description: string;
  /** What the drawn orbit looks like, for whoever cannot see the drawing. */
  readonly shape: string;
  /** Duration of one lap, in simulation time units (G = 1, three masses of 1). */
  readonly period: number;
  readonly start: CatalogueStart;
  readonly stable: boolean;
  /** Who found the orbit, when and how, as a full paragraph that opens with the year. */
  readonly discovery: string;
  /** Where the numbers of `start` come from. */
  readonly conditionsSource: ConditionsSource;
  /** Which instant of the figure is taken as t = 0, as a phrase in lower case. */
  readonly instantZeroMark: string;
}

export interface ConditionsSource {
  /** Authors and title of the publication, or a description of the calculation. */
  readonly reference: string;
  /** Link to the publication; absent when the numbers are this app's own calculation. */
  readonly href?: string;
  /** How the source obtained the numbers, and why this app uses them. */
  readonly note: string;
}

/** A catalogue orbit, with the initial conditions its start expands to. */
export interface Solution extends SolutionDefinition, InitialConditions {
  readonly slug: SolutionSlug;
}

const FOUND_BY_COMPUTER =
  "Encontrada mediante búsqueda numérica por Šuvakov y Dmitrašinović en 2013.";

const SUVAKOV_DMITRASINOVIC_2013 =
  "En 2013, Milovan Šuvakov y Veljko Dmitrašinović, del Instituto de Física de Belgrado, encontraron esta órbita mediante una búsqueda numérica. " +
  "Colocaron los tres cuerpos en línea recta, con el central en el punto medio de los otros dos, y simularon el movimiento para un gran número de velocidades iniciales. " +
  "Identificaron unas 50 regiones de velocidades con las que los cuerpos regresaban cerca de su posición de partida. " +
  "Refinaron cada una corrigiendo la velocidad paso a paso, en la dirección que más reducía la distancia de regreso, hasta que la diferencia entre el estado inicial y el final, en posición y velocidad, quedó por debajo de 10⁻⁶. " +
  "Publicaron en Physical Review Letters 15 condiciones iniciales, correspondientes a 13 órbitas distintas, y les dieron nombre.";

const MOORE_1993 =
  "En 1993, Cristopher Moore encontró esta órbita mediante cálculo numérico. " +
  "Partió de trayectorias aproximadas con la forma buscada y las deformó de manera progresiva para reducir la acción, una magnitud que se calcula sobre la trayectoria completa y que esta órbita hace mínima. " +
  "En 2000, Alain Chenciner y Richard Montgomery la encontraron de nuevo sin conocer el trabajo de Moore y demostraron matemáticamente que existe. " +
  "Carles Simó calculó sus condiciones iniciales con 8 cifras.";

const COLLINEAR_MARK =
  "uno de los momentos en que los tres cuerpos quedan en línea, con uno en el centro";

const LI_LIAO_2017_REFERENCE =
  "Xiaoming Li y Shijun Liao (2017), «More than six hundred new families of Newtonian periodic planar collisionless three-body orbits», Science China Physics, Mechanics & Astronomy 60, 129511";
const LI_LIAO_2017_HREF = "https://arxiv.org/abs/1705.00527";
const liLiao2017Why = (orbit: string): string =>
  `En 2017, Xiaoming Li y Shijun Liao incluyeron ${orbit} en un catálogo de 695 órbitas. ` +
  "Para elaborarlo exploraron por ordenador un millón de velocidades iniciales, refinaron cada candidata con el método de Newton-Raphson y publicaron sus condiciones iniciales con 10 cifras. " +
  "Este cálculo usa sus valores porque, al integrarlos durante un periodo, los cuerpos vuelven a su posición inicial con un error inferior a 2 × 10⁻⁸.";
const COMPARED_WITH_SUVAKOV =
  " Con las 5 cifras de Šuvakov y Dmitrašinović, el periodo que publicaron difiere del real entre una y dos milésimas.";

/** `orbit` names the orbit as the subject of the note's first sentence. */
function liLiao2017(orbit: string, comparison: string): ConditionsSource {
  return {
    reference: LI_LIAO_2017_REFERENCE,
    href: LI_LIAO_2017_HREF,
    note: liLiao2017Why(orbit) + comparison,
  };
}

/**
 * Li and Liao (2017) scheme: the bodies start in line at (-1, 0), (1, 0) and
 * (0, 0); the outer two share a velocity and the middle one has minus twice it.
 */
export function collinearStart({ vx, vy }: Seed): InitialConditions {
  return {
    positions: [
      [-1, 0],
      [1, 0],
      [0, 0],
    ],
    velocities: [
      [vx, vy],
      [vx, vy],
      [-2 * vx, -2 * vy],
    ],
  };
}

/** The positions and velocities a catalogue start expands to. */
export function initialConditionsOf(start: CatalogueStart): InitialConditions {
  return start.scheme === "collinear"
    ? collinearStart(start.seed)
    : start.conditions;
}

const collinear = (vx: number, vy: number): CatalogueStart => ({
  scheme: "collinear",
  seed: { vx, vy },
});

const DEFINITIONS: Record<SolutionSlug, SolutionDefinition> = {
  lagrange: {
    name: "Lagrange",
    description:
      "Los tres cuerpos forman un triángulo equilátero que gira sin deformarse.",
    shape:
      "Los tres cuerpos recorren una misma circunferencia, separados por un tercio de vuelta, en los vértices de un triángulo equilátero que gira.",
    period: 8.2691369013,
    start: {
      scheme: "explicit",
      conditions: {
        positions: [
          [0, 1],
          [-0.8660254038, -0.5],
          [0.8660254038, -0.5],
        ],
        velocities: [
          [-0.7598356857, 0],
          [0.3799178428, -0.6580370065],
          [0.3799178428, 0.6580370065],
        ],
      },
    },
    stable: false,
    discovery:
      "En 1772, Lagrange demostró que tres masas cualesquiera situadas en los vértices de un triángulo equilátero de lado a conservan esa configuración mientras el triángulo gira alrededor de su centro de masas, siempre que la velocidad angular cumpla ω² = G·(m₁ + m₂ + m₃)/a³. La condición se cumple para todo valor de a, y cada valor define una órbita distinta. Por tanto, el teorema determina una familia de soluciones y deja libres las posiciones y velocidades iniciales concretas.",
    conditionsSource: {
      reference: "Cálculo propio a partir de la geometría del triángulo",
      note: "Una simulación necesita un caso particular. Aquí se fijan G = 1 y tres masas iguales a 1, situadas sobre una circunferencia de radio 1 centrada en el centro de masas, lo que da un lado a = √3. Con estos valores, ω = 3^(−1/4). Cada cuerpo parte en dirección perpendicular a su radio, en el mismo sentido de giro que los demás, con velocidad v = ω·r = 3^(−1/4) ≈ 0,7598. El periodo de una vuelta es T = 2π/ω = 2π·3^(1/4) ≈ 8,27.",
    },
    instantZeroMark: "una posición cualquiera del triángulo mientras gira",
  },
  "figura-de-ocho": {
    name: "Figura de ocho",
    description:
      "Los tres cuerpos recorren, uno tras otro, una misma curva con forma de 8.",
    shape:
      "Los tres cuerpos recorren, uno tras otro, una misma curva con forma de 8.",
    period: 6.3259139829,
    start: collinear(0.3471168881, 0.5327249454),
    stable: true,
    discovery: MOORE_1993,
    conditionsSource: liLiao2017(
      "la figura de ocho",
      " Con las 8 cifras de Simó, el error se acerca a 10⁻⁷.",
    ),
    instantZeroMark:
      "uno de los momentos en que un cuerpo pasa por el cruce del 8 y los otros dos quedan a los lados",
  },
  "butterfly-i": {
    name: "Butterfly I",
    description: FOUND_BY_COMPUTER,
    shape:
      "Una figura estrecha y alargada en horizontal: cada cuerpo de los extremos traza varios lazos que se cruzan en su lado, y el cuerpo central recorre lazos que se entrelazan con los de ambos.",
    period: 6.2346748391,
    start: collinear(0.3068934205, 0.125506567),
    stable: false,
    discovery: SUVAKOV_DMITRASINOVIC_2013,
    conditionsSource: liLiao2017("esta órbita", COMPARED_WITH_SUVAKOV),
    instantZeroMark: COLLINEAR_MARK,
  },
  goggles: {
    name: "Goggles",
    description: FOUND_BY_COMPUTER,
    shape:
      "Una figura inclinada en diagonal: el cuerpo central traza lazos pequeños y casi circulares agrupados en el centro, y los otros dos trazan lazos alargados hacia esquinas opuestas, uno arriba a la izquierda y otro abajo a la derecha.",
    period: 10.4648495256,
    start: collinear(0.0833000718, 0.1278892555),
    stable: false,
    discovery: SUVAKOV_DMITRASINOVIC_2013,
    conditionsSource: liLiao2017("esta órbita", COMPARED_WITH_SUVAKOV),
    instantZeroMark: COLLINEAR_MARK,
  },
  "moth-i": {
    name: "Moth I",
    description: FOUND_BY_COMPUTER,
    shape:
      "Una figura casi cuadrada de lazos amplios y redondeados: un cuerpo traza los suyos arriba a la derecha, otro abajo a la izquierda, y el tercero recorre lazos que se entrelazan con los de ambos por toda la figura.",
    period: 14.8943051743,
    start: collinear(0.4644451728, 0.3960600146),
    stable: true,
    discovery: SUVAKOV_DMITRASINOVIC_2013,
    conditionsSource: liLiao2017("esta órbita", COMPARED_WITH_SUVAKOV),
    instantZeroMark: COLLINEAR_MARK,
  },
  "yin-yang-i": {
    name: "Yin-Yang I",
    description: FOUND_BY_COMPUTER,
    shape:
      "Una figura más ancha que alta: un cuerpo traza lazos en la mitad izquierda, otro en la mitad derecha, y el tercero recorre lazos amplios por el centro que se entrelazan con los de ambos.",
    period: 10.9633031497,
    start: collinear(0.2827020949, 0.3272089716),
    stable: false,
    discovery: SUVAKOV_DMITRASINOVIC_2013,
    conditionsSource: liLiao2017("esta órbita", COMPARED_WITH_SUVAKOV),
    instantZeroMark: COLLINEAR_MARK,
  },
};

export function getSolution(slug: SolutionSlug): Solution {
  const definition = DEFINITIONS[slug];
  return { slug, ...definition, ...initialConditionsOf(definition.start) };
}

/** The six solutions, in the order the application presents them. */
export const SOLUTIONS: readonly Solution[] = SOLUTION_SLUGS.map(getSolution);

/** Narrows a string, such as a route parameter, to a catalogue slug. */
export function isSolutionSlug(value: string): value is SolutionSlug {
  return SOLUTION_SLUGS.some((slug) => slug === value);
}

function solutionAtCircularIndex(index: number): Solution {
  const count = SOLUTIONS.length;
  const solution = SOLUTIONS[((index % count) + count) % count];
  if (!solution) throw new Error(`No solution at index ${String(index)}`);
  return solution;
}

/** The solutions before and after `slug`; the first and the last are adjacent. */
export function adjacentSolutions(slug: SolutionSlug): {
  readonly previous: Solution;
  readonly next: Solution;
} {
  const index = SOLUTION_SLUGS.indexOf(slug);
  return {
    previous: solutionAtCircularIndex(index - 1),
    next: solutionAtCircularIndex(index + 1),
  };
}
