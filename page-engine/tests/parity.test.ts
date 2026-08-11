import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  validatePage as validateReferencePage,
} from '../src'

import {
  validatePage as validateAjvPage,
} from '../ajv/validator'

import type {
  ComponentSchema,
  PageNode,
  ValidationError,
  ValidationResult,
} from '../src/types'

const ROOT = join(
  process.cwd(),
  'page-engine',
)

const SCHEMA_PATH = join(
  ROOT,
  'schema',
  'component-schema.json',
)

const FIXTURES_PATH = join(
  ROOT,
  'fixtures',
)

const INVALID_FIXTURES_PATH = join(
  FIXTURES_PATH,
  'invalid',
)

function loadJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(path, 'utf8'),
  ) as T
}

function loadSchema(): ComponentSchema {
  return loadJson<ComponentSchema>(
    SCHEMA_PATH,
  )
}

function loadPage(
  path: string,
): PageNode {
  return loadJson<PageNode>(path)
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

function normalizeError(
  error: ValidationError,
): ValidationError {
  return {
    ...error,
    path: normalizePath(error.path),
  }
}

function normalizeErrors(
  result: ValidationResult,
): ValidationError[] {
  return result.errors
    .map(normalizeError)
    .sort(compareErrors)
}

function compareErrors(
  a: ValidationError,
  b: ValidationError,
): number {
  const pathComparison =
    a.path.localeCompare(b.path)

  if (pathComparison !== 0) {
    return pathComparison
  }

  const codeComparison =
    a.code.localeCompare(b.code)

  if (codeComparison !== 0) {
    return codeComparison
  }

  return a.message.localeCompare(b.message)
}

function semanticErrors(
  result: ValidationResult,
): ValidationError[] {
  return normalizeErrors(result)
}

function summarize(
  result: ValidationResult,
): ValidationResult {
  return {
    valid: result.valid,
    errors: semanticErrors(result),
  }
}

function validateFixture(
  fixturePath: string,
): {
  reference: ValidationResult
  ajv: ValidationResult
} {
  const schema = loadSchema()
  const page = loadPage(fixturePath)

  return {
    reference:
      validateReferencePage(
        page,
        schema,
      ),

    ajv:
      validateAjvPage(
        page,
        schema,
      ),
  }
}

test(
  'valid fixture has parity: page-small.json',
  () => {
    const fixture = join(
      FIXTURES_PATH,
      'page-small.json',
    )

    const {
      reference,
      ajv,
    } = validateFixture(fixture)

    assert.equal(
      reference.valid,
      true,
    )

    assert.equal(
      ajv.valid,
      true,
    )

    assert.deepEqual(
      summarize(ajv),
      summarize(reference),
    )
  },
)

const invalidFixtures =
  readdirSync(INVALID_FIXTURES_PATH)
    .filter(
      (file) =>
        file.endsWith('.json'),
    )
    .sort()

for (const fixtureName of invalidFixtures) {
  test(
    `invalid fixture has parity: ${fixtureName}`,
    () => {
      const fixture = join(
        INVALID_FIXTURES_PATH,
        fixtureName,
      )

      const {
        reference,
        ajv,
      } = validateFixture(fixture)

      assert.equal(
        reference.valid,
        false,
      )

      assert.equal(
        ajv.valid,
        false,
      )

      assert.deepEqual(
        summarize(ajv),
        summarize(reference),
      )
    },
  )
}