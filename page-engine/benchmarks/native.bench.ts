import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(
  import.meta.dirname,
  '..',
)

const SCHEMA_PATH = resolve(
  ROOT,
  'schema',
  'component-schema.json',
)

const PAGE_PATH = resolve(
  ROOT,
  'fixtures',
  'page-small.json',
)

const schema = readFileSync(
  SCHEMA_PATH,
  'utf8',
)

const page = readFileSync(
  PAGE_PATH,
  'utf8',
)

console.log('Native Rust')
console.log('-----------')
console.log(`schema: ${schema.length} bytes`)
console.log(`page:   ${page.length} bytes`)