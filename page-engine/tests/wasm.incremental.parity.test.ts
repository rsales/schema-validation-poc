import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  initSync,
  PageValidator,
} from '../wasm/page_engine.js'

import {
  validatePage,
} from '../src'

import type {
  ComponentSchema,
  PageNode,
  ValidationResult,
} from '../src/types'

const ROOT = process.cwd()

const SCHEMA_PATH = join(
  ROOT,
  'schema',
  'component-schema.json',
)

const PAGE_PATH = join(
  ROOT,
  'fixtures',
  'page-small.json',
)

const WASM_PATH = join(
  ROOT,
  'wasm',
  'page_engine_bg.wasm',
)

function loadJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(path, 'utf8'),
  ) as T
}

function loadText(path: string): string {
  return readFileSync(path, 'utf8')
}

function normalizePath(
  path: string,
): string {
  if (path === '$') {
    return '/'
  }

  return path
    .replace(/^\$\.?/, '/')
    .replace(/\[(\d+)\]/g, '/$1')
    .replace(/\./g, '/')
    .replace(/\/+/g, '/')
}

function normalizeResult(
  result: ValidationResult,
): ValidationResult {
  return {
    valid: result.valid,

    errors:
      result.errors
        .map((error) => ({
          ...error,
          path: normalizePath(error.path),
        }))
        .sort((a, b) => {
          const path =
            a.path.localeCompare(b.path)

          if (path !== 0) {
            return path
          }

          const code =
            a.code.localeCompare(b.code)

          if (code !== 0) {
            return code
          }

          return a.message.localeCompare(
            b.message,
          )
        }),
  }
}

function assertParity(
  actual: ValidationResult,
  expected: ValidationResult,
): void {
  assert.deepEqual(
    normalizeResult(actual),
    normalizeResult(expected),
  )
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

/*
 * ---------------------------------------------
 * Fixtures
 * ---------------------------------------------
 */

const schema =
  loadJson<ComponentSchema>(
    SCHEMA_PATH,
  )

const page =
  loadJson<PageNode>(
    PAGE_PATH,
  )

const schemaJson =
  loadText(SCHEMA_PATH)

const wasm =
  readFileSync(WASM_PATH)

initSync({
  module: wasm,
})

const validator =
  new PageValidator(schemaJson)

/*
 * ---------------------------------------------
 * Changes
 * ---------------------------------------------
 *
 * page-small:
 *
 * page
 * └── hero
 *     ├── heading
 *     ├── text
 *     └── button
 */

const changes: Record<
  string,
  PageChange
> = {
  /*
   * hero
   * ├── heading ← field changed
   * ├── text
   * └── button
   */

  field_changed: {
    type: 'field_changed',
    path: [0, 0],
  },

  /*
   * hero
   * ├── heading
   * ├── NEW heading ← [0,1]
   * ├── text
   * └── button
   */

  node_added: {
    type: 'node_added',
    path: [0, 1],
  },

  /*
   * hero
   * ├── text
   * └── button
   */

  node_removed: {
    type: 'node_removed',
    path: [0, 0],
  },

  /*
   * BEFORE:
   *
   * hero
   * ├── heading
   * ├── text
   * └── button
   *
   * AFTER:
   *
   * hero
   * ├── text
   * ├── button
   * └── heading
   */

  node_moved: {
    type: 'node_moved',
    from: [0, 0],
    to: [0, 2],
  },
}

/*
 * ---------------------------------------------
 * Tests
 * ---------------------------------------------
 */

for (
  const [name, change] of
  Object.entries(changes)
) {
  test(
    `WASM incremental parity: ${name}`,
    () => {
      /*
       * -------------------------------------------
       * Build the final page state
       * -------------------------------------------
       *
       * The change describes a mutation, but the
       * incremental validator receives the page
       * AFTER that mutation.
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
       * -------------------------------------------
       * Load final page into resident WASM memory
       * -------------------------------------------
       */

      const residentPage =
        validator.load_page(
          finalPageJson,
        )

      /*
       * -------------------------------------------
       * Rust full validation
       * -------------------------------------------
       *
       * This is our reference result.
       */

      const rustFull =
        validatePage(
          finalPage,
          schema,
        )

      /*
       * -------------------------------------------
       * WASM incremental validation
       * -------------------------------------------
       */

      const wasmResult =
        JSON.parse(
          validator.validate_resident_incremental(
            residentPage,
            changeJson,
          ),
        ) as ValidationResult

      /*
       * -------------------------------------------
       * Parity
       * -------------------------------------------
       */

      assertParity(
        wasmResult,
        rustFull,
      )
    },
  )
}