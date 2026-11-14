// The page's side of the search: each request goes to the Web Worker and
// comes back as a Promise. A new request while one is running stops the
// running one: the worker is replaced and the old request is answered as
// superseded, so the reader never waits for a seed they have left. A
// calculation that throws, or a worker that fails to load or to read a
// message, answers the running request as failed; the next request starts a
// new worker.

import { lapOf, type Lap } from "./lap";
import type { Closure, Seed, Simulation } from "./search";
import { replyTo } from "./search-answer";
import type { SearchReply, SearchRequest } from "./search-protocol";

export type Outcome<Result> =
  | { readonly kind: "done"; readonly result: Result }
  | { readonly kind: "superseded" }
  | { readonly kind: "failed"; readonly error: string };

/** A closure and, when the orbit closed, its lap, integrated off the page. */
export interface ClosureAnswer {
  readonly closure: Closure;
  readonly lap: Lap | null;
}

export interface Searcher {
  simulate(seed: Seed, maxTime: number): Promise<Outcome<Simulation>>;
  close(seed: Seed, period: number): Promise<Outcome<ClosureAnswer>>;
  /** Stops the running request, if any, and frees the worker. */
  dispose(): void;
}

/** What a request gets back: the worker's reply, or why there is none. */
type Reply =
  | SearchReply
  | { readonly kind: "superseded" }
  | { readonly kind: "failed"; readonly error: string };

type Pending = (reply: Reply) => void;

/** Requests from `send`, one at a time; a new one supersedes the running one. */
function searcherOver(
  send: (request: SearchRequest, reply: Pending) => void,
  stop: () => void,
): Searcher {
  let nextId = 0;
  let pending: { id: number; reply: Pending } | null = null;

  function request(make: (id: number) => SearchRequest): Promise<Reply> {
    if (pending) {
      stop();
      pending.reply({ kind: "superseded" });
      pending = null;
    }
    nextId += 1;
    const id = nextId;
    return new Promise((resolve) => {
      pending = { id, reply: resolve };
      send(make(id), (response) => {
        if (pending?.id !== id) return;
        pending = null;
        resolve(response);
      });
    });
  }

  return {
    simulate: async (seed, maxTime) => {
      const reply = await request((id) => ({
        id,
        kind: "simulate",
        seed,
        maxTime,
      }));
      if (reply.kind === "simulate")
        return { kind: "done", result: reply.result };
      return reply.kind === "failed"
        ? { kind: "failed", error: reply.error }
        : { kind: "superseded" };
    },
    close: async (seed, period) => {
      const reply = await request((id) => ({
        id,
        kind: "close",
        seed,
        period,
      }));
      if (reply.kind === "close")
        return {
          kind: "done",
          result: {
            closure: reply.result,
            lap: reply.lap && lapOf(reply.lap),
          },
        };
      return reply.kind === "failed"
        ? { kind: "failed", error: reply.error }
        : { kind: "superseded" };
    },
    dispose: () => {
      pending?.reply({ kind: "superseded" });
      pending = null;
      stop();
    },
  };
}

/** What the searcher uses of a Worker. */
export type SearchWorker = Pick<
  Worker,
  "addEventListener" | "postMessage" | "terminate"
>;

/**
 * The searcher of the page: a Web Worker, created on the first request.
 * `create` is the Worker's constructor, replaced in the tests.
 */
export function workerSearcher(
  create: () => SearchWorker = () =>
    new Worker(new URL("./search.worker.ts", import.meta.url), {
      type: "module",
    }),
): Searcher {
  let worker: SearchWorker | null = null;
  let reply: Pending | null = null;
  const stop = () => {
    worker?.terminate();
    worker = null;
    reply = null;
  };
  // The worker may be broken (its script did not load): the next request
  // starts a new one.
  const fail = (error: string) => {
    const failed = reply;
    stop();
    failed?.({ kind: "failed", error });
  };
  const start = (): SearchWorker => {
    const created = create();
    created.addEventListener("message", (event: MessageEvent<SearchReply>) => {
      reply?.(event.data);
    });
    created.addEventListener("error", (event) => {
      event.preventDefault();
      fail(event.message || "The search's worker failed.");
    });
    created.addEventListener("messageerror", () => {
      fail("The search's worker sent a message that could not be read.");
    });
    return created;
  };
  return searcherOver((request, onReply) => {
    worker ??= start();
    reply = onReply;
    worker.postMessage(request);
  }, stop);
}

/**
 * A searcher that calculates on the calling thread, after a macrotask so it
 * still answers asynchronously. For the tests, where there is no Worker.
 */
export function inlineSearcher(): Searcher {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return searcherOver(
    (request, reply) => {
      timer = setTimeout(() => {
        reply(replyTo(request));
      }, 0);
    },
    () => {
      clearTimeout(timer);
    },
  );
}
