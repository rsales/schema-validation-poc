import assert from 'node:assert/strict'
import test from 'node:test'

import {Page} from './page'

test('Page model', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [
      {
        id: 'hero-1',
        type: 'hero',
        fields: {
          title: 'Hello World',
          alignment: 'center',
        },
        children: [
          {
            id: 'button-1',
            type: 'button',
            fields: {
              label: 'Learn more',
              url: 'https://example.com',
              variant: 'primary',
            },
            children: [],
          },
        ],
      },
      {
        id: 'section-1',
        type: 'section',
        fields: {
          id: 'main-section',
        },
        children: [
          {
            id: 'container-1',
            type: 'container',
            fields: {},
            children: [
              {
                id: 'heading-1',
                type: 'heading',
                fields: {
                  text: 'Hello',
                  level: 2,
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  }

  const page = new Page(node)

  assert.equal(page.id, 'page-1')
  assert.equal(page.type, 'page')

  assert.deepEqual(page.fields, {})

  assert.equal(page.children().length, 2)
})

test('findById finds a direct child', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [
      {
        id: 'hero-1',
        type: 'hero',
        fields: {},
        children: [],
      },
    ],
  }

  const page = new Page(node)

  const result = page.findById('hero-1')

  assert.ok(result)
  assert.equal(result.id, 'hero-1')
  assert.equal(result.type, 'hero')
})

test('findById finds a deeply nested node', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [
      {
        id: 'section-1',
        type: 'section',
        fields: {
          id: 'main-section',
        },
        children: [
          {
            id: 'container-1',
            type: 'container',
            fields: {},
            children: [
              {
                id: 'heading-1',
                type: 'heading',
                fields: {
                  text: 'Hello',
                  level: 2,
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  }

  const page = new Page(node)

  const result = page.findById('heading-1')

  assert.ok(result)
  assert.equal(result.id, 'heading-1')
  assert.equal(result.type, 'heading')
})

test('findById returns undefined when the node does not exist', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [],
  }

  const page = new Page(node)

  assert.equal(
    page.findById('does-not-exist'),
    undefined,
  )
})

test('findById can find the page itself', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [],
  }

  const page = new Page(node)

  const result = page.findById('page-1')

  assert.ok(result)
  assert.equal(result.id, 'page-1')
})

test('findByType finds nodes of the requested type', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [
      {
        id: 'section-1',
        type: 'section',
        fields: {
          id: 'main-section',
        },
        children: [
          {
            id: 'container-1',
            type: 'container',
            fields: {},
            children: [
              {
                id: 'heading-1',
                type: 'heading',
                fields: {
                  text: 'Hello',
                  level: 2,
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  }

  const page = new Page(node)

  const result = page.findByType('heading')

  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'heading-1')
})

test('findByType finds multiple nodes of the same type', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [
      {
        id: 'hero-1',
        type: 'hero',
        fields: {},
        children: [
          {
            id: 'button-1',
            type: 'button',
            fields: {
              label: 'Learn more',
              url: 'https://example.com',
              variant: 'primary',
            },
            children: [],
          },
        ],
      },
      {
        id: 'section-1',
        type: 'section',
        fields: {
          id: 'main-section',
        },
        children: [
          {
            id: 'button-2',
            type: 'button',
            fields: {
              label: 'Get started',
              url: 'https://example.com/start',
              variant: 'secondary',
            },
            children: [],
          },
        ],
      },
    ],
  }

  const page = new Page(node)

  const result = page.findByType('button')

  assert.equal(result.length, 2)

  assert.deepEqual(
    result.map((node) => node.id),
    ['button-1', 'button-2'],
  )
})

test('findByType finds deeply nested nodes', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [
      {
        id: 'section-1',
        type: 'section',
        fields: {
          id: 'main-section',
        },
        children: [
          {
            id: 'container-1',
            type: 'container',
            fields: {},
            children: [
              {
                id: 'heading-1',
                type: 'heading',
                fields: {
                  text: 'Hello',
                  level: 2,
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  }

  const page = new Page(node)

  const result = page.findByType('heading')

  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'heading-1')
})

test('findByType returns an empty array when the type does not exist', () => {
  const node = {
    id: 'page-1',
    type: 'page',
    fields: {},
    children: [],
  }

  const page = new Page(node)

  assert.deepEqual(
    page.findByType('video'),
    [],
  )
})