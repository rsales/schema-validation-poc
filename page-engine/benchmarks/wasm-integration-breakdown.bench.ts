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

const ROOT = resolve(
  import.meta.dirname,
  '..',
)

const PAGE_PATH = resolve(
  ROOT,
  'fixtures',
  'page-large.json',
)

const WASM_PATH = resolve(
  ROOT,
  'wasm',
  'page_engine_bg.wasm',
)

const ITERATIONS = 100_000

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

function applyChange(
  page: PageNode,
  change: PageChange,
): void {
  switch (change.type) {
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

type BenchmarkChange = {
  name: string
  change: PageChange
}

const schema =
  loadSchema()

const page =
  JSON.parse(
    readFileSync(
      PAGE_PATH,
      'utf8',
    ),
  ) as PageNode

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

const changes: BenchmarkChange[] = [
  {
    name: 'field_changed',

    change: {
      type: 'field_changed',
      path: [0, 0],
    },
  },

  {
    name: 'node_added',

    change: {
      type: 'node_added',
      path: [1, 1, 6],
    },
  },

  {
    name: 'node_removed',

    change: {
      type: 'node_removed',
      path: [1, 1, 0],
    },
  },

  {
    name: 'node_moved',

    change: {
      type: 'node_moved',
      from: [1, 1, 0],
      to: [1, 1, 5],
    },
  },
]

console.log('')

console.log(
  'Page Engine - WASM incremental validation',
)

console.log(
  '=========================================',
)

console.log(
  `iterations: ${ITERATIONS}`,
)

console.log('')

for (
  const {
    name,
    change,
  } of changes
) {
  const finalPage =
    clonePage(page)

  applyChange(
    finalPage,
    change,
  )

  const residentPage =
    validator.load_page(
      JSON.stringify(finalPage),
    )

  const changeJson =
    JSON.stringify(change)

  /*
   * ---------------------------------------------
   * Warm-up
   * ---------------------------------------------
   */

  const warmup =
    validator.validate_resident_incremental(
      residentPage,
      changeJson,
    )

  console.log(
    `${name} warm-up:`,
    warmup,
  )

  /*
   * ---------------------------------------------
   * Benchmark
   * ---------------------------------------------
   */

  let valid = true

  const start =
    performance.now()

  for (
    let i = 0;
    i < ITERATIONS;
    i++
  ) {
    const result =
      validator.validate_resident_incremental(
        residentPage,
        changeJson,
      )

    const parsed =
      JSON.parse(result)

    valid =
      valid &&
      parsed.valid
  }

  const elapsed =
    performance.now() -
    start

  /*
   * ---------------------------------------------
   * Output
   * ---------------------------------------------
   */

  console.log(name)

  console.log(
    `  elapsed:       ${elapsed.toFixed(2)} ms`,
  )

  console.log(
    `  avg:           ${(elapsed / ITERATIONS).toFixed(6)} ms`,
  )

  console.log(
    `  valid:         ${valid}`,
  )

  console.log('')
}