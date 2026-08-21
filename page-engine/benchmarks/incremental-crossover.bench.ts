import Ajv2020 from 'ajv/dist/2020.js'

import {
  loadPage,
  loadSchema,
} from './fixtures'

import {
  validatePage,
} from '../src/validator'

import {
  validateIncremental,
} from '../src/incremental-validator'

import {
  buildJsonSchema,
} from '../ajv/schema'

const TARGET_NODES = 10_000

const AFFECTED_NODES = [
  1,
  2,
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1_000,
  2_500,
  5_000,
  10_000,
]

interface BenchmarkResult {
  iterations: number
  elapsed: number
  perIteration: number
  throughput: number
}

function countNodes(
  node: {
    children: unknown[]
  },
): number {
  let count = 1

  for (const child of node.children) {
    count += countNodes(
      child as {
        children: unknown[]
      },
    )
  }

  return count
}

function scalePage(
  page: ReturnType<typeof loadPage>,
  targetNodes: number,
): ReturnType<typeof loadPage> {
  const scaled =
    structuredClone(page)

  const template =
    structuredClone(
      scaled.children[0],
    )

  while (
    countNodes(scaled) <
    targetNodes
  ) {
    scaled.children.push(
      structuredClone(template),
    )
  }

  return scaled
}

function iterationsFor(
  affectedNodes: number,
): number {
  if (affectedNodes <= 100) {
    return 100_000
  }

  if (affectedNodes <= 1_000) {
    return 10_000
  }

  if (affectedNodes <= 5_000) {
    return 1_000
  }

  return 100
}

function measure(
  fn: () => void,
  iterations: number,
): BenchmarkResult {
  const start =
    performance.now()

  for (
    let i = 0;
    i < iterations;
    i++
  ) {
    fn()
  }

  const elapsed =
    performance.now() - start

  return {
    iterations,
    elapsed,
    perIteration:
      elapsed / iterations,
    throughput:
      iterations /
      (elapsed / 1000),
  }
}

function formatMs(
  value: number,
): string {
  return `${value
    .toFixed(4)
    .padStart(10)} ms`
}

function formatThroughput(
  value: number,
): string {
  return value
    .toFixed(0)
    .padStart(12)
}

function formatSpeedup(
  full: number,
  incremental: number,
): string {
  return `${(
    full / incremental
  )
    .toFixed(2)
    .padStart(8)}x`
}

/**
 * Collects paths from the page tree
 * in deterministic depth-first order.
 */
function collectPaths(
  node: {
    children: {
      children: unknown[]
    }[]
  },
  path: number[] = [],
  result: number[][] = [],
): number[][] {
  result.push([...path])

  for (
    let index = 0;
    index < node.children.length;
    index++
  ) {
    collectPaths(
      node.children[index],
      [...path, index],
      result,
    )
  }

  return result
}

const schema =
  loadSchema()

const basePage =
  loadPage()

const page =
  scalePage(
    basePage,
    TARGET_NODES,
  )

const actualNodes =
  countNodes(page)

const paths =
  collectPaths(page)

console.log('')
console.log(
  'Incremental Validation Crossover',
)
console.log(
  '================================',
)
console.log(
  `page nodes: ${actualNodes}`,
)
console.log('')

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
  buildJsonSchema(
    schema,
  )

const ajvValidate =
  ajv.compile(
    jsonSchema,
  )

/*
 * --------------------------------------------------
 * Warm-up
 * --------------------------------------------------
 */

for (let i = 0; i < 10_000; i++) {
  ajvValidate(page)

  validatePage(
    page,
    schema,
  )

  validateIncremental(
    page,
    schema,
    [paths[0]],
  )
}

/*
 * --------------------------------------------------
 * Results
 * --------------------------------------------------
 */

console.log(
  'Affected Nodes     Iterations     AJV Full       TS Incremental     Speedup',
)

console.log(
  '--------------------------------------------------------------------------------',
)

for (
  const affectedNodes of
  AFFECTED_NODES
) {
  const iterations =
    iterationsFor(
      affectedNodes,
    )

  const affectedPaths =
    paths.slice(
      0,
      affectedNodes,
    )

  /*
   * AJV Full
   *
   * The same full page is validated
   * regardless of affected scope.
   */
  const ajvResult =
    measure(
      () => {
        ajvValidate(page)
      },
      iterations,
    )

  /*
   * TypeScript Incremental
   *
   * Only the selected nodes are validated.
   */
  const incrementalResult =
    measure(
      () => {
        validateIncremental(
          page,
          schema,
          affectedPaths,
        )
      },
      iterations,
    )

  const speedup =
    ajvResult.perIteration /
    incrementalResult.perIteration

  console.log(
    `${affectedNodes
      .toString()
      .padStart(13)}  ` +
    `${iterations
      .toString()
      .padStart(11)}  ` +
    `${formatMs(
      ajvResult.perIteration,
    )}  ` +
    `${formatMs(
      incrementalResult.perIteration,
    )}       ` +
    `${speedup
      .toFixed(2)
      .padStart(8)}x`,
  )
}

console.log('')
console.log(
  'Interpretation:',
)
console.log(
  'The crossover point is where incremental validation',
)
console.log(
  'approaches or exceeds the cost of AJV full validation.',
)
console.log('')