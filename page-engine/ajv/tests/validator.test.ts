import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, test } from 'node:test'

import {
  createAjvValidator,
} from '../validator'

import type {
  ComponentSchema,
  PageNode,
  ValidationResult,
} from '../../src/types'

const ROOT = resolve(
  import.meta.dirname,
  '../../..',
)

function loadJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(
      resolve(ROOT, relativePath),
      'utf8',
    ),
  ) as T
}

function loadSchema(): ComponentSchema {
  return loadJson<ComponentSchema>(
    'page-engine/schema/component-schema.json',
  )
}

function loadPage(
  fixture: string,
): PageNode {
  return loadJson<PageNode>(
    `page-engine/fixtures/${fixture}`,
  )
}

function validateFixture(
  fixture: string,
): ValidationResult {
  const schema = loadSchema()
  const page = loadPage(fixture)

  const validator = createAjvValidator(schema)

  return validator.validatePage(page)
}

function assertValid(
  fixture: string,
): void {
  const result = validateFixture(fixture)

  assert.equal(
    result.valid,
    true,
    `${fixture} should be valid`,
  )

  assert.deepEqual(
    result.errors,
    [],
    `${fixture} should not contain validation errors`,
  )
}

function assertInvalid(
  fixture: string,
  expectedCode: string,
): void {
  const result = validateFixture(fixture)

  assert.equal(
    result.valid,
    false,
    `${fixture} should be invalid`,
  )

  assert.ok(
    result.errors.some(
      (error) => error.code === expectedCode,
    ),
    `${fixture} should contain an error with code "${expectedCode}"`,
  )
}

describe('Page Engine AJV Validator', () => {
  describe('valid pages', () => {
    test('accepts the small page fixture', () => {
      assertValid('page-small.json')
    })
  })

  describe('component validation', () => {
    test('rejects an unknown component', () => {
      assertInvalid(
        'invalid/unknown-component.json',
        'UNKNOWN_COMPONENT',
      )
    })

    test('rejects an unknown field', () => {
      assertInvalid(
        'invalid/unknown-field.json',
        'UNKNOWN_FIELD',
      )
    })
  })

  describe('required fields', () => {
    test('rejects a missing required field', () => {
      assertInvalid(
        'invalid/missing-required-field.json',
        'REQUIRED',
      )
    })
  })

  describe('field types', () => {
    test('rejects an invalid field type', () => {
      assertInvalid(
        'invalid/invalid-type.json',
        'INVALID_TYPE',
      )
    })

    test('rejects an invalid enum value', () => {
      assertInvalid(
        'invalid/invalid-enum.json',
        'INVALID_ENUM',
      )
    })
  })

  describe('string constraints', () => {
    test('rejects a string below the minimum length', () => {
      assertInvalid(
        'invalid/string-min-length.json',
        'MIN_LENGTH',
      )
    })

    test('rejects a string above the maximum length', () => {
      assertInvalid(
        'invalid/string-max-length.json',
        'MAX_LENGTH',
      )
    })

    test('rejects a string that does not match the pattern', () => {
      assertInvalid(
        'invalid/invalid-pattern.json',
        'PATTERN',
      )
    })
  })

  describe('number constraints', () => {
    test('rejects a number below the minimum', () => {
      assertInvalid(
        'invalid/number-minimum.json',
        'MINIMUM',
      )
    })

    test('rejects a number above the maximum', () => {
      assertInvalid(
        'invalid/number-maximum.json',
        'MAXIMUM',
      )
    })
  })

  describe('children constraints', () => {
    test('rejects a child that is not allowed', () => {
      assertInvalid(
        'invalid/child-not-allowed.json',
        'CHILD_NOT_ALLOWED',
      )
    })

    test('rejects too few children', () => {
      assertInvalid(
        'invalid/min-children.json',
        'MIN_CHILDREN',
      )
    })

    test('rejects too many children', () => {
      assertInvalid(
        'invalid/max-children.json',
        'MAX_CHILDREN',
      )
    })
  })
})