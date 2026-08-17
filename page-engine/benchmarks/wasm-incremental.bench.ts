import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  initSync,
  PageValidator,
} from '../wasm/page_engine.js'

import type {
  PageNode,
} from '../src/types'

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
  ROOT,
  'wasm',
  'page_engine_bg.wasm',
)

const ITERATIONS = 100_000
const WARMUP_ITERATIONS = 10_000

function loadFile(
  path: string,
): string {
  return readFileSync(
    path,
    'utf8',
  )
}

function loadJson<T>(
  path: string,
): T {
  return JSON.parse(
    loadFile(path),
  ) as T
}

function clonePage(
  page: PageNode,
): PageNode {
  return structuredClone(page)
}

function getNode(
  page: PageNode,
  path: number[],
): PageNode {
  let current = page

  for (const index of path) {
    const child =
      current.children[index]

    if (!child) {
      throw new Error(
        `Invalid node path: [${path.join(', ')}]`,
      )
    }

    current = child
  }

  return current
}

function getParent(
  page: PageNode,
  path: number[],
): PageNode {
  if (path.length === 0) {
    throw new Error(
      'Root node does not have a parent',
    )
  }

  return getNode(
    page,
    path.slice(0, -1),
  )
}

type PageChange =
  | {
      type: 'field_changed'
      path: number[]
    }
  | {
      type: 'node_added'
      path: number[]
    }
  | {
      type: 'node_removed'
      path: number[]
    }
  | {
      type: 'node_moved'
      from: number[]
      to: number[]
    }

function applyChange(
  page: PageNode,
  change: PageChange,
): void {
  switch (change.type) {
    /*
     * ---------------------------------------------
     * Field changed
     * ---------------------------------------------
     */

    case 'field_changed': {
      const node =
        getNode(
          page,
          change.path,
        )

      node.fields.text =
        'Updated heading'

      break
    }

    /*
     * ---------------------------------------------
     * Node added
     * ---------------------------------------------
     */

    case 'node_added': {
      const parentPath =
        change.path.slice(0, -1)

      const index =
        change.path.at(-1)!

      const parent =
        getNode(
          page,
          parentPath,
        )

      const newHeading: PageNode = {
        id: 'benchmark-heading',

        type: 'heading',

        fields: {
          text: 'New heading',
          level: 2,
        },

        children: [],
      }

      parent.children.splice(
        index,
        0,
        newHeading,
      )

      break
    }

    /*
     * ---------------------------------------------
     * Node removed
     * ---------------------------------------------
     */

    case 'node_removed': {
      const parentPath =
        change.path.slice(0, -1)

      const index =
        change.path.at(-1)!

      const parent =
        getNode(
          page,
          parentPath,
        )

      parent.children.splice(
        index,
        1,
      )

      break
    }

    /*
     * ---------------------------------------------
     * Node moved
     * ---------------------------------------------
     */

    case 'node_moved': {
      const fromParent =
        getParent(
          page,
          change.from,
        )

      const fromIndex =
        change.from.at(-1)!

      const toParent =
        getParent(
          page,
          change.to,
        )

      const toIndex =
        change.to.at(-1)!

      const [
        movedNode,
      ] =
        fromParent.children.splice(
          fromIndex,
          1,
        )

      if (!movedNode) {
        throw new Error(
          `Could not find node at [${change.from.join(', ')}]`,
        )
      }

      toParent.children.splice(
        toIndex,
        0,
        movedNode,
      )

      break
    }
  }
}

interface BenchmarkResult {
  name: string
  fullMs: number
  incrementalMs: number
  fullThroughput: number
  incrementalThroughput: number
  speedup: number
  valid: boolean
}

