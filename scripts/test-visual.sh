#!/usr/bin/env bash
# Runs the @visual Playwright tests inside the official Playwright image, because
# rendering differs between operating systems and baselines must come from one.
# Pass --update-snapshots to regenerate the baselines.
set -euo pipefail

cd "$(dirname "$0")/.."
version="$(node -p "require('./node_modules/@playwright/test/package.json').version")"

# The anonymous volumes keep the host's macOS binaries out of the Linux container.
docker run --rm \
  -v "$PWD":/work \
  -v /work/node_modules \
  -v /work/.next \
  -w /work \
  "mcr.microsoft.com/playwright:v${version}-noble" \
  bash -c 'npm ci && npx playwright test --grep @visual "$@"' -- "$@"
