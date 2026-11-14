import Link from "next/link";
import type { ComponentProps, ReactElement } from "react";
import { GALLERY_PATH } from "@/lib/routes";

/** Without `scroll={false}`, Next.js leaves the gallery at scroll 0 after it is restored. */
export function GalleryLink(
  props: Omit<ComponentProps<typeof Link>, "href" | "scroll">,
): ReactElement {
  return <Link {...props} href={GALLERY_PATH} scroll={false} />;
}
