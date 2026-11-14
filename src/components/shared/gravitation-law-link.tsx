import Link from "next/link";
import type { ComponentProps, ReactElement } from "react";
import { LESSON_PATH } from "@/lib/routes";

export function GravitationLawLink(
  props: Omit<ComponentProps<typeof Link>, "href">,
): ReactElement {
  return <Link {...props} href={LESSON_PATH} />;
}
