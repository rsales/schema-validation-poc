import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

import {
  validatePage,
  type ComponentSchema,
  type PageNode,
  type ValidationResult,
} from '../src/index'

const ROOT = resolve(import.meta.dirname, '../..')

function loadJson<T>(relativePath: string): T {
  const filePath = resolve(ROOT, relativePath)
  const content = readFileSync(filePath, 'utf-8')

  return JSON.parse(content) as T
}

function loadSchema(): ComponentSchema {
  return loadJson<ComponentSchema>(
    'page-engine/schema/component-schema.json',
  )
}

function loadPage(relativePath: string): PageNode {
  return loadJson<PageNode>(relativePath)
}

function validateFixture(
  fixture: string,
): ValidationResult {
  const schema = loadSchema()
  const page = loadPage(fixture)

  return validatePage(page, schema)
}

function assertInvalid(
  fixture: string,
  expectedCode: string,
  expectedPath?: string,
): void {
  const result = validateFixture(fixture)

  assert.equal(
    result.valid,
    false,
    `${fixture} should be invalid`,
  )

  const error = result.errors.find(
    (item) => item.code === expectedCode,
  )

  assert.ok(
    error,
    `${fixture} should contain an error with code "${expectedCode}"`,
  )

  if (expectedPath !== undefined) {
    assert.equal(error.path, expectedPath)
  }
}

describe('Page Engine Reference Validator', () => {
  describe('valid pages', () => {
    it('accepts the small page fixture', () => {
      const result = validateFixture(
        'page-engine/fixtures/page-small.json',
      )

      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })
  })

  describe('component validation', () => {
    it('rejects an unknown component', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/unknown-component.json',
        'UNKNOWN_COMPONENT',
        '$.children[0].type',
      )
    })

    it('rejects an unknown field', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/unknown-field.json',
        'UNKNOWN_FIELD',
      )
    })
  })

  describe('required fields', () => {
    it('rejects a missing required field', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/missing-required-field.json',
        'REQUIRED',
      )
    })
  })

  describe('field types', () => {
    it('rejects an invalid field type', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/invalid-type.json',
        'INVALID_TYPE',
      )
    })

    it('rejects an invalid enum value', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/invalid-enum.json',
        'INVALID_ENUM',
      )
    })
  })

  describe('string constraints', () => {
    it('rejects a string below the minimum length', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/string-min-length.json',
        'MIN_LENGTH',
      )
    })

    it('rejects a string above the maximum length', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/string-max-length.json',
        'MAX_LENGTH',
      )
    })

    it('rejects a string that does not match the pattern', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/invalid-pattern.json',
        'PATTERN',
      )
    })
  })

  describe('number constraints', () => {
    it('rejects a number below the minimum', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/number-minimum.json',
        'MINIMUM',
      )
    })

    it('rejects a number above the maximum', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/number-maximum.json',
        'MAXIMUM',
      )
    })
  })

  describe('children constraints', () => {
    it('rejects a child that is not allowed', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/child-not-allowed.json',
        'CHILD_NOT_ALLOWED',
      )
    })

    it('rejects too few children', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/min-children.json',
        'MIN_CHILDREN',
      )
    })

    it('rejects too many children', () => {
      assertInvalid(
        'page-engine/fixtures/invalid/max-children.json',
        'MAX_CHILDREN',
      )
    })
  })
})