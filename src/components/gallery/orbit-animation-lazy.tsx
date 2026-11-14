"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/shared/spinner";

/**
 * The orbit animation, loaded only in the browser. `ssr: false` keeps the
 * calculation out of the server HTML: the server sends the spinner and the
 * browser renders the orbit.
 */
export const OrbitAnimation = dynamic(
  () => import("@/components/gallery/orbit-animation"),
  {
    ssr: false,
    loading: () => <Spinner label="Calculando la órbita" />,
  },
);
