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

const ITERATIONS = 100_000

function loadFile(path: string): string {
  return readFileSync(
    path,
    'utf8',
  )
}

const schema =
  loadFile(SCHEMA_PATH)

const pageJson =
  loadFile(PAGE_PATH)

const wasm =
  readFileSync(WASM_PATH)

initSync({
  module: wasm,
})

const validator =
  new PageValidator(schema)

/*
 * Warm-up
 */
const residentPage =
  validator.load_page(pageJson)

validator.validate_resident_many(
  residentPage,
  10_000,
)

/*
 * Load page
 */
const loadStart =
  performance.now()

const page =
  validator.load_page(pageJson)

const loadElapsed =
  performance.now() -
  loadStart

/*
 * Resident validation
 */
const validationStart =
  performance.now()

const valid =
  validator.validate_resident_many(
    page,
    ITERATIONS,
  )

const validationElapsed =
  performance.now() -
  validationStart

const throughput =
  ITERATIONS /
  (validationElapsed / 1000)

console.log('')

console.log(
  'Rust WASM - resident page',
)

console.log(
  '-------------------------',
)

console.log(
  `iterations:            ${ITERATIONS}`,
)

console.log(
  `page load:              ${loadElapsed.toFixed(4)} ms`,
)

console.log(
  `validation:             ${validationElapsed.toFixed(2)} ms`,
)

console.log(
  `avg validation:         ${(validationElapsed / ITERATIONS).toFixed(6)} ms`,
)

console.log(
  `throughput:             ${throughput.toFixed(0)} validations/sec`,
)

console.log(
  `valid:                  ${valid}`,
)