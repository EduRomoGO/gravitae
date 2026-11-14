#!/usr/bin/env bash
# Runs the checks a branch must pass, in parallel: typecheck, lint and unit.
# e2e runs locally on demand only: with --full, or when named as a step.
#
# Locally, without --full, lint and unit cover only the files changed against
# the base branch (origin/main, else main): those committed on the branch since
# it forked, plus staged, modified and untracked ones. With nothing changed (a
# fresh clone of main) they cover every file. unit uses vitest's
# --changed, which also runs the tests that import a changed file and every
# test when a config file changes; lint runs eslint on the changed files, and
# on every file when eslint.config.mjs, package.json or package-lock.json
# changes. typecheck always covers the whole project, since a change in one
# file can break the types of another. CI and --full run everything.
# The same script runs locally (`npm run check`) and in CI (one step per job,
# e2e included on every pull request).
#
# Locally it gives way to the rest of the machine: e2e named alone runs only
# Chromium (--full runs every browser), the tests use 2 workers, one check runs
# at a time across every checkout and the rest wait (with macOS's lockf), and
# every step runs at low priority (on macOS's efficiency cores, with
# taskpolicy). Where lockf or taskpolicy are missing, the checks run without
# them. In CI it runs every browser at full speed.
#
# Usage: scripts/ci.sh [--full] [step...]
#   steps: typecheck lint unit e2e (default: typecheck lint unit)
#   --full  runs lint and unit on every file and adds e2e to the default steps,
#           in every browser (still at low priority)
#
# Each step's full output goes to .ci/<step>.log. A step's result is printed
# as soon as it finishes; the exit code is non-zero if any step fails.
#
# Written for macOS's bash 3.2: no associative arrays, no `wait -n`.
set -uo pipefail

cd "$(dirname "$0")/.."

# A second check waits for the lock instead of competing for the CPU.
if [ -z "${CI:-}" ] && [ -z "${CHECK_THROTTLED:-}" ] && command -v lockf >/dev/null; then
  lock="${TMPDIR:-/tmp}/gravitae-check.lock"
  lockf -s -t 0 "$lock" true || echo "· waiting for another check to finish"
  export CHECK_THROTTLED=1
  exec lockf -k "$lock" scripts/ci.sh "$@"
fi

# `taskpolicy -b` makes macOS run a step, and every process it starts, on the
# efficiency cores with throttled disk I/O. e2e only gets `nice`: on the
# efficiency cores the animation-timing tests (tests/e2e/atomy-chat-states.spec.ts)
# fail, because the page advances its animations between two of the test's reads.
full="" requested=""
for arg in "$@"; do
  if [ "$arg" = --full ]; then full=1; else requested="$requested $arg"; fi
done

background="" low="" unit_args="" e2e_args=""
if [ -z "${CI:-}" ]; then
  if command -v taskpolicy >/dev/null; then background="taskpolicy -b"; fi
  low="nice -n 10"
  unit_args="--maxWorkers=2"
  e2e_args="--workers=2"
  [ -n "$full" ] || e2e_args="--project=chromium $e2e_args"
fi

# The base the changed files are measured against; empty means every file.
base=""
if [ -z "${CI:-}" ] && [ -z "$full" ]; then
  for candidate in origin/main main; do
    if git rev-parse --verify -q "$candidate" >/dev/null; then base=$candidate; break; fi
  done
  # Nothing changed against the base: every file is checked.
  if [ -n "$base" ] && [ "$(git rev-parse HEAD)" = "$(git rev-parse "$base")" ] &&
    [ -z "$(git status --porcelain)" ]; then
    base=""
  fi
  [ -z "$base" ] || unit_args="$unit_args --changed=$base"
fi

all_steps="typecheck lint unit e2e"
default_steps="typecheck lint unit"
[ -n "$full" ] && default_steps="$all_steps"
steps="${requested# }"
steps="${steps:-$default_steps}"
for step in $steps; do
  case " $all_steps " in
    *" $step "*) ;;
    *) echo "Unknown step: $step (valid: $all_steps)" >&2; exit 2 ;;
  esac
done

has_step() { case " $steps " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

log_dir=.ci
rm -rf "$log_dir"
mkdir -p "$log_dir"
export FORCE_COLOR=0 NO_COLOR=1

# npm ci wipes node_modules, so it only runs when the lockfile is newer than the
# installed tree (a fresh worktree, a branch switch, a dependency change).
if [ ! -f node_modules/.package-lock.json ] ||
  [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "· install: npm ci"
  if ! npm ci >"$log_dir/install.log" 2>&1; then
    echo "✗ install failed; see $log_dir/install.log"
    tail -n 40 "$log_dir/install.log"
    exit 1
  fi
fi

# typecheck and lint call tsc and eslint directly, not their npm scripts: those
# run `next typegen` first, and the types are generated once below instead.
run_command_for() {
  case "$1" in
    typecheck) $background npx tsc --noEmit ;;
    lint) lint ;;
    unit) $background npm run test -- $unit_args ;;
    e2e) $low npm run test:e2e -- $e2e_args ;;
  esac
}

