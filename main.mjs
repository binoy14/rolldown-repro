import {fileURLToPath} from 'node:url'
import {Worker} from 'node:worker_threads'

const WORKER = fileURLToPath(new URL('./worker.mjs', import.meta.url))

// Run a worker that loads rolldown, builds, and exits. Wait for its natural exit.
const runOnce = () => new Promise((resolve) => new Worker(WORKER).on('exit', resolve))

await runOnce() // first worker — fine
await runOnce() // second worker — the process segfaults here (SIGSEGV / exit 139)

console.log('PASS — did not crash') // never reached
