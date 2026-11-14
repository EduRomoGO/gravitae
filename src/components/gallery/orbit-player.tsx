"use client";

import { useEffect, useState, type ReactElement } from "react";
import { LapReadout } from "@/components/gallery/lap-readout";
import { PlaybackControls } from "@/components/gallery/playback-controls";
import { OrbitAnimation } from "@/components/gallery/orbit-animation-lazy";
import {
  usePlaybackClock,
  usePlaybackState,
} from "@/components/gallery/use-playback-clock";
import { getSolution, type SolutionSlug } from "@/lib/orbits/solutions";
import { prefersReducedMotion } from "@/lib/reduced-motion";

/** A catalogue solution's orbit in the detail, with its playback controls. */
export function OrbitPlayer({ slug }: { slug: SolutionSlug }): ReactElement {
  const { period, shape } = getSolution(slug);
  const clock = usePlaybackClock();
  const { playing, speed } = usePlaybackState(clock);
  const [showTrail, setShowTrail] = useState(true);
  const [showOrbit, setShowOrbit] = useState(true);
  // Written only when a playback button is pressed, never on load.
  const [announcement, setAnnouncement] = useState("");

  // The server cannot read the preference, so the clock starts playing and is
  // paused here, before its first frame has advanced it from t = 0. Read once:
  // the preference decides how the detail starts, and from then on only the
  // playback buttons pause and play it.
  useEffect(() => {
    if (prefersReducedMotion()) clock.pause();
  }, [clock]);

  return (
    <>
      {/* From sm on, no taller than 60 % of the screen (4:3 at 80vh wide),
          so the playback controls below stay above the fold on a laptop. */}
      <div className="mx-auto mt-4 aspect-square rounded-2xl border border-slate-200 bg-white sm:aspect-[4/3] sm:max-w-[80vh] dark:border-slate-800 dark:bg-slate-900/70">
        <OrbitAnimation
          slug={slug}
          clock={clock}
          showTrail={showTrail}
          showOrbit={showOrbit}
          label={shape}
        />
      </div>
      <PlaybackControls
        playing={playing}
        speed={speed}
        showTrail={showTrail}
        showOrbit={showOrbit}
        onTogglePlaying={() => {
          if (playing) {
            clock.pause();
            setAnnouncement("En pausa");
          } else {
            clock.play();
            setAnnouncement("Reproduciendo");
          }
        }}
        onRestart={() => {
          clock.restart();
          setAnnouncement("Reiniciado");
        }}
        onSpeedChange={(value) => {
          clock.setSpeed(value);
        }}
        onShowTrailChange={setShowTrail}
        onShowOrbitChange={setShowOrbit}
      />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {/* Outside any live region: its text changes on nearly every frame. */}
      <LapReadout clock={clock} period={period} />
    </>
  );
}
