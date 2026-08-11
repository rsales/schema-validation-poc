import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, it} from 'node:test'

import {
  validatePage,
  type ValidationResult,
} from '../validator'

const FIXTURES_DIR = resolve(
  import.meta.dirname,
  '../../fixtures',
)

function loadJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, relativePath), 'utf-8'),
  ) as T
}

function loadPage(relativePath: string): unknown {
  return loadJson(relativePath)
}

function assertValid(result: ValidationResult): void {
  assert.equal(
    result.valid,
    true,
    `Expected fixture to be valid, got errors: ${JSON.stringify(result.errors)}`,
  )

  assert.deepEqual(result.errors, [])
}

function assertInvalid(
  result: ValidationResult,
  code: string,
): void {
  assert.equal(result.valid, false)

  assert.ok(
    result.errors.some((error) => error.code === code),
    `Fixture should contain an error with code "${code}"`,
  )
}

describe('Page Engine AJV Validator', () => {
  describe('valid pages', () => {
    it('accepts the small page fixture', () => {
      const page = loadPage('page-small.json')
      const result = validatePage(page)

      assertValid(result)
    })
  })

  describe('component validation', () => {
    it('rejects an unknown component', () => {
      const page = loadPage('invalid/unknown-component.json')
      const result = validatePage(page)

      assertInvalid(result, 'UNKNOWN_COMPONENT')
    })

    it('rejects an unknown field', () => {
      const page = loadPage('invalid/unknown-field.json')
      const result = validatePage(page)

      assertInvalid(result, 'UNKNOWN_FIELD')
    })
  })

  describe('required fields', () => {
    it('rejects a missing required field', () => {
      const page = loadPage('invalid/missing-required-field.json')
      const result = validatePage(page)

      assertInvalid(result, 'REQUIRED')
    })
  })

  describe('field types', () => {
    it('rejects an invalid field type', () => {
      const page = loadPage('invalid/invalid-type.json')
      const result = validatePage(page)

      assertInvalid(result, 'INVALID_TYPE')
    })

    it('rejects an invalid enum value', () => {
      const page = loadPage('invalid/invalid-enum.json')
      const result = validatePage(page)

      assertInvalid(result, 'INVALID_ENUM')
    })
  })

  describe('string constraints', () => {
    it('rejects a string below the minimum length', () => {
      const page = loadPage('invalid/string-min-length.json')
      const result = validatePage(page)

      assertInvalid(result, 'MIN_LENGTH')
    })

    it('rejects a string above the maximum length', () => {
      const page = loadPage('invalid/string-max-length.json')
      const result = validatePage(page)

      assertInvalid(result, 'MAX_LENGTH')
    })

    it('rejects a string that does not match the pattern', () => {
      const page = loadPage('invalid/invalid-pattern.json')
      const result = validatePage(page)

      assertInvalid(result, 'PATTERN')
    })
  })

  describe('number constraints', () => {
    it('rejects a number below the minimum', () => {
      const page = loadPage('invalid/number-minimum.json')
      const result = validatePage(page)

      assertInvalid(result, 'MINIMUM')
    })

    it('rejects a number above the maximum', () => {
      const page = loadPage('invalid/number-maximum.json')
      const result = validatePage(page)

      assertInvalid(result, 'MAXIMUM')
    })
  })

  describe('children constraints', () => {
    it('rejects a child that is not allowed', () => {
      const page = loadPage('invalid/child-not-allowed.json')
      const result = validatePage(page)

      assertInvalid(result, 'CHILD_NOT_ALLOWED')
    })

    it('rejects too few children', () => {
      const page = loadPage('invalid/min-children.json')
      const result = validatePage(page)

      assertInvalid(result, 'MIN_CHILDREN')
    })

    it('rejects too many children', () => {
      const page = loadPage('invalid/max-children.json')
      const result = validatePage(page)

      assertInvalid(result, 'MAX_CHILDREN')
    })
  })
})