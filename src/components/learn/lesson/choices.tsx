"use client";

// The answer input of a multiple-choice prediction: one button per option;
// the reader's answer is the option's key, its position. Locked once the answer is
// checked, and while Atomy corrects the reasoning given for it.

import type { ReactElement } from "react";
import { usePrediction } from "@/components/learn/lesson/predict";
import { optionKey } from "@/components/learn/lesson/responses";

export function Choices({
  options,
}: {
  options: readonly string[];
}): ReactElement {
  const { chosen, locked, choose } = usePrediction();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          disabled={locked}
          aria-pressed={optionKey(index) === chosen}
          onClick={() => {
            choose(optionKey(index));
          }}
          className={`rounded-full border px-3 py-1 text-base sm:text-sm ${
            optionKey(index) === chosen
              ? "border-amber-700 bg-amber-700 text-white"
              : "border-slate-500 dark:border-slate-400"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
