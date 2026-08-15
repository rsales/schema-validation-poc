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

initSync({
  module: wasm,
})

const validator =
  new PageValidator(schema)

/*
 * Warm-up
 */
validator.parse_page(page)

validator.validate_many(
  page,
  10_000,
)

validator.validate_and_serialize_many(
  page,
  10_000,
)

/*
 * Parse
 */
const parseStart =
  performance.now()

validator.parse_page(page)

const parseElapsed =
  performance.now() -
  parseStart

/*
 * Validation
 */
const validationStart =
  performance.now()

const valid =
  validator.validate_many(
    page,
    ITERATIONS,
  )

const validationElapsed =
  performance.now() -
  validationStart

/*
 * Validation + serialization
 */
const fullStart =
  performance.now()

const serializedBytes =
  validator.validate_and_serialize_many(
    page,
    ITERATIONS,
  )

const fullElapsed =
  performance.now() -
  fullStart

/*
 * Derived serialization cost
 */
const serializationElapsed =
  fullElapsed -
  validationElapsed

const validationThroughput =
  ITERATIONS /
  (validationElapsed / 1000)

const fullThroughput =
  ITERATIONS /
  (fullElapsed / 1000)

console.log('')

console.log(
  'Rust WASM - stages',
)

console.log(
  '------------------',
)

console.log(
  `iterations:                 ${ITERATIONS}`,
)

console.log(
  `parse:                      ${parseElapsed.toFixed(4)} ms`,
)

console.log(
  `validation:                 ${validationElapsed.toFixed(2)} ms`,
)

console.log(
  `validation + serialization: ${fullElapsed.toFixed(2)} ms`,
)

console.log(
  `serialization:              ${serializationElapsed.toFixed(2)} ms`,
)

console.log(
  `serialized bytes:           ${serializedBytes}`,
)

console.log(
  `validation throughput:      ${validationThroughput.toFixed(0)} validations/sec`,
)

console.log(
  `full throughput:            ${fullThroughput.toFixed(0)} validations/sec`,
)

console.log(
  `valid:                      ${valid}`,
)