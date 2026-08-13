import Ajv2020 from 'ajv/dist/2020.js'

import {
  loadPage,
  loadSchema,
} from './fixtures'

import { buildJsonSchema } from '../ajv/schema'

const schema = loadSchema()
const page = loadPage()

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
})

const jsonSchema = buildJsonSchema(schema)

const validate = ajv.compile(jsonSchema)

const ITERATIONS = 100_000

// Warm-up
for (let i = 0; i < 10_000; i++) {
  validate(page)
}

const start = performance.now()

for (let i = 0; i < ITERATIONS; i++) {
  validate(page)
}

const elapsed = performance.now() - start

console.log('')
console.log('AJV')
console.log('---')
console.log(`iterations: ${ITERATIONS}`)
console.log(`total:      ${elapsed.toFixed(2)} ms`)
console.log(
  `avg:        ${(elapsed / ITERATIONS).toFixed(6)} ms`,
)
console.log(
  `throughput: ${(ITERATIONS / (elapsed / 1000)).toFixed(0)} validations/sec`,
)