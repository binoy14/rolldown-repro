import {parentPort} from 'node:worker_threads'
import {rolldown} from 'rolldown'

const VIRTUAL = '\0virtual-entry'

async function run() {
  const bundle = await rolldown({
    input: VIRTUAL,
    cwd: process.cwd(),
    logLevel: 'silent',
    plugins: [
      {
        name: 'virtual',
        resolveId(id) {
          if (id === VIRTUAL) return id
          return null
        },
        load(id) {
          if (id === VIRTUAL) {
            return `export const x = 1; export function add(a, b){return a+b}; console.log(add(x, 2));`
          }
          return null
        },
      },
    ],
  })
  await bundle.generate({format: 'esm'})
  await bundle.close()
}

run()
  .then(() => {
    parentPort?.postMessage('done')
  })
  .catch((err) => {
    parentPort?.postMessage({error: String(err?.stack || err)})
  })
