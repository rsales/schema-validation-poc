import schema from '../schema/page.schema.json' with { type: 'json' }

import smallPage from '../fixtures/page-small.json' with { type: 'json' }
import mediumPage from '../fixtures/page-medium.json' with { type: 'json' }
import largePage from '../fixtures/page-large.json' with { type: 'json' }
import hugePage from '../fixtures/page-huge.json' with { type: 'json' }

import {
  init_validator,
  init_page,
  validate_cached
} from '../rust/pkg/schema_validator.js'

const RUNS = 50

interface Fixture {
  name: string
  page: unknown
  iterations: number
}

interface BenchmarkResult {
  fixture: string
  sizeBytes: number
  blocks: number
  iterations: number
  averageMs: number
  averageUs: number
  p95Us: number
  opsPerSecond: number
}

const fixtures: Fixture[] = [
  {
    name: 'Small',
    page: smallPage,
    iterations: 100_000
  },
  {
    name: 'Medium',
    page: mediumPage,
    iterations: 10_000
  },
  {
    name: 'Large',
    page: largePage,
    iterations: 1_000
  },
  {
    name: 'Huge',
    page: hugePage,
    iterations: 100
  }
]

function getBlockCount(page: unknown): number {
  if (
    typeof page === 'object' &&
    page !== null &&
    'blocks' in page &&
    Array.isArray(page.blocks)
  ) {
    return page.blocks.length
  }

  return 0
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function benchmark(
  fixture: Fixture,
  index: number
): BenchmarkResult {
  const {
    name,
    page,
    iterations
  } = fixture

  const json = JSON.stringify(page)

  const sizeBytes = Buffer.byteLength(json)

  const blocks = getBlockCount(page)

  const warmupIterations = Math.min(
    10_000,
    iterations
  )

  console.log(
    `[${index}/${fixtures.length}] ${name}`
  )

  console.log(
    `      Size: ${(sizeBytes / 1024).toFixed(2)} KB`
  )

  console.log(
    `      Blocks: ${formatNumber(blocks)}`
  )

  console.log(
    `      Warmup: ${formatNumber(warmupIterations)}`
  )

  console.log(
    `      Iterations: ${formatNumber(iterations)}`
  )

  console.log()

  // Parse the page JSON once.
  //
  // This is intentionally outside the benchmark.
  // We want to measure only schema validation.
  init_page(json)

  console.log(
    '      Page initialized.'
  )

  console.log()

  console.log(
    '      Warmup...'
  )

  for (let i = 0; i < warmupIterations; i++) {
    validate_cached()
  }

  console.log(
    '      Warmup completed.'
  )

  console.log()

  const durations: number[] = []

  let validCount = 0

  for (let run = 0; run < RUNS; run++) {
    process.stdout.write(
      `      Run ${run + 1}/${RUNS}... `
    )

    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      if (validate_cached()) {
        validCount++
      }
    }

    const end = performance.now()

    const duration = end - start

    durations.push(duration)

    console.log(
      `${duration.toFixed(3)} ms`
    )
  }

  const sortedDurations = [
    ...durations
  ].sort((a, b) => a - b)

  const totalMs = durations.reduce(
    (sum, duration) => sum + duration,
    0
  )

  const averageMs = totalMs / RUNS

  const averageUs =
    (averageMs / iterations) * 1000

  const p95Index =
    Math.ceil(RUNS * 0.95) - 1

  const p95Ms =
    sortedDurations[p95Index]

  const p95Us =
    (p95Ms / iterations) * 1000

  const opsPerSecond =
    (iterations / averageMs) * 1000

  console.log()

  console.log(
    `      ✓ Validations: ${formatNumber(validCount)}`
  )

  console.log()

  return {
    fixture: name,
    sizeBytes,
    blocks,
    iterations,
    averageMs,
    averageUs,
    p95Us,
    opsPerSecond
  }
}

console.log()

console.log(
  'Rust/WASM Pure Validation Benchmark'
)

console.log(
  '==================================='
)

console.log()

console.log(
  `Runs: ${RUNS}`
)

console.log()

console.log(
  'Initializing validator...'
)

const schemaJson = JSON.stringify(schema)

init_validator(schemaJson)

console.log(
  'Validator initialized.'
)

console.log()

const results: BenchmarkResult[] = []

for (let i = 0; i < fixtures.length; i++) {
  results.push(
    benchmark(
      fixtures[i],
      i + 1
    )
  )
}

console.log()

console.log(
  'Benchmark Results'
)

console.log(
  '================='
)

console.log()

console.table(
  results.map((result) => ({
    Fixture: result.fixture,

    Size:
      `${(result.sizeBytes / 1024).toFixed(2)} KB`,

    Blocks:
      formatNumber(result.blocks),

    Iterations:
      formatNumber(result.iterations),

    'Avg (ms)':
      result.averageMs.toFixed(3),

    'Avg (μs)':
      result.averageUs.toFixed(3),

    'P95 (μs)':
      result.p95Us.toFixed(3),

    'Ops/sec':
      Math.round(
        result.opsPerSecond
      ).toLocaleString()
  }))
)