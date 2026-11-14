// The tools of the page of every surface of the chat together: the lesson's
// (client-tools.ts) and the orbit finder's (finder-tools.ts). Their names do
// not repeat, so one chat message type, one action line and one check of the
// tool parts serve both surfaces; each route handler offers only its own.

import {
  PAGE_TOOL_NAMES,
  PAGE_TOOL_PART_TYPES,
  actionLine,
  type PageToolPartType,
  type PageToolTypes,
} from "@/lib/atomy/client-tools";
import type { PageToolResult } from "@/lib/atomy/chat-messages";
import {
  FINDER_TOOL_NAMES,
  FINDER_TOOL_PART_TYPES,
  finderActionLine,
  type FinderToolPartType,
  type FinderToolTypes,
} from "@/lib/atomy/finder-tools";

export type SurfaceToolTypes = PageToolTypes & FinderToolTypes;

export type SurfaceToolName = keyof SurfaceToolTypes;

export const SURFACE_TOOL_NAMES: readonly SurfaceToolName[] = [
  ...PAGE_TOOL_NAMES,
  ...FINDER_TOOL_NAMES,
];

/** The type of a tool of the page's part in a message, on any surface. */
export type SurfaceToolPartType = PageToolPartType | FinderToolPartType;

export const SURFACE_TOOL_PART_TYPES: readonly SurfaceToolPartType[] = [
  ...PAGE_TOOL_PART_TYPES,
  ...FINDER_TOOL_PART_TYPES,
];

export function isSurfaceToolPartType(
  type: string,
): type is SurfaceToolPartType {
  return SURFACE_TOOL_PART_TYPES.some((partType) => partType === type);
}

/** How a surface runs each tool of the page; another surface's tools answer with an error. */
export type SurfaceToolRunners = {
  readonly [Name in SurfaceToolName]: (
    input: SurfaceToolTypes[Name]["input"],
  ) => Promise<PageToolResult<SurfaceToolTypes[Name]["output"]>>;
};

/** The line the chat writes for a tool of the page that changed the page. */
export function surfaceActionLine(part: {
  readonly type: string;
  readonly state?: string;
  readonly output?: unknown;
}): string | undefined {
  return actionLine(part) ?? finderActionLine(part);
}

export function isSurfaceToolName(name: string): name is SurfaceToolName {
  return SURFACE_TOOL_NAMES.some((tool) => tool === name);
}

/** The error of a tool that belongs to another surface. */
export function notOnThisPage(
  name: string,
): Promise<{ ok: false; error: string }> {
  return Promise.resolve({
    ok: false,
    error: `The tool "${name}" does not belong to this page.`,
  });
}
