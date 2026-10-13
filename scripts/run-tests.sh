#!/usr/bin/env bash
# Runs every test suite, keeps going after a failure so the report shows everything,
# writes report/summary.md and exits non-zero if anything failed.
set -u -o pipefail
mkdir -p report
SUMMARY=report/summary.md
echo "# Test report ($(date '+%Y-%m-%d %H:%M %Z'))" > $SUMMARY
FAILED=0

run() {
  local name="$1"; shift
  echo "::group::$name"
  "$@" 2>&1 | tee "report/$name.log"
  local code=${PIPESTATUS[0]}
  echo "::endgroup::"
  if [ $code -eq 0 ]; then echo "- ✅ $name" >> $SUMMARY; else echo "- ❌ $name (exit $code)" >> $SUMMARY; FAILED=1; fi
}

# Type check is informational only.
npx tsc --noEmit > report/typecheck.log 2>&1 && echo "- ✅ typecheck" >> $SUMMARY || echo "- ⚠️ typecheck (see typecheck.log, not blocking)" >> $SUMMARY

run unit npx jest -c jest.config.js --ci --forceExit

run web-build-for-e2e env EXPO_PUBLIC_FIRESTORE_EMULATOR=127.0.0.1:8080 BASE_URL= npx expo export -p web --output-dir dist-e2e

# Real AI calls only when the AI code or its tests changed (the free tier allows ~20 reads a day per model).
if git log -1 --format=%B | grep -q "\[recorded-ai\]"; then
  export REAL_AI=0
  echo "- 🤖 commit marked [recorded-ai]: real AI answers were already verified for this change; using recorded answers" >> $SUMMARY
elif [ "${FORCE_REAL_AI:-}" = "1" ] || git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -qE "^(src/ai\.ts|src/config\.ts|tests/ai/|tests/fixtures/)"; then
  export REAL_AI=1
  echo "- 🤖 real AI used in this run" >> $SUMMARY
else
  export REAL_AI=0
  echo "- 🤖 AI code unchanged: end-to-end test uses recorded AI answers" >> $SUMMARY
fi

run database-and-e2e env EXPO_PUBLIC_FIRESTORE_EMULATOR=127.0.0.1:8080 npx firebase emulators:exec --only firestore --project demo-family \
  "npx jest -c jest.integration.config.js --ci --forceExit; a=\$?; npx playwright test -c tests/e2e/playwright.config.ts; b=\$?; exit \$((a || b))"

if [ "$REAL_AI" = "1" ]; then
  sleep 30  # space out requests after the end-to-end test
  run ai-real npx jest -c jest.ai.config.js --ci --forceExit
else
  echo "- ⏭ ai-real skipped (AI code unchanged since last run)" >> $SUMMARY
fi

# Pull out the lines that matter for a quick read.
{
  echo; echo "## Failures";
  grep -hE "✕|●.*›|Error:|expect\(|Received|Expected|FAIL |failed|Timed out" report/unit.log report/database-and-e2e.log report/ai-real.log 2>/dev/null | head -150
  echo; echo "## Counts"
  grep -hE "^Tests:|^Test Suites:|passed|failed" report/unit.log report/database-and-e2e.log report/ai-real.log 2>/dev/null | head -20
} >> $SUMMARY

cp tests/ai/ai-results.json report/ 2>/dev/null || true
cp -r tests/e2e/shots report/ 2>/dev/null || true
find tests/e2e/results -name "*.png" -exec cp {} report/ \; 2>/dev/null || true

exit $FAILED
