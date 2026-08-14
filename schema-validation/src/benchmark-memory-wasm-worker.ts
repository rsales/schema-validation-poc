import fs from 'node:fs'
import path from 'node:path'

import {
  getMemorySnapshot,
  getPeakMemory,
  type MemoryResult
} from './benchmark-memory-metrics.js'

const [
  ,
  ,
  fixtureName,
  fixtureFile,
  iterationsArg,
  runsArg
] = process.argv

if (
  !fixtureName ||
  !fixtureFile ||
  !iterationsArg ||
  !runsArg
) {
  throw new Error(
    'Usage: benchmark-memory-wasm-worker.ts <name> <fixture> <iterations> <runs>'
  )
}

const iterations =
  Number(iterationsArg)

const runs =
  Number(runsArg)

function getFixturePath(): string {
  return path.resolve(
    process.cwd(),
    'fixtures',
    fixtureFile
  )
}

console.error(
  `      Fixture: ${fixtureName}`
)

console.error(
  `      Iterations: ${iterations.toLocaleString()}`
)

console.error(
  `      Runs: ${runs.toLocaleString()}`
)

console.error()

// ─────────────────────────────────────────────
// Baseline
// ─────────────────────────────────────────────

const baseline =
  getMemorySnapshot()

console.error(
  `      Baseline RSS: ${baseline.rssMb.toFixed(2)} MB`
)

// ─────────────────────────────────────────────
// Validator initialization
// ─────────────────────────────────────────────

console.error(
  '      Loading WASM validator...'
)

const [
  wasmModule,
  schemaModule
] = await Promise.all([
  import(
    '../rust/pkg/schema_validator.js'
  ),

  import(
    '../schema/page.schema.json',
    {
      with: {
        type: 'json'
      }
    }
  )
])

const {
  init_validator,
  init_page,
  validate_cached
} = wasmModule

const schemaJson =
  JSON.stringify(
    schemaModule.default
  )

init_validator(
  schemaJson
)

const afterValidator =
  getMemorySnapshot()

console.error(
  `      After validator RSS: ${afterValidator.rssMb.toFixed(2)} MB`
)

// ─────────────────────────────────────────────
// Fixture initialization
// ─────────────────────────────────────────────

console.error(
  '      Loading fixture...'
)

const fixturePath =
  getFixturePath()

const json =
  fs.readFileSync(
    fixturePath,
    'utf8'
  )

init_page(
  json
)

const afterFixture =
  getMemorySnapshot()

console.error(
  `      After fixture RSS: ${afterFixture.rssMb.toFixed(2)} MB`
)

// ─────────────────────────────────────────────
// Warmup
// ─────────────────────────────────────────────

const warmupIterations =
  Math.min(
    10_000,
    iterations
  )

console.error(
  `      Warmup: ${warmupIterations.toLocaleString()}`
)

for (
  let i = 0;
  i < warmupIterations;
  i++
) {
  validate_cached()
}

const afterWarmup =
  getMemorySnapshot()

console.error(
  `      After warmup RSS: ${afterWarmup.rssMb.toFixed(2)} MB`
)

// ─────────────────────────────────────────────
// Benchmark
// ─────────────────────────────────────────────

let peak =
  afterWarmup

for (
  let run = 0;
  run < runs;
  run++
) {
  for (
    let i = 0;
    i < iterations;
    i++
  ) {
    validate_cached()
  }

  const memory =
    getMemorySnapshot()

  peak =
    getPeakMemory(
      memory,
      peak
    )

  console.error(
    `      Run ${run + 1}/${runs}: RSS ${memory.rssMb.toFixed(2)} MB`
  )
}

// ─────────────────────────────────────────────
// Final
// ─────────────────────────────────────────────

const final =
  getMemorySnapshot()

console.error()

console.error(
  `      Peak RSS: ${peak.rssMb.toFixed(2)} MB`
)

console.error(
  `      Final RSS: ${final.rssMb.toFixed(2)} MB`
)

// ─────────────────────────────────────────────
// Result
// ─────────────────────────────────────────────

const result: MemoryResult = {
  name: fixtureName,
  fixture: fixtureFile,
  iterations,
  runs,

  baseline,
  afterValidator,
  afterFixture,
  afterWarmup,
  peak,
  final,

  validatorDeltaMb:
    afterValidator.rssMb -
    baseline.rssMb,

  fixtureDeltaMb:
    afterFixture.rssMb -
    afterValidator.rssMb,

  warmupDeltaMb:
    afterWarmup.rssMb -
    afterFixture.rssMb,

  peakDeltaMb:
    peak.rssMb -
    baseline.rssMb
}

// stdout is reserved for machine-readable JSON.

process.stdout.write(
  JSON.stringify(result)
)