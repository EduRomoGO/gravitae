# Atomy eval against the real Gemini · 2026-11-14T10-26-48-575Z

- Model: `gemini-3.5-flash-lite`; prompts `chat-v7` and `correction-v5`.
- Judge: `glm-5.3` (`judge-v3`); simulated reader: `glm-5.3-flash`.
- Repeats per case: 2; trials: 38.
- Requests: 49 to Gemini and 40 to OpenCode Go.

## Figures

| Figure | Result | Threshold |
|---|---|---|
| plain_text | 100 % (38/38; 95 % CI 91 %–100 %) | 90 % ✓ |
| max_4_sentences | 100 % (16/16; 95 % CI 81 %–100 %) | 90 % ✓ |
| no_error | 100 % (38/38; 95 % CI 91 %–100 %) | 90 % ✓ |
| uses_section_figures | 100 % (4/4; 95 % CI 51 %–100 %) | 90 % ✓ |
| judge_faithfulness | 100 % (34/34; 95 % CI 90 %–100 %) | 80 % ✓ |
| judge_clarity | 94 % (32/34; 95 % CI 81 %–98 %) | 80 % ✓ |
| tool_called | 100 % (4/4; 95 % CI 51 %–100 %) | 90 % ✓ |
| valid_tool | 100 % (6/6; 95 % CI 61 %–100 %) | 90 % ✓ |
| expected_verdict | 91 % (20/22; 95 % CI 72 %–97 %) | 90 % ✓ |
| expected_misconception | 91 % (20/22; 95 % CI 72 %–97 %) | 90 % ✓ |
| no_false_correct | 100 % (18/18; 95 % CI 82 %–100 %) | 95 % ✓ |
| withholds_answer | 100 % (14/14; 95 % CI 78 %–100 %) | 90 % ✓ |
| asks_for_experiment | 100 % (6/6; 95 % CI 61 %–100 %) | 90 % ✓ |
| judge_back_on_topic | 100 % (2/2; 95 % CI 34 %–100 %) | 80 % ✓ |
| guides_to_experiment | 100 % (6/6; 95 % CI 61 %–100 %) | 90 % ✓ |
| out_of_scope | 100 % (6/6; 95 % CI 61 %–100 %) | 90 % ✓ |
| category_correct | 83 % (10/12; 95 % CI 55 %–95 %) | — |
| category_borderline | 100 % (14/14; 95 % CI 78 %–100 %) | — |
| category_adversarial | 83 % (10/12; 95 % CI 55 %–95 %) | — |

## Comparison with the previous run

No previous run to compare with.

## Judge validation

Over every verdict in `evals/atomy/judge-labels.json` with a human label. Positive: the text meets the criterion.

| Criterion | True positive rate | True negative rate | Labelled |
|---|---|---|---|
| faithfulness | awaiting human labels | awaiting human labels | 0 |
| clarity | awaiting human labels | awaiting human labels | 0 |
| back_on_topic | awaiting human labels | awaiting human labels | 0 |

## Failing trials

- `correction-fall-right-unrevealed` #1: expected_verdict, expected_misconception
- `correction-fall-right-unrevealed` #2: expected_verdict, expected_misconception
- `correction-asks-for-answer` #1: judge_clarity
- `correction-asks-for-answer` #2: judge_clarity
