# Test report (2026-10-14 08:53 IDT)
- ⚠️ typecheck (see typecheck.log, not blocking)
- ✅ unit
- ✅ web-build-for-e2e
- 🤖 commit marked [recorded-ai]: real AI answers were already verified for this change; using recorded answers
- ✅ database-and-e2e
- ⏭ ai-real skipped (AI code unchanged since last run)

## Failures
A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them.

## Counts
    ✓ a meeting whose day passed is 'past', a task is not
A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them.
Test Suites: 10 passed, 10 total
Tests:       123 passed, 123 total
Test Suites: 1 passed, 1 total
Tests:       1 skipped, 14 passed, 15 total
  1 passed (7.5s)
