import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import init, {
  PageValidator,
  validate_page,
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

const wasmBytes = readFileSync(
  WASM_PATH,
)

const ITERATIONS = 100_000

await init({
  module_or_path: wasmBytes,
})

function benchmark(
  name: string,
  validate: () => void,
) {
  // Warm-up
  for (let i = 0; i < 10_000; i++) {
    validate()
  }

  const start = performance.now()

  for (let i = 0; i < ITERATIONS; i++) {
    validate()
  }

  const elapsed =
    performance.now() - start

  console.log('')
  console.log(name)
  console.log('-'.repeat(name.length))
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
}

// -----------------------------------------------------------------------------
// Rust WASM - baseline
//
// Every validation:
//
//   schema JSON
//        ↓
//   deserialize schema
//        ↓
//   compile schema
//        ↓
//   deserialize page
//        ↓
//   validate
//        ↓
//   serialize result
// -----------------------------------------------------------------------------

benchmark(
  'Rust WASM - baseline',
  () => {
    validate_page(
      schemaJson,
      pageJson,
    )
  },
)

// -----------------------------------------------------------------------------
// Rust WASM - compiled
//
// Schema is compiled once:
//
//   schema JSON
//        ↓
//   deserialize schema
//        ↓
//   compile schema
//        ↓
//   PageValidator
//
// Every validation:
//
//   page JSON
//        ↓
//   deserialize page
//        ↓
//   validate using compiled schema
//        ↓
//   serialize result
// -----------------------------------------------------------------------------

const validator =
  new PageValidator(schemaJson)

benchmark(
  'Rust WASM - compiled',
  () => {
    validator.validate(pageJson)
  },
)