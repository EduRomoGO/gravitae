// Whether the language model can answer right now (lib/atomy/model-status.ts):
// the interface asks it on load, when the browser gets its connection back,
// and with ?fresh after a call to the model failed, which skips the answer
// kept from before.

import { probeGemini } from "@/lib/atomy/gemini";
import {
  createModelStatusCache,
  type ModelStatus,
} from "@/lib/atomy/model-status";

const modelStatus = createModelStatusCache(() => probeGemini());

export async function GET(request: Request): Promise<Response> {
  const fresh = new URL(request.url).searchParams.has("fresh");
  const status: ModelStatus = await modelStatus({ fresh });
  return Response.json(
    { status },
    { headers: { "cache-control": "no-store" } },
  );
}
