import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  initSync,
  PageValidator,
} from '../wasm/page_engine.js'

import {
  loadPage,
  loadSchema,
} from '../benchmarks/fixtures'

const WASM_PATH = resolve(
  import.meta.dirname,
  '..',
  'wasm',
  'page_engine_bg.wasm',
)

const wasm = readFileSync(WASM_PATH)

initSync({
  module: wasm,
})

test('PageValidator validates page JSON', () => {
  const schema = loadSchema()
  const page = loadPage()

  const validator =
    new PageValidator(
      JSON.stringify(schema),
    )

  try {
    const result =
      validator.validate_json(
        JSON.stringify(page),
      )

    assert.equal(
      typeof result,
      'string',
    )

    const parsed =
      JSON.parse(result)

    assert.equal(
      parsed.valid,
      true,
    )
  } finally {
    validator.free()
  }
})

test('PageValidator loads and validates a resident page', () => {
  const schema = loadSchema()
  const page = loadPage()

  const validator =
    new PageValidator(
      JSON.stringify(schema),
    )

  try {
    const handle =
      validator.load_page(
        JSON.stringify(page),
      )

    try {
      const valid =
        validator.validate_resident(
          handle,
        )

      assert.equal(
        valid,
        true,
      )
    } finally {
      handle.free()
    }
  } finally {
    validator.free()
  }
})

test('PageValidator supports resident batch validation', () => {
  const schema = loadSchema()
  const page = loadPage()

  const validator =
    new PageValidator(
      JSON.stringify(schema),
    )

  try {
    const handle =
      validator.load_page(
        JSON.stringify(page),
      )

    try {
      const valid =
        validator.validate_resident_many(
          handle,
          10,
        )

      assert.equal(
        valid,
        true,
      )
    } finally {
      handle.free()
    }
  } finally {
    validator.free()
  }
})

test('PageValidator supports resident incremental validation', () => {
  const schema = loadSchema()
  const page = loadPage()

  const validator =
    new PageValidator(
      JSON.stringify(schema),
    )

  try {
    const handle =
      validator.load_page(
        JSON.stringify(page),
      )

    try {
      const change = {
        type: 'field_changed',
        path: [0],
      }

      const result =
        validator.validate_resident_incremental(
          handle,
          JSON.stringify(change),
        )

      assert.equal(
        typeof result,
        'string',
      )

      const parsed =
        JSON.parse(result)

      assert.equal(
        typeof parsed.valid,
        'boolean',
      )
    } finally {
      handle.free()
    }
  } finally {
    validator.free()
  }
})

test('PageValidator supports incremental profiling', () => {
  const schema = loadSchema()
  const page = loadPage()

  const validator =
    new PageValidator(
      JSON.stringify(schema),
    )

  try {
    const handle =
      validator.load_page(
        JSON.stringify(page),
      )

    try {
      const change = {
        type: 'field_changed',
        path: [0],
      }

      const result =
        validator.profile_resident_incremental(
          handle,
          JSON.stringify(change),
        )

      assert.equal(
        typeof result,
        'string',
      )

      const parsed =
        JSON.parse(result)

      assert.equal(
        typeof parsed,
        'object',
      )
    } finally {
      handle.free()
    }
  } finally {
    validator.free()
  }
})