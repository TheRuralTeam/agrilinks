#!/usr/bin/env bash
set -eu

# If Vercel cannot identify the previous commit, build conservatively.
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ] || [ -z "${VERCEL_GIT_COMMIT_SHA:-}" ]; then
  exit 1
fi

if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  exit 1
fi

# Skip Vercel builds for database, Edge Function, template and workflow-only changes.
# Any frontend, dependency or build-configuration change must still build normally.
if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- \
  src public index.html package.json package-lock.json vite.config.ts vercel.json \
  tailwind.config.ts postcss.config.js tsconfig.json tsconfig.strict.json \
  scripts/vercel-ignore-build.sh; then
  echo "Sem alterações no frontend; a compilação da aplicação será ignorada."
  exit 0
fi

exit 1
