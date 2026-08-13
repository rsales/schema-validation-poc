import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  validatePage as validateReferencePage,
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

const RUST_BINARY = join(
  ROOT,
  'rust',
  'target',
  'debug',
  'page-engine-validator',
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

function validateWithRust(
  page: PageNode,
  schema: ComponentSchema,
): ValidationResult {
  const input = JSON.stringify({
    schema,
    page,
  })

  const output = execFileSync(
    RUST_BINARY,
    {
      input,
      encoding: 'utf8',
    },
  )

  return JSON.parse(
    output,
  ) as ValidationResult
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

function normalizeErrors(
  result: ValidationResult,
): ValidationResult {
  return {
    valid: result.valid,

    errors: result.errors
      .map((error) => ({
        ...error,
        path: normalizePath(error.path),
      }))
      .sort((a, b) => {
        const path =
          a.path.localeCompare(b.path)

        if (path !== 0) {
          return path
        }

        const code =
          a.code.localeCompare(b.code)

        if (code !== 0) {
          return code
        }

        return a.message.localeCompare(
          b.message,
        )
      }),
  }
}

function assertParity(
  pagePath: string,
): void {
  const schema = loadSchema()
  const page = loadPage(pagePath)

  const reference =
    validateReferencePage(
      page,
      schema,
    )

  const rust =
    validateWithRust(
      page,
      schema,
    )

  assert.deepEqual(
    normalizeErrors(rust),
    normalizeErrors(reference),
  )
}

test(
  'Rust validator has parity for valid page',
  () => {
    const fixture = join(
      FIXTURES_PATH,
      'page-small.json',
    )

    const schema = loadSchema()
    const page = loadPage(fixture)

    const reference =
      validateReferencePage(
        page,
        schema,
      )

    const rust =
      validateWithRust(
        page,
        schema,
      )

    assert.equal(
      reference.valid,
      true,
    )

    assert.equal(
      rust.valid,
      true,
    )

    assert.deepEqual(
      normalizeErrors(rust),
      normalizeErrors(reference),
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
    `Rust validator has parity: ${fixtureName}`,
    () => {
      assertParity(
        join(
          INVALID_FIXTURES_PATH,
          fixtureName,
        ),
      )
    },
  )
}