function benchmarkChange(
  validator: PageValidator,
  page: PageNode,
  change: PageChange,
): BenchmarkResult {
  /*
   * ---------------------------------------------
   * Build final page state
   * ---------------------------------------------
   */

  const finalPage =
    clonePage(page)

  applyChange(
    finalPage,
    change,
  )

  const finalPageJson =
    JSON.stringify(finalPage)

  const changeJson =
    JSON.stringify(change)

  /*
   * ---------------------------------------------
   * Load resident page
   * ---------------------------------------------
   */

  const residentPage =
    validator.load_page(
      finalPageJson,
    )

  /*
   * ---------------------------------------------
   * Warm-up
   * ---------------------------------------------
   */

  validator.validate_resident_many(
    residentPage,
    WARMUP_ITERATIONS,
  )

  for (
    let i = 0;
    i < WARMUP_ITERATIONS;
    i++
  ) {
    validator.validate_resident_incremental(
      residentPage,
      changeJson,
    )
  }

  /*
   * ---------------------------------------------
   * Full resident validation
   * ---------------------------------------------
   */

  const fullStart =
    performance.now()

  const fullValid =
    validator.validate_resident_many(
      residentPage,
      ITERATIONS,
    )

  const fullElapsed =
    performance.now() -
    fullStart

  /*
   * ---------------------------------------------
   * Incremental resident validation
   * ---------------------------------------------
   */

  const incrementalStart =
    performance.now()

  for (
    let i = 0;
    i < ITERATIONS;
    i++
  ) {
    validator.validate_resident_incremental(
      residentPage,
      changeJson,
    )
  }

  const incrementalElapsed =
    performance.now() -
    incrementalStart

  /*
   * ---------------------------------------------
   * Metrics
   * ---------------------------------------------
   */

  const fullThroughput =
    ITERATIONS /
    (fullElapsed / 1000)

  const incrementalThroughput =
    ITERATIONS /
    (incrementalElapsed / 1000)

  const speedup =
    fullElapsed /
    incrementalElapsed

  return {
    name: change.type,

    fullMs:
      fullElapsed,

    incrementalMs:
      incrementalElapsed,

    fullThroughput,

    incrementalThroughput,

    speedup,

    valid:
      fullValid,
  }
}

/*
 * ---------------------------------------------
 * WASM initialization
 * ---------------------------------------------
 */

const schemaJson =
  loadFile(
    SCHEMA_PATH,
  )

const page =
  loadJson<PageNode>(
    PAGE_PATH,
  )

const wasm =
  readFileSync(
    WASM_PATH,
  )

initSync({
  module: wasm,
})

const validator =
  new PageValidator(
    schemaJson,
  )

/*
 * ---------------------------------------------
 * Changes
 * ---------------------------------------------
 */

const changes: PageChange[] = [
  {
    type: 'field_changed',
    path: [0, 0],
  },

  {
    type: 'node_added',
    path: [0, 1],
  },

  {
    type: 'node_removed',
    path: [0, 0],
  },

  {
    type: 'node_moved',
    from: [0, 0],
    to: [0, 2],
  },
]

/*
 * ---------------------------------------------
 * Benchmark
 * ---------------------------------------------
 */

const results =
  changes.map(
    (change) =>
      benchmarkChange(
        validator,
        page,
        change,
      ),
  )

console.log('')
console.log(
  'Rust WASM - incremental validation',
)
console.log(
  '-----------------------------------',
)
console.log(
  `iterations: ${ITERATIONS}`,
)

console.log('')

for (const result of results) {
  console.log(
    result.name,
  )

  console.log(
    `  full:             ${result.fullMs.toFixed(2)} ms`,
  )

  console.log(
    `  incremental:      ${result.incrementalMs.toFixed(2)} ms`,
  )

  console.log(
    `  full throughput:  ${result.fullThroughput.toFixed(0)} validations/sec`,
  )

  console.log(
    `  incremental:      ${result.incrementalThroughput.toFixed(0)} validations/sec`,
  )

  console.log(
    `  speedup:           ${result.speedup.toFixed(2)}x`,
  )

  console.log(
    `  valid:             ${result.valid}`,
  )

  console.log('')
}