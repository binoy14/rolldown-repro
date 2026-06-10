# rolldown `worker_thread` teardown segfault

Loading rolldown in a Node `worker_thread`, letting it exit, then loading rolldown in a **second** `worker_thread` in the same process **segfaults the host** (SIGSEGV / exit 139). A single worker is fine; the crash appears on the 2nd. It's deterministic in this minimal form.

## Reproduce

```bash
npm install
node main.mjs; echo "exit=$?"   # → exit=139 (SIGSEGV); "PASS" never prints
```

- `worker.mjs` — loads rolldown, runs a trivial in-memory build, closes, exits.
- `main.mjs` — spawns the worker twice, sequentially, awaiting each one's natural exit.

## Environment

- rolldown **1.1.0** (latest; what this repro pins) and **1.0.3** — both crash
- Node **20, 22, 24** — all crash
- macOS, darwin-arm64

## What I've isolated

- **One** worker never crashes; the crash needs a **second** rolldown load in the same process after the first worker has exited.
- Replacing the `worker_thread` with a `child_process` (separate process) does **not** crash.
- The same harness with `@swc/core` (also Rust + napi + native threads) instead of rolldown does **not** crash — so it's not a generic "native addon in a worker_thread" problem; it's specific to rolldown.

## Hint (not a diagnosis)

`strings` on the native binary (`@rolldown/binding-darwin-arm64`) contains `thread local panicked on drop, aborting`, `Rayon: detected unexpected panic; aborting`, and the symbols `start_async_runtime` / `shutdown_async_runtime` — which points at native runtime teardown across `worker_thread` lifecycles. No symbolicated backtrace captured, so the root-cause is left to the maintainers.
