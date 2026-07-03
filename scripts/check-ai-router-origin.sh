#!/usr/bin/env bash
# CI guardrail: every edge function that calls the AI router MUST also
# establish request origin (via `buildRouterContext` from an inbound Request,
# `withRequestOrigin` / `withOrigin` around Deno.serve, or explicitly
# `withExplicitOrigin(undefined, ...)` for crons/background jobs).
#
# Without an established origin, `ai_usage_log.is_dev_call` cannot be
# auto-tagged and preview traffic pollutes production spend dashboards.
#
# Exits non-zero if any file calls `completeWithFallback(` or
# `streamWithFallback(` without importing one of the origin helpers.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

# Check 1: every edge function with `Deno.serve` must wire the request
# origin so `is_dev_call` auto-tagging works uniformly across the app.
while IFS= read -r file; do
  case "$file" in
    supabase/functions/_shared/*) continue ;;
    *__tests__*) continue ;;
  esac
  if ! grep -qE "withRequestOrigin|withOrigin\b|withExplicitOrigin" "$file"; then
    echo "FAIL: $file uses Deno.serve without withRequestOrigin/withOrigin."
    echo "      Wrap the handler: Deno.serve((req) => withRequestOrigin(req, () => handler(req)))"
    FAIL=1
  fi
done < <(grep -rlE "Deno\.serve\(" supabase/functions 2>/dev/null || true)

# Check 2: AI-router callers must additionally establish origin (redundant
# guard for shared helpers or non-Deno.serve entry points).
while IFS= read -r file; do
  # Skip shared helpers (they inherit origin from their callers via
  # AsyncLocalStorage — the callers are the ones checked here) and tests.
  case "$file" in
    supabase/functions/_shared/*) continue ;;
    *__tests__*) continue ;;
  esac

  if ! grep -qE "buildRouterContext|withRequestOrigin|withExplicitOrigin|withOrigin\b" "$file"; then
    echo "FAIL: $file calls the AI router but does not establish request origin."
    echo "      Add one of: buildRouterContext(base, req), withOrigin(handler),"
    echo "                  withRequestOrigin(req, fn), or withExplicitOrigin(undefined, fn)."
    FAIL=1
  fi
done < <(grep -rlE "completeWithFallback\(|streamWithFallback\(" supabase/functions 2>/dev/null || true)

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "AI router origin check failed. See CONFIG_CHANGES.md → 'Dev-call auto-tagging'."
  exit 1
fi

echo "OK: all AI-router callers establish request origin."