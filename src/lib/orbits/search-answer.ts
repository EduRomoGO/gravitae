import { integrateLapData, type LapData } from "./lap";
import { closeOrbit, simulateSeed, type Closure } from "./search";
import type {
  SearchReply,
  SearchRequest,
  SearchResponse,
} from "./search-protocol";
import { collinearStart } from "./solutions";

function lapDataOf(closure: Closure): LapData | null {
  if (closure.kind !== "closed") return null;
  return integrateLapData({
    ...collinearStart(closure.seed),
    period: closure.period,
  });
}

/** The response to a request, calculated where it is called. */
export function answer(request: SearchRequest): SearchResponse {
  switch (request.kind) {
    case "simulate":
      return {
        id: request.id,
        kind: "simulate",
        result: simulateSeed(request.seed, request.maxTime),
      };
    case "close": {
      const result = closeOrbit(request.seed, request.period);
      return { id: request.id, kind: "close", result, lap: lapDataOf(result) };
    }
  }
}

/** The response to a request, or its failure if the calculation throws. */
export function replyTo(request: SearchRequest): SearchReply {
  try {
    return answer(request);
  } catch (error) {
    return {
      id: request.id,
      kind: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
