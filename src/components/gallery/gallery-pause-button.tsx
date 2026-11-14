"use client";

import { useState, type ReactElement } from "react";
import { useGalleryPaused } from "@/components/gallery/gallery-return";
import { PauseIcon, PlayIcon } from "@/components/shared/icons";
import { FOCUS_RING_CLASS } from "@/components/shared/link-class";

const BUTTON_CLASS = `inline-flex items-center gap-1.5 rounded-lg border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 ${FOCUS_RING_CLASS}`;

/**
 * Pauses and plays every card of the gallery at once (WCAG 2.2.2). The change
 * is announced only when the button is pressed, never on load.
 */
export function GalleryPauseButton(): ReactElement {
  const [paused, setPaused] = useGalleryPaused();
  const [announcement, setAnnouncement] = useState("");

  return (
    <div className="mt-4">
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={() => {
          setPaused(!paused);
          setAnnouncement(paused ? "Reproduciendo" : "En pausa");
        }}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
        {paused ? "Reproducir animaciones" : "Pausar animaciones"}
      </button>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
