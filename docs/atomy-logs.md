# Logs de las llamadas al modelo

En desarrollo (`npm run dev`), cada petición a `/api/atomy/chat` y a `/api/atomy/correction` escribe una línea JSON por evento en dos sitios:

- `logs/atomy/<YYYY-MM-DD>.jsonl` (un fichero por día local, ignorado por git): cada línea lleva además `at`, la hora ISO en que se escribió. Sobrevive a los reinicios de `next dev`.
- La consola del servidor, que Next copia en `.next/dev/logs/next-development.log` como texto en el campo `message` de su propia línea JSON. Next vacía ese fichero cada vez que arranca y su `timestamp` cuenta desde el arranque.

En producción no se escriben. El código está en `src/lib/atomy/request-log.ts` (eventos), `request-log-file.ts` (ficheros) y `request-log-view.ts` (visor).

## Eventos

Todas las líneas llevan `atomy` (`chat` o `correction`), `requestId` (un UUID por petición) y `event`.

| `event` | Cuándo | Qué registra |
|---|---|---|
| `request` | La petición pasó la validación y va al modelo. | `model`, `promptVersion` e `input`: lo que lee el modelo además de las instrucciones. En la corrección, el texto de `correctionInput`; en el chat, la conversación de `chatConversation` con el snapshot de la página. |
| `attempt` | Cada intento de la corrección (el primero y el reintento de E3). | `attempt`, `outcome` (`success`, `invalid-output`, `provider-error`, `aborted`), `finishReason`, `inputTokens`, `outputTokens`, `reasoningTokens`, `totalMs`, `sdkRetries`, `text` (la salida en bruto), `validationError` (el mensaje que recibe el reintento) o `providerError`; `fallbackModel` cuando respondió un modelo de respaldo. Un intento `provider-error` lleva solo `totalMs`, `sdkRetries` y `providerError`, sin tokens, `finishReason` ni `text`; uno `aborted` lleva `totalMs`, `sdkRetries` y `abortedBy` (`reader` o `timeout`). |
| `step` | Cada paso del chat (una llamada al modelo; hasta `CHAT_MAX_STEPS`). | `step`, `outcome` (`success`, `provider-error`), los mismos tokens y latencias, `firstChunkMs` del paso, `text`, `toolCalls` (`toolName` e `input`) o `providerError`; `fallbackModel` cuando respondió un modelo de respaldo. Un paso `provider-error` lleva solo `totalMs`, `sdkRetries` y `providerError`. |
| `response` | Toda respuesta del endpoint, también las que no llegan al modelo. | `outcome`: `rejected` (antes del modelo: 503 `reduced-mode` o 400 `invalid-request`), `streamed` (fin del stream del chat, siempre 200) o `answered` (respuesta de la corrección: 200, 429 `rate-limit` o 502). `status` (HTTP), `error` (`invalid-request`, `reduced-mode`, `provider`, `rate-limit`, `invalid-output`), `rejection` en un 400 (`body-too-large`, sin leer el cuerpo más allá de los bytes que caben en su máximo de caracteres; `body-too-long`, `invalid-json` o `invalid-schema` con los `issues` de Zod: `path` y `message`), totales de tokens, `finishReason`, `sdkRetries`, `totalMs`; en la corrección, `attempts` y, si un abort cortó el último intento, `abortedBy`; en el chat, `steps`, `firstChunkMs`, `providerError` y `abortedBy` (`reader` o `timeout`). |

`model` del evento `request` es siempre el modelo principal; `fallbackModel` nombra el modelo de respaldo que respondió cuando el principal había agotado su cuota.

`providerError` lleva `name`, `statusCode` y `message` del error del proveedor (el de Gemini, p. ej. 503 «This model is currently experiencing high demand»). Cuando el AI SDK agota sus reintentos, `name` es `AI_RetryError` y `errors` lista cada llamada fallida.

El chat responde siempre 200 una vez validada la petición: sus errores viajan en el stream, y la línea `response` se escribe al acabar el stream, con el `error` que recibió el chat.

## AI SDK DevTools

En desarrollo, `src/instrumentation.ts` registra además AI SDK DevTools, que guarda cada llamada al modelo en `.devtools/generations.json` (ignorado por git). `npm run devtools` lo sirve en http://localhost:4983, agrupado en runs y pasos, con `functionId` `atomy-chat` o `atomy-correction`.

Complementa al log de arriba; no lo sustituye.

| Lo que DevTools guarda y el log no | Lo que el log guarda y DevTools no |
|---|---|
| El prompt tal como se envía: instrucciones de sistema, mensajes y tools (nombre y descripción). | Los eventos de la app: peticiones rechazadas (400 con issues de Zod), modo reducido, `validationError` del reintento, `abortedBy`, status y código de error de la respuesta. |
| La salida estructurada completa de cada paso, con `providerMetadata`. | `sdkRetries` y cada error de un `RetryError`; DevTools guarda solo el mensaje del error final. |
| | `firstChunkMs` (TTFT). |

Ambos registran tokens (con los de razonamiento), duración por paso, tool calls y texto de salida. Para cruzar una petición entre los dos, sirve la hora: `at` en el log, `started_at` en DevTools.

`@ai-sdk/devtools` va fijado a la versión que depende exactamente del `ai` instalado (1.0.68 ↔ 7.0.165). Si no coinciden, npm instala una segunda copia de `ai` y `registerTelemetry` deja de compilar; al subir `ai`, sube DevTools a la versión que depende de la nueva (`npm view @ai-sdk/devtools@<v> dependencies.ai`).

## Ver el log

`npm run atomy-logs` muestra una fila por petición del último día registrado: hora, id, endpoint, versión del prompt, status, error, llamadas al modelo (intentos o pasos), reintentos del AI SDK, tokens de entrada, salida y razonamiento, y latencias.

| Opción | Efecto |
|---|---|
| `--date YYYY-MM-DD` | Las peticiones de ese día. |
| `--all` | Las peticiones de todos los días. |
| `--errors` | Solo las respuestas con `error`. |
| `--endpoint chat\|correction` | Solo un endpoint. |
| `--last N` | Solo las N últimas. |
| `--id <prefijo>` | Todos los eventos de una petición (busca en todos los días): el input completo, cada intento o paso con su salida en bruto, `validationError`, `providerError` y la respuesta. |

Para consultas que el visor no cubre, los ficheros son JSONL y se filtran con `jq`:

```sh
jq -c 'select(.event == "response" and .error != null)' logs/atomy/*.jsonl
```
