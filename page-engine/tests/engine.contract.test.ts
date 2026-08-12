import assert from 'node:assert/strict'
import {
  readFileSync,
  readdirSync,
} from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  validatePage,
} from '../src'

import type {
  ComponentSchema,
  PageNode,
  ValidationResult,
} from '../src/types'

const ROOT = join(
  process.cwd(),
  'page-engine',
)

const SCHEMA_PATH = join(
  ROOT,
  'fixtures',
  '..',
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

function loadJson<T>(
  path: string,
): T {
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

function assertValid(
  result: ValidationResult,
): void {
  assert.equal(
    result.valid,
    true,
    `Expected page to be valid, got errors: ${JSON.stringify(result.errors)}`,
  )

  assert.deepEqual(
    result.errors,
    [],
  )
}

function assertInvalid(
  result: ValidationResult,
  code: string,
): void {
  assert.equal(
    result.valid,
    false,
  )

  assert.ok(
    result.errors.some(
      (error) => error.code === code,
    ),
    `Expected an error with code "${code}".`,
  )
}

function validateFixture(
  fixturePath: string,
): ValidationResult {
  const schema = loadSchema()
  const page = loadPage(fixturePath)

  return validatePage(
    page,
    schema,
  )
}

test(
  'accepts a valid page',
  () => {
    const fixture = join(
      FIXTURES_PATH,
      'page-small.json',
    )

    const result =
      validateFixture(fixture)

    assertValid(result)
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
    `rejects invalid fixture: ${fixtureName}`,
    () => {
      const fixture = join(
        INVALID_FIXTURES_PATH,
        fixtureName,
      )

      const result =
        validateFixture(fixture)

      assert.equal(
        result.valid,
        false,
      )

      assert.ok(
        result.errors.length > 0,
        `Expected "${fixtureName}" to contain validation errors.`,
      )
    },
  )
}