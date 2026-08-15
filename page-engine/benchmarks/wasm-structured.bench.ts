import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import init, {
  PageValidator,
} from '../wasm/page_engine.js'

const ROOT = resolve(
  import.meta.dirname,
  '..',
)

const SCHEMA_PATH = resolve(
  ROOT,
  'schema',
  'component-schema.json',
)

const PAGE_PATH = resolve(
  ROOT,
  'fixtures',
  'page-small.json',
)

const WASM_PATH = resolve(
  import.meta.dirname,
  '..',
  'wasm',
  'page_engine_bg.wasm',
)

const schemaJson = readFileSync(
  SCHEMA_PATH,
  'utf8',
)

const pageJson = readFileSync(
  PAGE_PATH,
  'utf8',
)

const page = JSON.parse(pageJson)

const wasmBytes = readFileSync(
  WASM_PATH,
)

const ITERATIONS = 100_000

await init({
  module_or_path: wasmBytes,
})

const validator =
  new PageValidator(schemaJson)

// Warm-up
for (let i = 0; i < 10_000; i++) {
  validator.validate_data(page)
}

const start = performance.now()

for (let i = 0; i < ITERATIONS; i++) {
  validator.validate_data(page)
}

const elapsed =
  performance.now() - start

console.log('')
console.log('Rust WASM - compiled + structured')
console.log('----------------------------------')
console.log(
  `iterations: ${ITERATIONS}`,
)
console.log(
  `total:      ${elapsed.toFixed(2)} ms`,
)
console.log(
  `avg:        ${(elapsed / ITERATIONS).toFixed(6)} ms`,
)
console.log(
  `throughput: ${(ITERATIONS / (elapsed / 1000)).toFixed(0)} validations/sec`,
)