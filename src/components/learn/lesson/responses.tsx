// How the reader answers a prediction: the input they answer with, the
// answers it can give and the right one. Each answer has a key, which the
// input reports and the progress keeps, and the words the reader and the
// model read; a saved key the current answers lack counts as no answer. A
// plain module, so the lesson's server page builds them.

import type { ReactNode } from "react";
import { Choices } from "@/components/learn/lesson/choices";

export interface PredictionResponse {
  /** The words of each answer the input can give, by key. */
  answers: Readonly<Record<string, string>>;
  /** The key of the right answer. */
  answer: string;
  /** Where the reader answers; it reports a key through usePrediction. */
  input: ReactNode;
}

/** The key of option `index` of a multiple-choice prediction. */
export function optionKey(index: number): string {
  return String(index);
}

/** Pick one of `options`; the right one is `options[answer]`. */
export function choices(
  options: readonly string[],
  answer: number,
): PredictionResponse {
  if (options[answer] === undefined)
    throw new Error(`No option ${String(answer)} among ${options.join(", ")}.`);
  return {
    answers: Object.fromEntries(
      options.map((option, index) => [optionKey(index), option]),
    ),
    answer: optionKey(answer),
    input: <Choices options={options} />,
  };
}

/** An order of items as the reader's answer: its key and its words. */
export function orderKey(items: readonly string[]): string {
  return items.join(", ");
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, other) => other !== index)).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

/** Order every one of `items`; the right order is `right`. */
export function ranking(
  items: readonly string[],
  right: readonly string[],
  input: ReactNode,
): PredictionResponse {
  const orders = permutations(items).map(orderKey);
  const answer = orderKey(right);
  if (!orders.includes(answer))
    throw new Error(`${answer} is no order of ${items.join(", ")}.`);
  return {
    answers: Object.fromEntries(orders.map((order) => [order, order])),
    answer,
    input,
  };
}
