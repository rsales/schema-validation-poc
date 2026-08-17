import assert from 'node:assert/strict'
import test from 'node:test'

import {
  validateIncremental,
} from './incremental-validator'

import type {
  ComponentSchema,
  PageNode,
} from './types'

const schema: ComponentSchema = {
  components: {
    page: {
      fields: {
        title: {
          type: 'string',
          required: true,
        },
      },
      allowedChildren: [
        'section',
      ],
      minChildren: 0,
      maxChildren: 10,
    },

    section: {
      fields: {
        title: {
          type: 'string',
          required: true,
          minLength: 3,
        },
      },
      allowedChildren: [
        'text',
      ],
      minChildren: 0,
      maxChildren: 10,
    },

    text: {
      fields: {
        content: {
          type: 'string',
          required: true,
        },
      },
      allowedChildren: [],
      minChildren: 0,
      maxChildren: 0,
    },
  },
}

function createPage(): PageNode {
  return {
    id: 'page-1',
    type: 'page',
    fields: {
      title: 'Home',
    },
    children: [
      {
        id: 'section-1',
        type: 'section',
        fields: {
          title: 'Hero',
        },
        children: [
          {
            id: 'text-1',
            type: 'text',
            fields: {
              content: 'Hello world',
            },
            children: [],
          },
        ],
      },
      {
        id: 'section-2',
        type: 'section',
        fields: {
          title: 'Features',
        },
        children: [],
      },
    ],
  }
}

test(
  'validates the root node',
  () => {
    const page = createPage()

    const result =
      validateIncremental(
        page,
        schema,
        [[]],
      )

    assert.equal(
      result.valid,
      true,
    )

    assert.deepEqual(
      result.errors,
      [],
    )
  },
)

test(
  'validates a nested node',
  () => {
    const page = createPage()

    const result =
      validateIncremental(
        page,
        schema,
        [[0]],
      )

    assert.equal(
      result.valid,
      true,
    )

    assert.deepEqual(
      result.errors,
      [],
    )
  },
)

test(
  'detects a required field error',
  () => {
    const page = createPage()

    page.children[0].fields.title =
      undefined

    const result =
      validateIncremental(
        page,
        schema,
        [[0]],
      )

    assert.equal(
      result.valid,
      false,
    )

    assert.deepEqual(
      result.errors,
      [
        {
          path:
            '$.children[0].fields.title',
          code: 'REQUIRED',
          message:
            'Field "title" is required.',
        },
      ],
    )
  },
)

test(
  'detects a field constraint error',
  () => {
    const page = createPage()

    page.children[0].fields.title =
      'Hi'

    const result =
      validateIncremental(
        page,
        schema,
        [[0]],
      )

    assert.equal(
      result.valid,
      false,
    )

    assert.deepEqual(
      result.errors,
      [
        {
          path:
            '$.children[0].fields.title',
          code: 'MIN_LENGTH',
          message:
            'Field "title" must have at least 3 characters.',
        },
      ],
    )
  },
)

test(
  'detects an invalid field type',
  () => {
    const page = createPage()

    page.children[0].fields.title =
      123

    const result =
      validateIncremental(
        page,
        schema,
        [[0]],
      )

    assert.equal(
      result.valid,
      false,
    )

    assert.deepEqual(
      result.errors,
      [
        {
          path:
            '$.children[0].fields.title',
          code: 'INVALID_TYPE',
          message:
            'Field "title" must be a string.',
        },
      ],
    )
  },
)

test(
  'detects an unknown component',
  () => {
    const page = createPage()

    page.children[0].type =
      'unknown'

    const result =
      validateIncremental(
        page,
        schema,
        [[0]],
      )

    assert.equal(
      result.valid,
      false,
    )

    assert.deepEqual(
      result.errors,
      [
        {
          path:
            '$.children[0].type',
          code: 'UNKNOWN_COMPONENT',
          message:
            'Unknown component type "unknown".',
        },
      ],
    )
  },
)

test(
  'validates child constraints on the selected node',
  () => {
    const page = createPage()

    page.children[0].children = [
      {
        id: 'invalid-child',
        type: 'page',
        fields: {
          title: 'Nested page',
        },
        children: [],
      },
    ]

    const result =
      validateIncremental(
        page,
        schema,
        [[0]],
      )

    assert.equal(
      result.valid,
      false,
    )

    assert.deepEqual(
      result.errors,
      [
        {
          path:
            '$.children[0].children[0]',
          code: 'CHILD_NOT_ALLOWED',
          message:
            'Child component "page" is not allowed here.',
        },
      ],
    )
  },
)

test(
  'does not recursively validate descendants',
  () => {
    const page = createPage()

    page.children[0]
      .children[0]
      .fields.content = undefined

    const result =
      validateIncremental(
        page,
        schema,
        [[0]],
      )

    assert.equal(
      result.valid,
      true,
    )

    assert.deepEqual(
      result.errors,
      [],
    )
  },
)

test(
  'validates multiple paths',
  () => {
    const page = createPage()

    page.children[0].fields.title =
      undefined

    page.children[1].fields.title =
      undefined

    const result =
      validateIncremental(
        page,
        schema,
        [
          [0],
          [1],
        ],
      )

    assert.equal(
      result.valid,
      false,
    )

    assert.deepEqual(
      result.errors,
      [
        {
          path:
            '$.children[0].fields.title',
          code: 'REQUIRED',
          message:
            'Field "title" is required.',
        },
        {
          path:
            '$.children[1].fields.title',
          code: 'REQUIRED',
          message:
            'Field "title" is required.',
        },
      ],
    )
  },
)

test(
  'ignores invalid paths',
  () => {
    const page = createPage()

    const result =
      validateIncremental(
        page,
        schema,
        [
          [99],
          [0, 99],
        ],
      )

    assert.equal(
      result.valid,
      true,
    )

    assert.deepEqual(
      result.errors,
      [],
    )
  },
)

test(
  'returns valid when the selected scope is valid',
  () => {
    const page = createPage()

    const result =
      validateIncremental(
        page,
        schema,
        [
          [],
          [0],
          [0, 0],
          [1],
        ],
      )

    assert.equal(
      result.valid,
      true,
    )

    assert.equal(
      result.errors.length,
      0,
    )
  },
)