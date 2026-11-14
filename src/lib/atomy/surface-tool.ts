// The constructor shared by the tools of the page of every surface: the
// lesson's (client-tools.ts) and the orbit finder's (finder-tools.ts). Each
// tool declares its schemas once, here they become the AI SDK's declaration
// the model reads and the schemas the page and the server check with, so the
// two cannot diverge.

import type { z } from "zod";
import type { PageToolResult } from "@/lib/atomy/chat-messages";

/** One tool of a surface's page, with everything the chat and the server need of it. */
export interface SurfaceToolSpec<
  Page,
  Input,
  Output,
  Result extends PageToolResult<Output> | Promise<PageToolResult<Output>>,
> {
  /** What the model reads of the tool. */
  readonly description: string;
  readonly inputSchema: z.ZodType<Input>;
  readonly outputSchema: z.ZodType<Output>;
  /** Runs the call on the page: its output, or what the page is left doing. */
  readonly run: (page: Page, input: Input) => Result;
  /** The line the chat writes for an output that changed the page. */
  readonly actionLine?: (output: Output) => string;
}

/** A tool of a surface's page as surfaceTool builds it. */
export type SurfaceTool<
  Page,
  Input,
  Output,
  Result extends PageToolResult<Output> | Promise<PageToolResult<Output>>,
> = {
  /**
   * The AI SDK's declaration, without `execute`: what the server hands to
   * the model. The AI SDK only reads these fields.
   */
  readonly description: string;
  readonly inputSchema: z.ZodType<Input>;
  readonly outputSchema: z.ZodType<Output>;
  /** The declaration's schemas, which the page and the server check with. */
  readonly schemas: {
    readonly input: z.ZodType<Input>;
    readonly output: z.ZodType<Output>;
  };
  readonly run: (page: Page, input: Input) => Result;
  /** The action line for an output as the chat holds it, unchecked. */
  readonly lineOf: (output: unknown) => string | undefined;
};

/**
 * The tool built from its spec. The declaration is the object tool() of the
 * AI SDK would return (an identity), written out because tool() cannot type
 * generic schemas: its output overload is a conditional type on Output.
 */
export function surfaceTool<
  Page,
  Input,
  Output,
  Result extends PageToolResult<Output> | Promise<PageToolResult<Output>>,
>({
  description,
  inputSchema,
  outputSchema,
  run,
  actionLine,
}: SurfaceToolSpec<Page, Input, Output, Result>): SurfaceTool<
  Page,
  Input,
  Output,
  Result
> {
  return {
    description,
    inputSchema,
    outputSchema,
    schemas: { input: inputSchema, output: outputSchema },
    run,
    lineOf: (output) => {
      const parsed = outputSchema.safeParse(output);
      return parsed.success ? actionLine?.(parsed.data) : undefined;
    },
  };
}

/** A part of Atomy's answer, as far as the action lines need it. */
export interface ToolPart {
  readonly type: string;
  readonly state?: string;
  readonly output?: unknown;
}

/**
 * The line the chat writes for a part of one of `names`' tools that changed
 * the page; undefined for any other part.
 */
export function actionLineOf<Name extends string>(
  tools: {
    readonly [Key in Name]: {
      readonly lineOf: (output: unknown) => string | undefined;
    };
  },
  names: readonly Name[],
): (part: ToolPart) => string | undefined {
  return (part) => {
    if (part.state !== "output-available") return undefined;
    const name = names.find((tool) => `tool-${tool}` === part.type);
    return name === undefined ? undefined : tools[name].lineOf(part.output);
  };
}
