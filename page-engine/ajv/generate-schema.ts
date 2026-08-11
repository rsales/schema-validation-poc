import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ComponentSchema } from '../src/types'
import { buildJsonSchema } from './schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemaPath = resolve(
  __dirname,
  '../schema/component-schema.json',
)

const outputPath = resolve(
  __dirname,
  '../schema/page.schema.json',
)

function loadComponentSchema(): ComponentSchema {
  const source = readFileSync(
    schemaPath,
    'utf-8',
  )

  return JSON.parse(source) as ComponentSchema
}

function generate(): void {
  const componentSchema = loadComponentSchema()

  const jsonSchema = buildJsonSchema(
    componentSchema,
  )

  writeFileSync(
    outputPath,
    `${JSON.stringify(jsonSchema, null, 2)}\n`,
    'utf-8',
  )

  console.log(
    `Generated ${outputPath}`,
  )
}

generate()