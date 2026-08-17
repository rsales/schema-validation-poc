import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  initSync,
  PageValidator,
} from '../wasm/page_engine.js'

import {
  loadSchema,
} from './fixtures'

import type {
  PageChange,
  PageNode,
} from '../src/types'

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------

const ROOT =
  resolve(
    import.meta.dirname,
    '..',
  )

const WASM_PATH =
  resolve(
    ROOT,
    'wasm',
    'page_engine_bg.wasm',
  )

const FIXTURES = [
  {
    name: 'small',

    path: resolve(
      ROOT,
      'fixtures',
      'page-small.json',
    ),
  },

  {
    name: 'large',

    path: resolve(
      ROOT,
      'fixtures',
      'page-large.json',
    ),
  },

  {
    name: 'xlarge',

    path: resolve(
      ROOT,
      'fixtures',
      'page-xlarge.json',
    ),
  },
]

const ITERATIONS =
  100_000

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function clonePage(
  page: PageNode,
): PageNode {
  return structuredClone(page)
}

function countNodes(
  node: PageNode,
): number {
  let count = 1

  for (
    const child of node.children
  ) {
    count += countNodes(child)
  }

  return count
}

function getNode(
  page: PageNode,
  path: number[],
): PageNode {
  let current = page

  for (
    const index of path
  ) {
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

// ---------------------------------------------------------
// Change application
// ---------------------------------------------------------

function applyChange(
  page: PageNode,
  change: PageChange,
): void {
  switch (
    change.type
  ) {
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

      const newCard: PageNode = {
        id: 'benchmark-card',

        type: 'card',

        fields: {
          title: 'Benchmark Card',
        },

        children: [],
      }

      parent.children.splice(
        index,
        0,
        newCard,
      )

      break
    }

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

    case 'node_moved': {
      if (
        change.from.length === 0 ||
        change.to.length === 0
      ) {
        throw new Error(
          'Cannot move the root node',
        )
      }

      const fromParent =
        getNode(
          page,
          change.from.slice(0, -1),
        )

      const fromIndex =
        change.from.at(-1)!

      const toParent =
        getNode(
          page,
          change.to.slice(0, -1),
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

// ---------------------------------------------------------
// Benchmark change
// ---------------------------------------------------------
//
// The scaling benchmark intentionally uses a field change.
//
// The affected scope remains constant:
//
//     [0, 0]
//
// while the total number of nodes increases.
//
// This allows us to observe whether:
//
//     Full validation
//         scales with page size
//
//     Incremental validation
//         scales with affected scope
//
// ---------------------------------------------------------

const CHANGE: PageChange = {
  type: 'field_changed',

  path: [0, 0],
}

// ---------------------------------------------------------
// Processing indicator
// ---------------------------------------------------------
//
// Validation is synchronous.
//
// An animated spinner using setInterval() would NOT animate
// while the WASM call is blocking the Node.js event loop.
//
// Therefore we use a persistent processing indicator:
//
//     ⏳ xlarge (761 nodes) — full validation...
//
// which is replaced by:
//
//     ✓ xlarge (761 nodes) — full validation: 61819.76 ms
//
// This provides feedback without changing the benchmark's
// execution model.
// ---------------------------------------------------------

function startProcessing(
  label: string,
): void {
  process.stdout.write(
    `⏳ ${label}...`,
  )
}

function finishProcessing(
  label: string,
  elapsed: number,
): void {
  process.stdout.write(
    `\r✓ ${label}: ${elapsed.toFixed(2)} ms\n`,
  )
}

// ---------------------------------------------------------
// WASM initialization
// ---------------------------------------------------------

const schema =
  loadSchema()

const wasm =
  readFileSync(
    WASM_PATH,
  )

initSync({
  module: wasm,
})

const validator =
  new PageValidator(
    JSON.stringify(schema),
  )

// ---------------------------------------------------------
// Header
// ---------------------------------------------------------

console.log('')

console.log(
  'Page Engine - Incremental Validation Scaling',
)

console.log(
  '=============================================',
)

console.log(
  `iterations: ${ITERATIONS}`,
)

console.log('')

console.log(
  'Processing fixtures...',
)

console.log('')

// ---------------------------------------------------------
// Results
// ---------------------------------------------------------

type ScalingResult = {
  name: string
  nodes: number
  fullElapsed: number
  incrementalElapsed: number
  speedup: number
  fullThroughput: number
  incrementalThroughput: number
}

const results:
  ScalingResult[] = []

// ---------------------------------------------------------
// Benchmark
// ---------------------------------------------------------

for (
  const fixture of FIXTURES
) {
  /*
   * -------------------------------------------------------
   * Load fixture
   * -------------------------------------------------------
   */

  const page =
    JSON.parse(
      readFileSync(
        fixture.path,
        'utf8',
      ),
    ) as PageNode

  const nodes =
    countNodes(page)

  /*
   * -------------------------------------------------------
   * Create final page state
   * -------------------------------------------------------
   *
   * Both validation strategies operate against the same
   * logical page state.
   */

  const finalPage =
    clonePage(page)

  applyChange(
    finalPage,
    CHANGE,
  )

  const pageJson =
    JSON.stringify(finalPage)

  const changeJson =
    JSON.stringify(CHANGE)

  /*
   * -------------------------------------------------------
   * Resident WASM page
   * -------------------------------------------------------
   */

  const residentPage =
    validator.load_page(
      pageJson,
    )

  /*
   * -------------------------------------------------------
   * Warm-up
   * -------------------------------------------------------
   */

  validator.validate_json(
    pageJson,
  )

  validator.validate_resident_incremental(
    residentPage,
    changeJson,
  )

  /*
   * -------------------------------------------------------
   * Full validation
   * -------------------------------------------------------
   */

  const fullLabel =
    `${fixture.name} (${nodes} nodes) — full validation`

  startProcessing(
    fullLabel,
  )

  const fullStart =
    performance.now()

  for (
    let i = 0;
    i < ITERATIONS;
    i++
  ) {
    validator.validate_json(
      pageJson,
    )
  }

  const fullElapsed =
    performance.now() -
    fullStart

  finishProcessing(
    fullLabel,
    fullElapsed,
  )

  /*
   * -------------------------------------------------------
   * Incremental validation
   * -------------------------------------------------------
   */

  const incrementalLabel =
    `${fixture.name} (${nodes} nodes) — incremental validation`

  startProcessing(
    incrementalLabel,
  )

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

  finishProcessing(
    incrementalLabel,
    incrementalElapsed,
  )

  /*
   * -------------------------------------------------------
   * Metrics
   * -------------------------------------------------------
   */

  const speedup =
    fullElapsed /
    incrementalElapsed

  const fullThroughput =
    ITERATIONS /
    (fullElapsed / 1000)

  const incrementalThroughput =
    ITERATIONS /
    (incrementalElapsed / 1000)

  results.push({
    name: fixture.name,

    nodes,

    fullElapsed,

    incrementalElapsed,

    speedup,

    fullThroughput,

    incrementalThroughput,
  })

  console.log('')
}

// ---------------------------------------------------------
// Scaling Results
// ---------------------------------------------------------

console.log(
  'Scaling Results',
)

console.log(
  '--------------------------------------------------------------------------',
)

console.log(
  'Page      Nodes        Full        Incremental    Speedup',
)

console.log(
  '--------------------------------------------------------------------------',
)

for (
  const result of results
) {
  console.log(
    `${result.name.padEnd(8)} ` +
    `${String(result.nodes).padStart(6)} ` +
    `${result.fullElapsed
      .toFixed(2)
      .padStart(12)} ms ` +
    `${result.incrementalElapsed
      .toFixed(2)
      .padStart(14)} ms ` +
    `${result.speedup
      .toFixed(2)
      .padStart(10)}x`,
  )
}

console.log('')

// ---------------------------------------------------------
// Throughput
// ---------------------------------------------------------

console.log(
  'Throughput',
)

console.log(
  '--------------------------------------------------------------------------',
)

console.log(
  'Page      Full validations/sec    Incremental validations/sec',
)

console.log(
  '--------------------------------------------------------------------------',
)

for (
  const result of results
) {
  console.log(
    `${result.name.padEnd(8)} ` +
    `${Math.round(
      result.fullThroughput,
    )
      .toString()
      .padStart(25)} ` +
    `${Math.round(
      result.incrementalThroughput,
    )
      .toString()
      .padStart(32)}`,
  )
}

console.log('')