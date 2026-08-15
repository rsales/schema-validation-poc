import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  PageChange,
} from './types'

test('PageChange supports field changes', () => {
  const change: PageChange = {
    type: 'field_changed',
    path: [0, 1, 2],
  }

  assert.deepEqual(
    change,
    {
      type: 'field_changed',
      path: [0, 1, 2],
    },
  )
})

test('PageChange supports node added', () => {
  const change: PageChange = {
    type: 'node_added',
    path: [0, 2],
  }

  assert.deepEqual(
    change,
    {
      type: 'node_added',
      path: [0, 2],
    },
  )
})

test('PageChange supports node removed', () => {
  const change: PageChange = {
    type: 'node_removed',
    path: [0, 3, 1],
  }

  assert.deepEqual(
    change,
    {
      type: 'node_removed',
      path: [0, 3, 1],
    },
  )
})

test('PageChange supports node moved', () => {
  const change: PageChange = {
    type: 'node_moved',
    from: [0, 1],
    to: [0, 3],
  }

  assert.deepEqual(
    change,
    {
      type: 'node_moved',
      from: [0, 1],
      to: [0, 3],
    },
  )
})