// The messages between the page and the search's Web Worker.

import type { LapData } from "./lap";
import type { Closure, Seed, Simulation } from "./search";

export type SearchRequest =
  | {
      readonly id: number;
      readonly kind: "simulate";
      readonly seed: Seed;
      readonly maxTime: number;
    }
  | {
      readonly id: number;
      readonly kind: "close";
      readonly seed: Seed;
      readonly period: number;
    };

export type SearchResponse =
  | {
      readonly id: number;
      readonly kind: "simulate";
      readonly result: Simulation;
    }
  | {
      readonly id: number;
      readonly kind: "close";
      readonly result: Closure;
      /**
       * The lap of a closed orbit, integrated here so the page only plays
       * it; null when the orbit did not close.
       */
      readonly lap: LapData | null;
    };

/** A request whose calculation threw. */
export interface SearchFailure {
  readonly id: number;
  readonly kind: "failed";
  readonly error: string;
}

/** What the worker sends back for a request. */
export type SearchReply = SearchResponse | SearchFailure;
