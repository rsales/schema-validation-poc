import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type {
  ComponentSchema,
  PageNode,
} from '../src/types'

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

function loadJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(path, 'utf8'),
  ) as T
}

export function loadSchema(): ComponentSchema {
  return loadJson<ComponentSchema>(
    SCHEMA_PATH,
  )
}

export function loadPage(): PageNode {
  return loadJson<PageNode>(
    PAGE_PATH,
  )
}