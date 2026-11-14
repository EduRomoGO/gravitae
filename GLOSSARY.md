# Gravitae

Aplicación de divulgación con dos partes: una lección guiada sobre la ley de la gravitación universal de Newton, con Atomy como guía y un modelo de lenguaje que corrige y explica, y una galería de soluciones periódicas del problema de los tres cuerpos con un buscador de órbitas propias. Las definiciones van en castellano; el identificador de código, en inglés, cuando existe.

## Modo de la aplicación

**Modo con IA**:
El modo en que Atomy habla a través del modelo de lenguaje: el chat de la lección, la corrección del razonamiento y el chat del buscador. Es el modo de partida.
Código: `AtomyModeChoice` `"ia"`, `LessonMode` `"ia"`; en los nombres y comentarios del código se llama «advanced mode» (`useAdvancedMode`).
_Avoid_: modo avanzado, modo IA

**Modo reducido**:
El modo sin el modelo de lenguaje: la lección corrige las predicciones por código, sin campo de razonamiento ni chat, y el buscador funciona solo con sus controles. La aplicación está en él por elección del lector o porque el modo con IA está fuera de alcance; la banda del modo reducido nombra todos los motivos que se cumplen a la vez. El modo con IA vuelve solo en cuanto deja de cumplirse el último motivo ajeno al lector.
Código: `AtomyModeChoice` `"reduced"`, `LessonMode` `"reduced"`; `reducedReasons` (devuelve `null` fuera del modo reducido).
_Avoid_: modo base, modo básico, modo sin IA, modo offline, modo degradado

**Motivo del modo reducido**:
La causa por la que la aplicación está en el modo reducido. Hay cuatro; las tres primeras dejan el modo con IA fuera de alcance (`Unavailable`) y desactivan el switch «Modo reducido».
Código: `ReducedReason`.

| Motivo | Código | Texto en la banda |
| --- | --- | --- |
| El servidor no tiene la clave del modelo | `"no-key"` | «sin modelo de lenguaje configurado (consulta el README)» |
| El servidor tiene la clave pero no alcanza el modelo | `"unreachable"` | «sin respuesta del modelo de lenguaje» |
| El navegador no tiene conexión | `"offline"` | «sin conexión con el modelo de lenguaje» |
| El lector eligió el modo reducido | `"chosen"` | «activado con el interruptor de la cabecera» |

**Elección del lector**:
El modo que el lector elige con el switch «Modo reducido»: el modo con IA o el modo reducido. Sin elección guardada vale el modo con IA; antes de la hidratación de la página no se conoce.
Código: `AtomyModeChoice` (`"ia" | "reduced"`); `AtomyMode.choice`, `null` hasta la hidratación.
_Avoid_: preferencia, modo preferido

**Switch «Modo reducido»**:
El control de la cabecera con que el lector hace su elección. Encendido, la aplicación está en el modo reducido; apagado, en el modo con IA. Queda encendido y desactivado mientras el modo con IA está fuera de alcance.
_Avoid_: toggle, interruptor de IA

**Banda del modo reducido**:
El aviso bajo la cabecera que nombra los motivos del modo reducido que se cumplen.
Código: `reducedModeNotice`.
_Avoid_: aviso offline

**Estado del modelo**:
Si el modelo de lenguaje puede responder ahora, según lo comprueba el servidor: disponible, sin clave o sin alcance.
Código: `ModelStatus` (`"available" | "no-key" | "unreachable"`).

## Lección

**Atomy**:
El personaje que guía la lección y el buscador; en el modo con IA habla con la voz del modelo de lenguaje.
Código: `AtomyState` (su animación).
_Avoid_: el átomo, el asistente, el bot

**Lección**:
El recorrido guiado de texto fijo sobre la ley de la gravitación universal, dividido en secciones y mostrado por pasos.
_Avoid_: curso, tutorial

**Sección**:
Cada uno de los apartados con título de la lección, identificado por un id estable.
Código: `SectionId`.
_Avoid_: capítulo, tema

**Paso**:
La porción de la lección que aparece de una vez y termina en un experimento; resolver ese experimento muestra el paso siguiente. Un paso puede abarcar el final de una sección y el inicio de la siguiente.
Código: `Step` (`n`).
_Avoid_: pantalla, slide

**Predicción**:
Una pregunta de la lección en la que el lector elige una respuesta antes de comprobarla con un experimento. Cada predicción está en una sección, y una sección puede tener más de una.
Código: `Prediction`, `PredictionId`; `PREDICTION_SECTIONS` da la sección de cada una; `PredictionSectionId` para las secciones que tienen predicción.
_Avoid_: pregunta tipo test, quiz

