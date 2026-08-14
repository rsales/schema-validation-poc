import Ajv from 'ajv'
import schema from '../../schema/page.schema.json' with { type: 'json' }

const ajv = new Ajv({
  allErrors: true
})

const validate = ajv.compile(schema)

export function validatePage(page: unknown): boolean {
  return validate(page)
}