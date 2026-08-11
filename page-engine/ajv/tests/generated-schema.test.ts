import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test, describe } from 'node:test'

import Ajv2020 from 'ajv/dist/2020.js'

const schemaPath = resolve(
  'page-engine/schema/page.schema.json',
)

async function loadValidator() {
  const content = await readFile(
    schemaPath,
    'utf8',
  )

  const schema = JSON.parse(content)

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  })

  return ajv.compile(schema)
}

describe('Generated Page Schema', () => {
  test('accepts a valid page', async () => {
    const validate = await loadValidator()

    const page = {
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
          children: [],
        },
      ],
    }

    assert.equal(
      validate(page),
      true,
    )
  })

  test('rejects an unknown component', async () => {
    const validate = await loadValidator()

    const page = {
      id: 'page-1',
      type: 'page',
      fields: {},
      children: [
        {
          id: 'video-1',
          type: 'video',
          fields: {},
          children: [],
        },
      ],
    }

    assert.equal(
      validate(page),
      false,
    )
  })

  test('rejects a child that is not allowed', async () => {
    const validate = await loadValidator()

    const page = {
      id: 'page-1',
      type: 'page',
      fields: {},
      children: [
        {
          id: 'section-1',
          type: 'section',
          fields: {
            id: 'section-1',
          },
          children: [
            {
              id: 'container-1',
              type: 'container',
              fields: {},
              children: [],
            },
          ],
        },
      ],
    }

    assert.equal(
      validate(page),
      true,
    )

    const section = page.children[0]

    section.children = [
      {
        id: 'hero-1',
        type: 'hero',
        fields: {
          title: 'Hello',
          alignment: 'center',
        },
        children: [],
      },
    ]

    assert.equal(
      validate(page),
      false,
    )
  })

  test('rejects invalid field constraints', async () => {
    const validate = await loadValidator()

    const page = {
      id: 'page-1',
      type: 'page',
      fields: {},
      children: [
        {
          id: 'hero-1',
          type: 'hero',
          fields: {
            title: 'Hi',
            alignment: 'center',
          },
          children: [],
        },
      ],
    }

    assert.equal(
      validate(page),
      false,
    )
  })
})