**Razonamiento**:
El texto libre en que el lector explica por qué elige su respuesta a una predicción. Solo existe en el modo con IA.
_Avoid_: justificación, respuesta abierta

**Corrección del razonamiento**:
El juicio de Atomy sobre un razonamiento: un veredicto, la idea equivocada que hay detrás, si la hay, y una explicación.
Código: `Correction`, `ReasoningCorrection`.
_Avoid_: evaluación, feedback

**Veredicto**:
La calificación de un razonamiento en una corrección: correcto, parcial o incorrecto. Un veredicto correcto resuelve la predicción sin el experimento.
Código: `Verdict` (`"correct" | "partial" | "incorrect"`).
_Avoid_: nota, puntuación

**Idea equivocada**:
Una concepción errónea del catálogo cerrado de la lección, asociada a una predicción; la corrección elige una de las de su predicción y no inventa otras.
Código: `Misconception`, `MisconceptionId`.
_Avoid_: error conceptual, fallo

**Experimento**:
La pieza interactiva con que termina un paso y con la que el lector comprueba una predicción o ve una idea en acción.
Código: `Experiment`.
_Avoid_: simulación, demo

**Widget**:
Un experimento cuyo estado Atomy puede fijar desde el chat.
Código: `WidgetId`, `useRegisterWidget`.
_Avoid_: control, componente

**Progreso**:
Lo que el lector lleva hecho en una lección (pasos mostrados, sección, respuestas, conversación con Atomy), común a los dos modos y conservado entre recargas.
Código: `ProgressStore`.
_Avoid_: sesión, partida

## Chat

**Superficie**:
Cada página en la que se abre el chat con Atomy, con sus propias herramientas de página y el estado que acompaña a cada pregunta: la lección y el buscador.
Código: `ChatSurface`.
_Avoid_: contexto del chat, canal

**Herramienta de página**:
Una acción sobre la página que Atomy ejecuta desde el chat, como ir a una sección o fijar un widget.
Código: `PAGE_TOOL_NAMES`, `SurfaceToolRunners`.
_Avoid_: tool, comando

## Galería y buscador

**Galería**:
La página que muestra las seis soluciones del catálogo como tarjetas animadas.
_Avoid_: catálogo (es el conjunto de soluciones, no la página)

**Solución**:
Una órbita periódica publicada del problema de los tres cuerpos, con sus condiciones iniciales y su periodo; el catálogo tiene seis.
Código: `Solution`, `SolutionSlug`.
_Avoid_: órbita del catálogo, ejemplo

**Detalle**:
La página de una solución, con su animación y sus controles de reproducción.
_Avoid_: ficha, vista de solución

**Cuerpo**:
Cada una de las tres masas iguales de una órbita, numeradas del 1 al 3.
Código: `BodyIndex`, `PerBody`.
_Avoid_: planeta, partícula

**Condiciones iniciales**:
Las posiciones y velocidades de los tres cuerpos en el instante cero.
Código: `InitialConditions`.

**Periodo**:
La duración de una vuelta, en unidades de tiempo de la simulación.
Código: `period`.

**Vuelta**:
Un periodo calculado de una órbita, que la animación repite en bucle.
Código: `Lap`.
_Avoid_: ciclo, loop

**Trayectoria**:
Los caminos de los cuerpos desde el instante cero hasta un instante dado, abiertos donde terminan.
Código: `Trajectory`.
_Avoid_: recorrido

**Estela**:
El trazo que deja cada cuerpo detrás de sí durante la animación.
Código: `LapTrails`.
_Avoid_: rastro, cola

**Buscador**:
La página en que el lector, o Atomy, busca órbitas periódicas propias a partir de una semilla.
Código: `FinderController`.
_Avoid_: explorador, finder

**Semilla**:
La velocidad inicial de los cuerpos exteriores en el esquema colineal; el cuerpo central parte con menos el doble de ella.
Código: `Seed`.

**Mejor regreso**:
El instante en que los cuerpos de una semilla simulada vuelven más cerca de donde empezaron, y a qué distancia.
Código: `Return`.

**Cierre**:
La corrección de una semilla a partir de su mejor regreso hasta que el estado vuelve sobre sí mismo; termina cerrada, con su periodo, o sin converger.
Código: `Closure`.
_Avoid_: ajuste, optimización
