import smallPage from '../fixtures/page-small.json' with { type: 'json' }
import mediumPage from '../fixtures/page-medium.json' with { type: 'json' }
import largePage from '../fixtures/page-large.json' with { type: 'json' }
import hugePage from '../fixtures/page-huge.json' with { type: 'json' }

import { validatePage } from './ts/validator.js'

const RUNS = 50

interface BenchmarkPage {
  blocks: unknown[]
}

interface Fixture {
  name: string
  page: BenchmarkPage
  iterations: number
}

interface BenchmarkResult {
  name: string
  sizeBytes: number
  blocks: number
  iterations: number
  averageMs: number
  averageUs: number
  p95Ms: number
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

function benchmark(
  fixture: Fixture,
  fixtureIndex: number,
  totalFixtures: number
): BenchmarkResult {
  const {
    name,
    page,
    iterations
  } = fixture

  const warmupIterations = Math.min(
    10_000,
    iterations
  )

  console.log(
    `[${fixtureIndex}/${totalFixtures}] ${name}`
  )

  console.log(
    `      Size: ${(
      Buffer.byteLength(JSON.stringify(page)) /
      1024
    ).toFixed(2)} KB`
  )

  console.log(
    `      Blocks: ${page.blocks.length.toLocaleString()}`
  )

  console.log(
    `      Warmup: ${warmupIterations.toLocaleString()}`
  )

  console.log(
    `      Iterations: ${iterations.toLocaleString()}`
  )

  console.log()

  // ─────────────────────────────────────────────
  // Warmup
  // ─────────────────────────────────────────────

  console.log('      Warmup...')

  for (let i = 0; i < warmupIterations; i++) {
    validatePage(page)
  }

  console.log('      Warmup completed.')
  console.log()

  // ─────────────────────────────────────────────
  // Benchmark
  // ─────────────────────────────────────────────

  const durations: number[] = []

  let validCount = 0

  const benchmarkStart = performance.now()

  for (let run = 0; run < RUNS; run++) {
    process.stdout.write(
      `      Run ${run + 1}/${RUNS}... `
    )

    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      if (validatePage(page)) {
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

  const benchmarkEnd = performance.now()

  // ─────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────

  const sortedDurations = [...durations].sort(
    (a, b) => a - b
  )

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

  const sizeBytes = Buffer.byteLength(
    JSON.stringify(page)
  )

  const totalDurationSeconds =
    (benchmarkEnd - benchmarkStart) / 1000

  console.log()

  console.log(
    `      ✓ Completed in ${totalDurationSeconds.toFixed(2)}s`
  )

  console.log(
    `      Validations: ${validCount.toLocaleString()}`
  )

  console.log()

  return {
    name,
    sizeBytes,
    blocks: page.blocks.length,
    iterations,
    averageMs,
    averageUs,
    p95Ms,
    p95Us,
    opsPerSecond
  }
}

// ─────────────────────────────────────────────
// Benchmark
// ─────────────────────────────────────────────

console.log()
console.log('JSON Schema Benchmark')
console.log('=====================')
console.log()

console.log(`Runs: ${RUNS}`)
console.log()

const results: BenchmarkResult[] = []

for (let i = 0; i < fixtures.length; i++) {
  const result = benchmark(
    fixtures[i],
    i + 1,
    fixtures.length
  )

  results.push(result)
}

// ─────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────

console.log()
console.log('Benchmark Results')
console.log('=================')
console.log()

console.table(
  results.map((result) => ({
    Fixture: result.name,
    Size: `${(
      result.sizeBytes / 1024
    ).toFixed(2)} KB`,
    Blocks: result.blocks.toLocaleString(),
    Iterations:
      result.iterations.toLocaleString(),
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