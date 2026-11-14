- [gravitae](#gravitae)
  - [Ejecutar en local con Docker](#ejecutar-en-local-con-docker)
    - [Sin Docker](#sin-docker)
  - [Atomy con modelo de lenguaje](#atomy-con-modelo-de-lenguaje)
    - [Límites de uso del modelo](#límites-de-uso-del-modelo)
    - [Lo que una app real necesitaría](#lo-que-una-app-real-necesitaría)
    - [Eval contra Gemini real](#eval-contra-gemini-real)
  - [Tests](#tests)
  - [Decisiones técnicas y de producto](#decisiones-técnicas-y-de-producto)
  - [Uso de IA](#uso-de-ia)


# gravitae

Aplicación web que enseña la ley de gravitación universal de Newton e incluye una galería de soluciones periódicas del problema de los tres cuerpos.

Versión desplegada: https://gravitae.vercel.app

## Ejecutar en local con Docker

Solo hace falta Docker con Compose v2.24 o posterior: la app no usa base de datos ni ningún otro servicio. Construye la imagen de producción y sirve la app en http://localhost:3000, en primer plano, con los logs del servidor por la salida estándar:

```sh
npm run docker
# o, sin npm: docker compose up --build
```

`PORT=3100 npm run docker` la sirve en otro puerto si el 3000 está ocupado. `docker compose down` la para y elimina el contenedor y la red; Ctrl+C para el proceso que la sirve. El contenedor lee `.env.local` al arrancar (sección siguiente); sin ese fichero, la app arranca en modo reducido. La clave nunca entra en la imagen: `.dockerignore` excluye los `.env*`.

El build necesita salida a internet: descarga las dependencias de `package-lock.json` desde el registry de npm y la tipografía Inter desde Google Fonts, que `next/font` incorpora al bundle durante el build. En una máquina tras un proxy o con la salida restringida hay que permitir ambos destinos; sin ellos `npm run docker` falla al construir.

### Sin Docker

Con Node 24 (fijado en `.nvmrc` y `engines`), `npm install && npm run dev` sirve la app en modo desarrollo en http://localhost:3000; `npm run build && npm start` la sirve en modo producción. Lee el mismo `.env.local`.

## Atomy con modelo de lenguaje

El modo con IA conversa con Gemini: en la sección de la ley de la gravitación universal, el chat con Atomy y la corrección del razonamiento de cada predicción; en el buscador de órbitas, el chat con Atomy. Está activado por defecto; el switch «Modo reducido» de la cabecera lo sustituye por el modo reducido, y la app recuerda la elección en una cookie. El progreso de esa sección es el mismo en los dos modos. Necesita una clave de la API de Gemini en `.env.local`, en la raíz del repositorio.

La clave es gratuita: se crea en https://aistudio.google.com/apikey con una cuenta de Google, en el tier Free, sin facturación (al aceptar los términos, AI Studio crea un proyecto y una clave por defecto). Es el único proveedor que admite la app: los prompts y las herramientas están medidos con Gemini. `.env.example` lista todas las variables, vacías; cópialo y rellena la clave:

```sh
cp .env.example .env.local
# GOOGLE_GENERATIVE_AI_API_KEY=tu-clave
```

`GOOGLE_GENERATIVE_AI_API_KEY` es la única credencial que necesita la app; las demás variables de `.env.example` son opcionales y solo las usa `npm run eval` («Eval contra Gemini real»). Para revisar la prueba con una clave propia basta con ponerla en `.env.local` antes de `npm run docker` o `npm run dev`; el contenedor la lee al arrancar, así que cambiarla exige reiniciarlo.

La clave solo la lee el servidor. Sin ella, la app funciona en modo reducido, en el que Atomy guía los experimentos sin modelo de lenguaje; una banda bajo la cabecera muestra «Modo reducido: sin modelo de lenguaje configurado. Atomy sigue guiando los experimentos sin IA.» y el switch «Modo reducido» queda encendido y desactivado.

La app entra también en modo reducido sin conexión: cuando el navegador la pierde, o cuando el servidor tiene la clave pero no alcanza a Gemini (`/api/atomy/status` consulta el recurso del modelo, que no genera nada). La banda dice entonces «Modo reducido: sin conexión con el modelo de lenguaje», el lector sigue en el mismo punto de la sección y el modo con IA vuelve solo al recuperarse la conexión.

Encender el switch «Modo reducido» lleva también al modo reducido, y la banda lo dice: «Modo reducido: activado con el interruptor de la cabecera. Puedes desactivarlo en cualquier momento.». Cuando se dan varios motivos a la vez (sin clave, sin conexión, switch encendido), la banda los nombra todos.

### Límites de uso del modelo

Atomy usa `gemini-3.5-flash-lite`. Google aplica la cuota del tier Free por proyecto y por modelo, así que cuando ese modelo la agota (un 429), la misma clave sigue respondiendo con `gemini-3.1-flash-lite` y, después, con `gemini-2.5-flash-lite`. Son modelos inferiores y los prompts no están medidos con ellos: bajo cada respuesta o corrección que escribe un modelo de respaldo, la app avisa de que puede ser menos precisa. Cuando los tres han agotado su cuota, el modo con IA responde «límite de uso alcanzado» hasta que se renueva (medianoche, hora del Pacífico); el resto de la app sigue funcionando. La cuota de cada modelo se consulta en https://aistudio.google.com/rate-limit, y la cadena está en `ATOMY_MODEL_IDS` (`src/lib/atomy/model.ts`).

La versión desplegada usa una clave del tier gratuito de Google, sin facturación: nadie puede generar gasto desde la URL pública, pero la cuota de cada modelo (500 peticiones al día la de `gemini-3.5-flash-lite`) la comparten todos los visitantes.

Por ser una prueba técnica, no hay rate limit (ver sección siguiente).

### Lo que una app real necesitaría

Esta prueba deja fuera varias medidas de seguridad y de operación del asistente porque no se dan las condiciones que las justifican: la clave desplegada no tiene facturación, la app no tiene base de datos ni registro de usuarios, la interfaz no pide datos personales y las herramientas del modelo solo calculan u operan la página. Una aplicación en producción las necesitaría:

| Medida | Estado en esta prueba |
|---|---|
| Rate limit por IP sobre `/api/atomy/` (por ejemplo, una regla del firewall de Vercel), tope diario global que reserve parte de la cuota y facturación con alertas de gasto. | Solo límites por petición: longitud, número de mensajes y tokens de salida. |
| Conversaciones guardadas de forma anónima, solo para analizar fallos, con métricas por tipo de fallo; el texto del lector, filtrado o con retención corta, porque puede contener datos personales. | No se guarda nada en producción; los logs con el texto del lector existen solo en desarrollo (`docs/atomy-logs.md`). |
| Logs y trazas por petición en producción: latencia, tokens, coste, errores, versión del prompt y modelo. | Los logs de desarrollo lo registran todo salvo el coste. |
| Detección de jailbreak en producción y red teaming periódico. | Seis casos adversariales en el eval. |
| `safetySettings` de Gemini revisados para un público que puede incluir menores. | Valores por defecto del proveedor. |
| Opinión del lector sobre cada respuesta como fuente de casos del eval. | Casos del eval escritos a mano. |
| Tier de pago o acuerdo sin retención de datos con el proveedor. | Tier Free: Google puede usar el contenido enviado. |
| Aviso distinto para la cuota diaria agotada y para el límite por minuto. | El mismo mensaje en los dos casos, porque la API no documenta cómo distinguirlos. |
| Mensajes del asistente firmados, si alguna herramienta deja de ser de solo cálculo o de solo la página. | Se valida su forma, sin firma. |

### Eval contra Gemini real

`npm run eval` pasa los casos de `tests/evals/atomy/cases.ts` (correctos, límite y adversariales) por los route handlers de producción contra Gemini real. No forma parte de `npm run check` y se omite si falta alguna de estas variables de `.env.local`:

```sh
GOOGLE_GENERATIVE_AI_API_KEY=tu-clave-de-gemini
# OpenCode Go: juez del texto libre y lector simulado, solo para el eval
AI_API_KEY=tu-clave-de-opencode-go
AI_BASE_URL=https://opencode.ai/inference/go/openai/v1
```

- Cada caso se ejecuta varias veces, porque Gemini no responde siempre igual, y cada ejecución es un ensayo. Cada check comprueba una propiedad de la respuesta, por ejemplo `plain_text` (sin Markdown) o `expected_verdict` (la corrección da el veredicto que corresponde). El informe da el porcentaje de ensayos que pasan cada check, y `npm run eval` falla si alguno queda por debajo del mínimo exigido, su umbral: 90 % en los checks que comprueba el código, 95 % en `no_false_correct`, porque dar por buena una respuesta errónea salta el experimento, y 80 % en los criterios del juez, porque el juez también se equivoca.
- `EVAL_REPEATS` fija las repeticiones por caso (3 por defecto) y `EVAL_CASES`, una lista de ids separados por comas, limita los casos.
- Cada ejecución escribe su resultado en `tests/evals/atomy/runs/`, el informe en `tests/evals/atomy/report.md` (cada cifra con su intervalo de confianza del 95 % y la comparación con la ejecución anterior) y los veredictos nuevos del juez en `tests/evals/atomy/judge-labels.json`.
- Para validar el juez, pon en `human` de cada veredicto `true` si el texto cumple el criterio o `false` si no; la siguiente ejecución da la tasa de verdaderos positivos y de verdaderos negativos del juez.
- El informe cuenta las peticiones a Gemini y a OpenCode Go. Las peticiones a Gemini van espaciadas 6,5 s para no superar el límite por minuto del tier Free, y el eval se detiene en el primer 429.
- El eval no mide latencia, tokens ni coste. Una aplicación real los mediría, pero para que esas cifras sirvan hace falta un análisis más completo de la herramienta y de su uso: cuántas preguntas y correcciones hace un lector por sesión, cuánta entrada sirve la caché de Gemini y cómo separar la espera entre peticiones del tier Free. Mientras tanto, los timeouts del chat y de la corrección siguen sin medir contra el modelo real.

## Tests

| Comando | Qué ejecuta |
|---|---|
| `npm run check` | Typecheck, lint y tests unitarios en paralelo (`scripts/ci.sh`), con la salida de cada paso en `.ci/<paso>.log`. En un clon recién hecho los ejecuta sobre todo el proyecto; en una rama con cambios, lint y tests unitarios cubren solo los ficheros cambiados respecto a `origin/main`, y typecheck siempre el proyecto entero. |
| `npm run check:full` | Lo mismo sobre todos los ficheros, más los e2e en Chromium, Firefox y WebKit. Es lo que ejecuta CI en cada pull request, un paso por job. |
| `npm test` | Vitest con Testing Library: el integrador con las seis órbitas, la física de los experimentos, los route handlers con un modelo simulado y los componentes de cliente. |
| `npm run test:e2e` | Playwright contra la build de producción, con Gemini sustituido por un servidor falso: sección de la ley de la gravitación universal, galería, vuelta del detalle a la galería, buscador, Atomy, modo reducido, teclado y axe en todas las rutas. Chromium ejecuta todos los tests; Firefox y WebKit, los marcados `@cross-browser`. |
| `npm run eval` | Atomy contra Gemini real (sección «Eval contra Gemini real»). |

Los e2e necesitan los navegadores de Playwright, que se instalan una vez con `npx playwright install --with-deps chromium firefox webkit`.

Sin test automático quedan el rendimiento en móvil y el aspecto visual. El rendimiento en móvil se ha estimado a partir de lo medido en un Apple M4 (por ejemplo, unos 9 ms por frame en la galería en un móvil de gama baja), porque no había un dispositivo real disponible y la emulación de CPU de Chrome no reproduce un móvil. La comparación de capturas está aplazada mientras el diseño cambie.

## Decisiones técnicas y de producto

| Decisión | Motivo |
|---|---|
| Next.js 16 con App Router y TypeScript `strict` | Las rutas dinámicas dan a cada solución de la galería su URL compartible y los route handlers alojan en el servidor las llamadas al modelo. |
| npm y Node 24 fijado | npm viene con Node, así que la app se instala sin herramientas adicionales. |
| Tailwind CSS v4 | El responsive y el foco visible se escriben en el mismo marcado del componente, y es la opción por defecto de `create-next-app`. |
| Controles con elementos HTML nativos | `<input type="range">` y `<button>` ya traen teclado y rol ARIA, sin dependencias. |
| Simulaciones dibujadas en SVG | `viewBox` escala el dibujo nítido a cualquier pantalla y cada cuerpo es un nodo del DOM que los tests consultan; seis tarjetas animadas ocupan 1,5–2 ms por frame en escritorio. |
| Sin tRPC | La app tiene una sola operación de servidor, el route handler del modelo, y tRPC rinde con muchas. |
| Galería simulada en el navegador con un integrador Dormand-Prince 5(4) propio, tolerancia 1e-10 | Cierra la vuelta de las seis órbitas con un error menor que 1e-5 px en 0,3–3 ms; los integradores de paso fijo deforman las órbitas con acercamientos. |
| Condiciones iniciales de Li y Liao (2017) | Son los únicos valores que, integrados, vuelven al punto de partida con un error menor que 1e-8 y con el periodo publicado. |
| Scroll, foco y punto de la animación de la galería restaurados a mano | Ninguna configuración de Next.js conserva el scroll y el foco al volver del detalle con el enlace «← Galería». |
| Buscador de órbitas con Levenberg-Marquardt en un Web Worker | El cierre de la órbita (0,15–1,9 s) se calcula fuera del hilo de la página, así que la interfaz no se congela; si el lector cambia la semilla a mitad de cálculo, el worker se termina y el cálculo anterior se descarta al instante. |
| Buscador de órbitas limitado al esquema colineal, como versión inicial | Con dos parámetros (vx, vy) el cierre converge en segundos y sus resultados se comparan directamente con cinco de las órbitas de la galería. A cambio, solo explora ese plano de condiciones iniciales, cierra solo regresos que ya eran cercanos y no analiza colisiones ni estabilidad. Queda pendiente un slider para llevar la animación a cualquier instante, explicar mejor en la página el cierre de la órbita, una configuración de partida libre (posición, velocidad y dirección de cada cuerpo) y que Atomy guíe la búsqueda, también en el modo reducido. |
| Sección de la ley de la gravitación universal con texto base fijo y el modelo en puntos concretos | Garantiza que la explicación cubre la ley completa y la hace comprobable con aserciones fijas. |
| AI SDK de Vercel con `@ai-sdk/google` | Una sola API da streaming, tool calling y el estado del chat en React, y cambiar de proveedor es cambiar de paquete. |
| Gemini `gemini-3.5-flash-lite` en tier Free | Desarrollo sin coste y 500 peticiones al día, frente a las 20 de `gemini-3.6-flash`. |
| Cadena de modelos de respaldo ante un 429 | Google aplica la cuota por modelo, así que la misma clave sigue respondiendo con otro. |
| Clave solo en el servidor y fuera de la imagen Docker | El navegador y la imagen nunca contienen la credencial. |
| Modo reducido sin clave, sin conexión o con el switch «Modo reducido» encendido | La sección de la ley de la gravitación universal y la galería funcionan completas sin modelo de lenguaje. |
| Vercel, plan Hobby | Es el único host gratuito con adaptador verificado de Next.js 16 y sin suspensión por inactividad. |
| Vitest + Testing Library; Playwright + `@axe-core/playwright` | Vitest configura TypeScript y ESM sin capa adicional; Playwright comprueba en un navegador real el estado al volver del detalle, el teclado y la accesibilidad. |
| Servidor HTTP falso con forma de Gemini en los e2e | Los tests ejecutan la interfaz, el route handler y las herramientas sobre la build de producción sin gastar cuota. |
| Eval contra Gemini real fuera de `npm run check` | Mide la calidad del modelo real con intervalos de confianza del 95 % sin que un 429 haga fallar la suite normal. |
| Modo de revisión `?todo` («Ver toda la lección de golpe») mantenido en el código de producción | Se usó en desarrollo para comprobar el flujo completo de la lección sin recorrerla paso a paso, y no dio tiempo a retirarlo. En producción no se activa (la página lo condiciona a `NODE_ENV`), pero su código llega al bundle: la prop `showAll` atraviesa `AtomyLessonGate`, `Steps`, `Predict` y `PlanetRanking`, y `WithoutProgress` existe solo para él. Habria que eliminar este codigo. No se hace por falta de tiempo |
| Línea base del eval: 2 ejecuciones de cada uno de los 19 casos | La línea base es la ejecución con la que se comparan las siguientes. Con 2 ejecuciones por caso (38 ensayos, 49 peticiones a Gemini), todos los checks superan su umbral. Con tan pocos ensayos, el porcentaje real podría ser más bajo que el medido: en 12 de los 16 checks, el intervalo de confianza del 95 % llega por debajo del umbral. Para descartarlo harían falta unas 18 ejecuciones por caso, unas 440 peticiones, casi toda la cuota diaria de 500 del tier Free. |

## Uso de IA

La IA ha tenido un papel significativo en el desarrollo, en cinco usos:

| Uso | En qué consistió |
|---|---|
| Investigar los problemas físicos | Búsqueda y contraste de fuentes primarias sobre las condiciones iniciales de las órbitas, la elección del integrador y la ausencia de solución general del problema de los tres cuerpos, con verificaciones numéricas de cada resultado. |
| Redactar la documentación | Redacción de este README y de las especificaciones de cada funcionalidad a partir de lo decidido y medido. |
| Discutir trade-offs | Conversación sobre las alternativas de cada decisión, cuantificando el coste de cada opción: duración del frame por tecnología de dibujo, cuota diaria por modelo, límites de cada host gratuito. |
| Prototipar el layout | Prototipos desechables para elegir entre variantes antes de implementar: el layout de la galería y el detalle, y el personaje de Atomy. |
| Implementar las soluciones de código | Escritura del código de la app y de sus tests a partir de las specs y de las decisiones registradas. |
