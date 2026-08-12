import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  printMemoryLegend,
  formatMemoryResult,
  type MemoryResult
} from './benchmark-memory-metrics.js'

const RUNS = 50

const fixtures = [
  {
    name: 'Small',
    fixture: 'page-small.json',
    iterations: 100_000
  },
  {
    name: 'Medium',
    fixture: 'page-medium.json',
    iterations: 10_000
  },
  {
    name: 'Large',
    fixture: 'page-large.json',
    iterations: 1_000
  },
  {
    name: 'Huge',
    fixture: 'page-huge.json',
    iterations: 100
  }
]

const currentFile =
  fileURLToPath(import.meta.url)

const currentDir =
  dirname(currentFile)

const worker =
  resolve(
    currentDir,
    'benchmark-memory-worker.ts'
  )

function runFixture(
  fixture: typeof fixtures[number]
): MemoryResult {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      worker,
      fixture.name,
      fixture.fixture,
      String(fixture.iterations),
      String(RUNS)
    ],
    {
      encoding: 'utf8'
    }
  )

  if (result.error) {
    throw result.error
  }

  // Worker logs are written to stderr so stdout
  // remains reserved for machine-readable JSON.
  if (result.stderr) {
    process.stdout.write(
      result.stderr
    )
  }

  if (result.status !== 0) {
    throw new Error(
      `Memory benchmark failed for ${fixture.name}`
    )
  }

  return JSON.parse(
    result.stdout.trim()
  ) as MemoryResult
}

// ─────────────────────────────────────────────
// Benchmark
// ─────────────────────────────────────────────

console.log()

console.log(
  'JSON Schema Memory Benchmark'
)

console.log(
  '============================'
)

console.log()

console.log(
  `Runs: ${RUNS}`
)

// ─────────────────────────────────────────────
// Memory Legend
// ─────────────────────────────────────────────

printMemoryLegend()

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const results: MemoryResult[] = []

for (const fixture of fixtures) {
  console.log(
    `Benchmarking ${fixture.name}...`
  )

  results.push(
    runFixture(fixture)
  )

  console.log()
}

// ─────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────

console.log(
  'Memory Results'
)

console.log(
  '=============='
)

console.log()

console.table(
  results.map(
    formatMemoryResult
  )
)