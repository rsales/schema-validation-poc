import assert from 'node:assert/strict'
import test from 'node:test'

import {
  Page,
} from './index'

test('Page is exported from the public API', () => {
  const page = new Page({
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [],
  })

  assert.equal(page.id, 'page-1')
  assert.equal(page.type, 'page')
})