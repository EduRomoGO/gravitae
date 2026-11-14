// Runs once when the server starts. In development it registers AI SDK
// DevTools, which keeps every call to the model (full prompt with the system
// instructions and tools, output, tool calls, tokens, timing) in
// .devtools/generations.json, viewed with `npm run devtools`. Development
// only, like the request log: it stores the reader's
// text, and the package throws in production.

export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "development"
  ) {
    const { registerTelemetry } = await import("ai");
    const { DevToolsTelemetry } = await import("@ai-sdk/devtools");
    registerTelemetry(DevToolsTelemetry());
  }
}
