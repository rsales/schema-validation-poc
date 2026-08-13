import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import Ajv2020 from 'ajv/dist/2020.js'

import {
  initSync,
  PageValidator,
} from './wasm/page_engine.js'

import {
  loadPage,
  loadSchema,
} from './fixtures'

import { buildJsonSchema } from '../ajv/schema'

const ROOT = resolve(
  import.meta.dirname,
  '..',
)

const WASM_PATH = resolve(
  import.meta.dirname,
  'wasm',
  'page_engine_bg.wasm',
)

const ITERATIONS = 100_000

function measure(
  fn: () => void,
): number {
  const start =
    performance.now()

  fn()

  return (
    performance.now() -
    start
  )
}

function throughput(
  elapsed: number,
): number {
  return (
    ITERATIONS /
    (elapsed / 1000)
  )
}

const schema =
  loadSchema()

const page =
  loadPage()

const pageJson =
  JSON.stringify(page)

const schemaJson =
  JSON.stringify(schema)

/*
 * --------------------------------------------------
 * AJV
 * --------------------------------------------------
 */

const ajv =
  new Ajv2020({
    allErrors: true,
    strict: true,
  })

const jsonSchema =
  buildJsonSchema(schema)

const ajvValidate =
  ajv.compile(jsonSchema)

/*
 * Warm-up
 */
for (let i = 0; i < 10_000; i++) {
  ajvValidate(page)
}

const ajvElapsed =
  measure(() => {
    for (let i = 0; i < ITERATIONS; i++) {
      ajvValidate(page)
    }
  })

/*
 * --------------------------------------------------
 * WASM
 * --------------------------------------------------
 */

const wasm =
  readFileSync(WASM_PATH)

initSync({
  module: wasm,
})

const wasmValidator =
  new PageValidator(
    schemaJson,
  )

/*
 * Warm-up
 */
wasmValidator.validate_many(
  pageJson,
  10_000,
)

const wasmCompiledElapsed =
  measure(() => {
    wasmValidator.validate_many(
      pageJson,
      ITERATIONS,
    )
  })

/*
 * Resident page
 */
const residentPage =
  wasmValidator.load_page(
    pageJson,
  )

wasmValidator.validate_resident_many(
  residentPage,
  10_000,
)

const wasmResidentElapsed =
  measure(() => {
    wasmValidator.validate_resident_many(
      residentPage,
      ITERATIONS,
    )
  })

/*
 * --------------------------------------------------
 * Output
 * --------------------------------------------------
 */

const results = [
  {
    name: 'AJV',
    elapsed: ajvElapsed,
    throughput:
      throughput(ajvElapsed),
  },

  {
    name: 'Rust WASM - compiled',
    elapsed:
      wasmCompiledElapsed,
    throughput:
      throughput(
        wasmCompiledElapsed,
      ),
  },

  {
    name: 'Rust WASM - resident',
    elapsed:
      wasmResidentElapsed,
    throughput:
      throughput(
        wasmResidentElapsed,
      ),
  },
]

console.log('')

console.log(
  'Page Engine - consolidated benchmark',
)

console.log(
  '=====================================',
)

console.log(
  `iterations: ${ITERATIONS}`,
)

console.log('')

console.log(
  'Implementation                total       throughput',
)

console.log(
  '-----------------------------------------------------',
)

for (const result of results) {
  console.log(
    `${result.name.padEnd(30)} ${result.elapsed
      .toFixed(2)
      .padStart(8)} ms   ${result.throughput
      .toFixed(0)
      .padStart(10)} validations/sec`,
  )
}

console.log('')