# The files vitest's --changed reads: committed since the fork, staged,
# modified and untracked.
changed_files() {
  {
    git diff --name-only -z "$base...HEAD"
    git diff --cached --name-only -z
    git ls-files -z --other --modified --exclude-standard
  } | tr '\0' '\n' | sort -u
}

lint() {
  [ -n "$base" ] || { $background npx eslint; return; }
  local files=$log_dir/lint-files
  changed_files >"$files.all"
  if grep -qxE 'eslint\.config\.mjs|package(-lock)?\.json' "$files.all"; then
    echo "lint config changed: linting every file"
    $background npx eslint
    return
  fi
  grep -E '\.(c|m)?(j|t)sx?$' "$files.all" | while IFS= read -r f; do
    [ -f "$f" ] && echo "$f"
  done >"$files"
  if [ ! -s "$files" ]; then
    echo "no changed files to lint"
    return 0
  fi
  tr '\n' '\0' <"$files" | $background xargs -0 npx eslint --no-warn-ignored
}

# The line of the log worth showing on success.
summary_of() {
  case "$1" in
    lint)
      [ -n "$base" ] || return 0
      if grep -q '^lint config changed' "$log_dir/lint.log"; then echo "every file (config changed)"
      else echo "$(wc -l <"$log_dir/lint-files" | tr -d ' ') changed files"; fi
      ;;
    unit)
      if grep -q '^No affected test files found' "$log_dir/$1.log"; then echo "no affected tests"
      else grep -E '^ *Tests ' "$log_dir/$1.log" | tail -n 1 | sed -E 's/^ +//'; fi
      ;;
    e2e) grep -E '^ +[0-9]+ (passed|flaky|skipped)' "$log_dir/$1.log" | sed -E 's/^ +//' | paste -sd ',' - ;;
  esac
}

run_step() {
  local step=$1 start=$SECONDS code
  run_command_for "$step" >"$log_dir/$step.log" 2>&1
  code=$?
  local took=$((SECONDS - start))
  echo "$code" >"$log_dir/$step.status"
  if [ "$code" -eq 0 ]; then
    printf '✓ %-9s %4ss  %s\n' "$step" "$took" "$(summary_of "$step")"
  else
    printf '✗ %-9s %4ss  see %s\n' "$step" "$took" "$log_dir/$step.log"
  fi
}

started=$SECONDS

# tsc and eslint read .next/types, and `next typegen` and `next build` rewrite
# it without an atomic write, so a step reading it while another writes it can
# see a truncated file. The types are generated once, before any step reads them.
if has_step typecheck || has_step lint; then
  if ! npx next typegen >"$log_dir/typegen.log" 2>&1; then
    echo "✗ typegen failed; see $log_dir/typegen.log"
    tail -n 40 "$log_dir/typegen.log"
    exit 1
  fi
fi

echo "· running: $steps"

readers=""
for step in $steps; do
  [ "$step" = e2e ] && continue
  run_step "$step" &
  case "$step" in typecheck | lint) readers="$readers $!" ;; esac
done

# `next build` (e2e) rewrites .next/types, so e2e starts after typecheck and lint
# have read it. A type error also fails the build, so e2e is skipped when
# typecheck fails.
if has_step e2e; then
  for pid in $readers; do wait "$pid"; done
  if has_step typecheck && [ "$(cat "$log_dir/typecheck.status")" != 0 ]; then
    echo "skipped: typecheck failed" >"$log_dir/e2e.log"
    echo 1 >"$log_dir/e2e.status"
    echo "✗ e2e          skipped: typecheck failed"
  else
    run_step e2e &
  fi
fi
wait

failed=""
for step in $steps; do
  [ "$(cat "$log_dir/$step.status")" = 0 ] || failed="$failed $step"
done

echo "· total $((SECONDS - started))s"
[ -z "$failed" ] && exit 0

# CI shows the whole log, since there is no file to open afterwards.
for step in $failed; do
  echo
  echo "── $step ──────────────────────────────────────────"
  if [ -n "${CI:-}" ]; then cat "$log_dir/$step.log"; else tail -n 40 "$log_dir/$step.log"; fi
done
exit 1
