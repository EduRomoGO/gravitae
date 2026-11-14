"use client";

import { useId, type ReactElement, type ReactNode } from "react";
import { PauseIcon, PlayIcon, RestartIcon } from "@/components/shared/icons";
import { FOCUS_RING_CLASS } from "@/components/shared/link-class";
import { formatPlaybackSpeed } from "@/lib/format";
import { SPEEDS, type Speed } from "@/lib/orbits/playback-config";

export const BUTTON_CLASS = `inline-flex items-center gap-1.5 rounded-lg border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 aria-pressed:bg-slate-900 aria-pressed:text-white dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 dark:aria-pressed:bg-slate-100 dark:aria-pressed:text-slate-900 ${FOCUS_RING_CLASS}`;
const CHECKBOX_CLASS = `size-4 ${FOCUS_RING_CLASS}`;
const CHECKBOX_LABEL_CLASS = "inline-flex items-center gap-1.5 text-sm";

interface PlaybackControlsProps {
  playing: boolean;
  speed: Speed;
  showTrail: boolean;
  showOrbit: boolean;
  onTogglePlaying: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: Speed) => void;
  onShowTrailChange: (show: boolean) => void;
  onShowOrbitChange: (show: boolean) => void;
}

export function PlaybackControls({
  playing,
  speed,
  showTrail,
  showOrbit,
  onTogglePlaying,
  onRestart,
  onSpeedChange,
  onShowTrailChange,
  onShowOrbitChange,
}: PlaybackControlsProps): ReactElement {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`${BUTTON_CLASS} justify-center`}
          onClick={onTogglePlaying}
        >
          {/* Both states, icon included, share one grid cell, so the button
              keeps the size of the larger one whatever the glyph widths; the
              hidden state stays out of the accessible name. */}
          <span className="inline-grid">
            <PlayButtonFace playing={playing} />
            <PlayButtonFace playing={!playing} hidden />
          </span>
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={onRestart}>
          <RestartIcon />
          Reiniciar
        </button>
      </div>
      <SpeedGroup speed={speed} onSpeedChange={onSpeedChange} />
      <div className="flex items-center gap-4">
        <ToggleCheckbox checked={showTrail} onChange={onShowTrailChange}>
          Estela
        </ToggleCheckbox>
        <ToggleCheckbox checked={showOrbit} onChange={onShowOrbitChange}>
          Órbita completa
        </ToggleCheckbox>
      </div>
    </div>
  );
}

/** The 0,5×, 1× and 2× buttons, with the chosen one pressed. */
export function SpeedGroup({
  speed,
  onSpeedChange,
}: {
  speed: Speed;
  onSpeedChange: (speed: Speed) => void;
}): ReactElement {
  const labelId = useId();
  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-sm">
        Velocidad
      </span>
      <div role="group" aria-labelledby={labelId} className="flex gap-1">
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === speed}
            className={BUTTON_CLASS}
            onClick={() => {
              onSpeedChange(value);
            }}
          >
            {formatPlaybackSpeed(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A checkbox that shows or hides part of the drawing. */
export function ToggleCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}): ReactElement {
  return (
    <label className={CHECKBOX_LABEL_CLASS}>
      <input
        type="checkbox"
        className={CHECKBOX_CLASS}
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {children}
    </label>
  );
}

function PlayButtonFace({
  playing,
  hidden = false,
}: {
  playing: boolean;
  hidden?: boolean;
}): ReactElement {
  return (
    <span
      className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 ${hidden ? "invisible" : ""}`}
      aria-hidden={hidden || undefined}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
      {playing ? "Pausar" : "Reproducir"}
    </span>
  );
}
