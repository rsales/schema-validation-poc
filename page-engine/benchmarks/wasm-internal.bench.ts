import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  initSync,
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

function loadJson(path: string): string {
  return readFileSync(
    path,
    'utf8',
  )
}

const schema = loadJson(
  SCHEMA_PATH,
)

const page = loadJson(
  PAGE_PATH,
)

const wasm = readFileSync(
  WASM_PATH,
)

const ITERATIONS = 100_000

initSync({
  module: wasm,
})

const validator =
  new PageValidator(schema)

const start =
  performance.now()

const valid =
  validator.validate_many(
    page,
    ITERATIONS,
  )

const elapsed =
  performance.now() - start

console.log('')

console.log(
  'Rust WASM - internal loop',
)

console.log(
  '--------------------------',
)

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
  `throughput: ${(
    ITERATIONS /
    (elapsed / 1000)
  ).toFixed(0)} validations/sec`,
)

console.log(
  `valid:      ${valid}`,
)