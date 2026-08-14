import schema from '../schema/page.schema.json' with { type: 'json' }
import page from '../fixtures/page-small.json' with { type: 'json' }

import {
  init_validator,
  validate_page
} from '../rust/pkg/schema_validator.js'

const schemaJson = JSON.stringify(schema)
const pageJson = JSON.stringify(page)

init_validator(schemaJson)

const result = validate_page(pageJson)

console.log(
  'Rust/WASM validation:',
  result
)