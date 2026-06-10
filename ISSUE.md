# [Bug]: Loading rolldown in a second `worker_thread` segfaults the host process

> Pre-filled to match rolldown's bug report template (.github/ISSUE_TEMPLATE/bug_report.yml).

## Reproduction link or steps

Minimal repo: https://github.com/binoy14/rolldown-repro

```bash
git clone https://github.com/binoy14/rolldown-repro
cd rolldown-repro
npm install
node main.mjs; echo "exit=$?"   # → exit=139 (SIGSEGV); "PASS" never prints
```

Two files:

`worker.mjs`

```js
import {parentPort} from 'node:worker_threads'
import {rolldown} from 'rolldown'
const VIRTUAL = '\0virtual-entry'
const bundle = await rolldown({
  input: VIRTUAL,
  cwd: process.cwd(),
  logLevel: 'silent',
  plugins: [
    {
      name: 'virtual',
      resolveId(id) {
        return id === VIRTUAL ? id : null
      },
      load(id) {
        return id === VIRTUAL ? `export const x = 1; console.log(x)` : null
      },
    },
  ],
})
await bundle.generate({format: 'esm'})
await bundle.close()
parentPort?.postMessage('done')
```

`main.mjs`

```js
import {fileURLToPath} from 'node:url'
import {Worker} from 'node:worker_threads'
const WORKER = fileURLToPath(new URL('./worker.mjs', import.meta.url))
const runOnce = () => new Promise((resolve) => new Worker(WORKER).on('exit', resolve))
await runOnce() // first worker — fine
await runOnce() // second worker — segfaults here
console.log('PASS — did not crash') // never printed
```

## What is expected?

Loading rolldown in a fresh `worker_thread` should succeed regardless of whether a previous worker in the same process already loaded rolldown and exited. `main.mjs` should print `PASS — did not crash` and exit 0.

## What is actually happening?

The host process **segfaults (SIGSEGV, exit code 139)** when the **second** `worker_thread` loads rolldown. The first worker is fine; the crash happens on the second load, after the first worker has exited. `PASS` is never printed.

Scope of the crash (isolated):

- A **single** worker never crashes — only the **2nd** rolldown load in the same process.
- Replacing the `worker_thread` with a `child_process.fork` (separate process) does **not** crash.
- The same harness with `@swc/core` (also Rust + napi + native threads) instead of rolldown does **not** crash — so it is not a generic "native addon in a worker_thread" issue; it is specific to rolldown.
- Reproduces on **rolldown 1.0.3 and 1.1.0**, and on **Node 20, 22, and 24**.
- Deterministic in this minimal form (no concurrency/scale needed).

Downstream impact: Vite 8 bundles rolldown, so tools that run Vite inside worker threads hit this — e.g. test runners (vitest's forks pool) report it as `Worker forks emitted error` / `Worker exited unexpectedly` when a test fork that spawned such a worker dies.

## System Info

```shell
  System:
    OS: macOS 26.5.1
    CPU: (14) arm64 Apple M4 Pro
    Memory: 753.22 MB / 48.00 GB
    Shell: 5.9 - /bin/zsh
  Binaries:
    Node: 24.16.0
    Yarn: 1.22.22
    npm: 11.13.0
    pnpm: 10.28.0
    bun: 1.3.5
  npmPackages:
    rolldown: 1.1.0 => 1.1.0
```

(Also reproduced with `rolldown: 1.0.3`, and on Node 20.20.0 / 22.22.0.)

## Any additional comments?

Possibly relevant (a hint, not a diagnosis): `strings` on the native binary (`@rolldown/binding-darwin-arm64`) contains `thread local panicked on drop, aborting`, `Rayon: detected unexpected panic; aborting`, and the symbols `start_async_runtime` / `shutdown_async_runtime` — suggesting the crash is in native runtime teardown across `worker_thread` lifecycles. I haven't captured a symbolicated backtrace (lldb/Node `--report-on-fatalerror` produced nothing for the raw SIGSEGV here), so I'll leave the root-cause to you.
