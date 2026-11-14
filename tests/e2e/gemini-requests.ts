import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";
import { FAKE_GEMINI_ORIGIN } from "./ports";

// The generation requests the fake Gemini (e2e/fake-gemini.mts) received.
// Only the fields the specs read; the rest of each body passes through.
const GeminiPart = z.looseObject({
  text: z.string().optional(),
  functionResponse: z.looseObject({ name: z.string() }).optional(),
});

const GeminiRequest = z.looseObject({
  contents: z.array(
    z.looseObject({ role: z.string(), parts: z.array(GeminiPart) }),
  ),
  systemInstruction: z.looseObject({ parts: z.array(GeminiPart) }).optional(),
  tools: z
    .array(
      z.looseObject({
        functionDeclarations: z
          .array(z.looseObject({ name: z.string() }))
          .optional(),
      }),
    )
    .optional(),
});
export type GeminiRequest = z.infer<typeof GeminiRequest>;

/** Every request the fake Gemini received, in order. */
export async function geminiRequests(
  request: APIRequestContext,
): Promise<GeminiRequest[]> {
  const response = await request.get(`${FAKE_GEMINI_ORIGIN}/__requests`);
  return z.array(GeminiRequest).parse(await response.json());
}
