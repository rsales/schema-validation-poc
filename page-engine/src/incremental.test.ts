import assert from 'node:assert/strict'
import test from 'node:test'

import {
  affectedScope,
  resolvePath,
  resolvePaths,
} from './incremental'

import type {
  PageNode,
  PageChange,
} from './types'

const page: PageNode = {
  id: 'page',
  type: 'page',
  fields: {},
  children: [],
}

/*
 * --------------------------------------------------
 * affectedScope()
 * --------------------------------------------------
 */

test(
  'field_changed affects only the changed node',
  () => {
    const change: PageChange = {
      type: 'field_changed',
      path: [0, 0],
    }

    assert.deepEqual(
      affectedScope(
        page,
        change,
      ),
      [
        [0, 0],
      ],
    )
  },
)

test(
  'node_added affects node and ancestors',
  () => {
    const change: PageChange = {
      type: 'node_added',
      path: [1, 1, 6],
    }

    assert.deepEqual(
      affectedScope(
        page,
        change,
      ),
      [
        [1, 1, 6],
        [1, 1],
        [1],
        [],
      ],
    )
  },
)

test(
  'node_removed affects parent and ancestors',
  () => {
    const change: PageChange = {
      type: 'node_removed',
      path: [1, 1, 6],
    }

    assert.deepEqual(
      affectedScope(
        page,
        change,
      ),
      [
        [1, 1],
        [1],
        [],
      ],
    )
  },
)

test(
  'node_moved affects both source and destination paths',
  () => {
    const change: PageChange = {
      type: 'node_moved',
      from: [1, 1, 0],
      to: [1, 1, 5],
    }

    assert.deepEqual(
      affectedScope(
        page,
        change,
      ),
      [
        [1, 1, 0],
        [1, 1],
        [1],
        [],
        [1, 1, 5],
      ],
    )
  },
)

/*
 * --------------------------------------------------
 * resolvePath()
 * --------------------------------------------------
 */

test(
  'resolvePath resolves the root',
  () => {
    assert.equal(
      resolvePath(
        page,
        [],
      ),
      page,
    )
  },
)

test(
  'resolvePath resolves a nested node',
  () => {
    const nested: PageNode = {
      id: 'nested',
      type: 'text',
      fields: {},
      children: [],
    }

    const root: PageNode = {
      id: 'root',
      type: 'page',
      fields: {},
      children: [
        {
          id: 'section',
          type: 'section',
          fields: {},
          children: [
            nested,
          ],
        },
      ],
    }

    assert.equal(
      resolvePath(
        root,
        [0, 0],
      ),
      nested,
    )
  },
)

test(
  'resolvePath returns undefined for an invalid path',
  () => {
    assert.equal(
      resolvePath(
        page,
        [99],
      ),
      undefined,
    )
  },
)

/*
 * --------------------------------------------------
 * resolvePaths()
 * --------------------------------------------------
 */

test(
  'resolvePaths resolves multiple nodes',
  () => {
    const first: PageNode = {
      id: 'first',
      type: 'text',
      fields: {},
      children: [],
    }

    const second: PageNode = {
      id: 'second',
      type: 'text',
      fields: {},
      children: [],
    }

    const root: PageNode = {
      id: 'root',
      type: 'page',
      fields: {},
      children: [
        first,
        second,
      ],
    }

    const nodes = resolvePaths(
      root,
      [
        [0],
        [1],
      ],
    )

    assert.deepEqual(
      nodes,
      [
        first,
        second,
      ],
    )
  },
)

test(
  'resolvePaths ignores invalid paths',
  () => {
    const first: PageNode = {
      id: 'first',
      type: 'text',
      fields: {},
      children: [],
    }

    const root: PageNode = {
      id: 'root',
      type: 'page',
      fields: {},
      children: [
        first,
      ],
    }

    const nodes = resolvePaths(
      root,
      [
        [0],
        [99],
        [1, 2, 3],
      ],
    )

    assert.deepEqual(
      nodes,
      [
        first,
      ],
    )
  },
)