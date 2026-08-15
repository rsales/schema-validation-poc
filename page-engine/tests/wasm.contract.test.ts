import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  validatePage as validateReferencePage,
} from '../src'

import type {
  ComponentSchema,
  PageNode,
  ValidationResult,
} from '../src/types'

import init, {
  PageValidator,
} from '../wasm/page_engine.js'

const ROOT = resolve(
  import.meta.dirname,
  '..',
)

const SCHEMA_PATH = resolve(
  ROOT,
  'schema',
  'component-schema.json',
)

const FIXTURES_PATH = resolve(
  ROOT,
  'fixtures',
)

const INVALID_FIXTURES_PATH = resolve(
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

async function loadWasm(): Promise<void> {
  const wasmPath = resolve(
    ROOT,
    'wasm',
    'page_engine_bg.wasm',
  )

  const wasm = readFileSync(
    wasmPath,
  )

  await init({
    module_or_path: wasm,
  })
}

function createValidator(
  schema: ComponentSchema,
): PageValidator {
  return new PageValidator(
    JSON.stringify(schema),
  )
}

function validateWithWasm(
  schema: ComponentSchema,
  page: PageNode,
): ValidationResult {
  const validator = createValidator(
    schema,
  )

  const result = validator.validate_data(
    JSON.stringify(page),
  )

  return JSON.parse(
    result,
  ) as ValidationResult
}

function validateIncrementalWithWasm(
  schema: ComponentSchema,
  page: PageNode,
  change: unknown,
): ValidationResult {
  const validator = createValidator(
    schema,
  )

  const result =
    validator.validate_incremental(
      JSON.stringify(page),
      JSON.stringify(change),
    )

  return JSON.parse(
    result,
  ) as ValidationResult
}

function validateResidentWithWasm(
  schema: ComponentSchema,
  page: PageNode,
): boolean {
  const validator = createValidator(
    schema,
  )

  const handle = validator.load_page(
    JSON.stringify(page),
  )

  return validator.validate_resident(
    handle,
  )
}

function validateResidentIncrementalWithWasm(
  schema: ComponentSchema,
  page: PageNode,
  change: unknown,
): ValidationResult {
  const validator = createValidator(
    schema,
  )

  const handle = validator.load_page(
    JSON.stringify(page),
  )

  const result =
    validator.validate_resident_incremental(
      handle,
      JSON.stringify(change),
    )

  return JSON.parse(
    result,
  ) as ValidationResult
}

function validateFixture(
  fixturePath: string,
): {
  reference: ValidationResult
  wasm: ValidationResult
} {
  const schema = loadSchema()
  const page = loadPage(fixturePath)

  return {
    reference:
      validateReferencePage(
        page,
        schema,
      ),

    wasm:
      validateWithWasm(
        schema,
        page,
      ),
  }
}

test.before(async () => {
  await loadWasm()
})

test(
  'WASM validator has parity for valid page',
  () => {
    const fixture = resolve(
      FIXTURES_PATH,
      'page-small.json',
    )

    const {
      reference,
      wasm,
    } = validateFixture(fixture)

    assert.equal(
      reference.valid,
      true,
    )

    assert.equal(
      wasm.valid,
      true,
    )

    assert.deepEqual(
      wasm,
      reference,
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
    `WASM validator has parity: ${fixtureName}`,
    () => {
      const fixture = resolve(
        INVALID_FIXTURES_PATH,
        fixtureName,
      )

      const {
        reference,
        wasm,
      } = validateFixture(fixture)

      assert.equal(
        reference.valid,
        false,
      )

      assert.equal(
        wasm.valid,
        false,
      )

      assert.deepEqual(
        wasm,
        reference,
      )
    },
  )
}

test(
  'WASM incremental validation has parity for field change',
  () => {
    const schema = loadSchema()
    const page = loadPage(
      resolve(
        FIXTURES_PATH,
        'page-small.json',
      ),
    )

    const change = {
      type: 'field_changed',
      path: [0, 0],
    }

    const expected =
      validateReferencePage(
        page,
        schema,
      )

    const actual =
      validateIncrementalWithWasm(
        schema,
        page,
        change,
      )

    assert.deepEqual(
      actual,
      expected,
    )
  },
)

test(
  'WASM resident validation matches full validation',
  () => {
    const schema = loadSchema()
    const page = loadPage(
      resolve(
        FIXTURES_PATH,
        'page-small.json',
      ),
    )

    const full =
      validateWithWasm(
        schema,
        page,
      )

    const resident =
      validateResidentWithWasm(
        schema,
        page,
      )

    assert.equal(
      resident,
      full.valid,
    )
  },
)

test(
  'WASM resident incremental validation has parity',
  () => {
    const schema = loadSchema()
    const page = loadPage(
      resolve(
        FIXTURES_PATH,
        'page-small.json',
      ),
    )

    const change = {
      type: 'field_changed',
      path: [0, 0],
    }

    const expected =
      validateReferencePage(
        page,
        schema,
      )

    const actual =
      validateResidentIncrementalWithWasm(
        schema,
        page,
        change,
      )

    assert.deepEqual(
      actual,
      expected,
    )
  },
)