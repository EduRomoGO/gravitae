// The search's calculations, off the page's main thread: closing an orbit
// integrates it dozens of times and takes up to a few seconds.

import { replyTo } from "./search-answer";
import type { SearchRequest } from "./search-protocol";

addEventListener("message", (event: MessageEvent<SearchRequest>) => {
  postMessage(replyTo(event.data));
});
