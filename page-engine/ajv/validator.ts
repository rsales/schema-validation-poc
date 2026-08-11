import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js'

import type {
  ComponentSchema,
  PageNode,
  ValidationError,
  ValidationResult,
} from '../src/types'

import { buildJsonSchema } from './schema'

export class AjvPageValidator {
  private readonly validate: ValidateFunction
  private readonly schema: ComponentSchema

  constructor(schema: ComponentSchema) {
    this.schema = schema

    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
    })

    const jsonSchema = buildJsonSchema(schema)

    this.validate = ajv.compile(jsonSchema)
  }

  validatePage(page: PageNode): ValidationResult {
    const valid = this.validate(page)

    if (valid) {
      return {
        valid: true,
        errors: [],
      }
    }

    return {
      valid: false,
      errors: this.mapErrors(
        this.validate.errors ?? [],
        page,
      ),
    }
  }

  private mapErrors(
    errors: ErrorObject[],
    page: PageNode,
  ): ValidationError[] {
    return errors.map((error) => {
      const path = this.resolvePath(error)
      const code = this.resolveCode(error, page)

      return {
        path,
        code,
        message: this.resolveMessage(error, page),
      }
    })
  }

  private resolvePath(error: ErrorObject): string {
    if (error.keyword === 'required') {
      const missingProperty =
        typeof error.params?.missingProperty === 'string'
          ? error.params.missingProperty
          : undefined

      if (missingProperty) {
        return `${error.instancePath}.${missingProperty}`
      }
    }

    if (error.keyword === 'additionalProperties') {
      const additionalProperty =
        typeof error.params?.additionalProperty === 'string'
          ? error.params.additionalProperty
          : undefined

      if (additionalProperty) {
        return `${error.instancePath}.${additionalProperty}`
      }
    }

    return error.instancePath || '$'
  }

  private resolveCode(
    error: ErrorObject,
    page: PageNode,
  ): string {
    if (this.isChildCompositionError(error)) {
      const node = this.getNodeAtPath(
        page,
        error.instancePath,
      )

      if (
        node &&
        !this.schema.components[node.type]
      ) {
        return 'UNKNOWN_COMPONENT'
      }

      return 'CHILD_NOT_ALLOWED'
    }

    switch (error.keyword) {
      case 'required':
        return 'REQUIRED'

      case 'additionalProperties':
        return 'UNKNOWN_FIELD'

      case 'type':
        return 'TYPE'

      case 'const':
        return 'TYPE'

      case 'enum':
        return 'ENUM'

      case 'minLength':
        return 'MIN_LENGTH'

      case 'maxLength':
        return 'MAX_LENGTH'

      case 'pattern':
        return 'PATTERN'

      case 'minimum':
        return 'MINIMUM'

      case 'maximum':
        return 'MAXIMUM'

      case 'minItems':
        return 'MIN_CHILDREN'

      case 'maxItems':
        return 'MAX_CHILDREN'

      case 'oneOf':
        return 'UNKNOWN_COMPONENT'

      default:
        return error.keyword.toUpperCase()
    }
  }

  private resolveMessage(
    error: ErrorObject,
    page: PageNode,
  ): string {
    if (this.isChildCompositionError(error)) {
      const node = this.getNodeAtPath(
        page,
        error.instancePath,
      )

      if (
        node &&
        !this.schema.components[node.type]
      ) {
        return `Unknown component "${node.type}".`
      }

      return 'Child component is not allowed.'
    }

    switch (error.keyword) {
      case 'required':
        return `Missing required field "${error.params?.missingProperty}".`

      case 'additionalProperties':
        return `Unknown field "${error.params?.additionalProperty}".`

      case 'type':
        return `Expected type "${error.params?.type}".`

      case 'const':
        return `Value must equal "${error.params?.allowedValue}".`

      case 'enum':
        return `Value must be one of: ${(
          error.params?.allowedValues ?? []
        ).join(', ')}.`

      case 'minLength':
        return `String must contain at least ${error.params?.limit} characters.`

      case 'maxLength':
        return `String must contain at most ${error.params?.limit} characters.`

      case 'pattern':
        return 'String does not match the required pattern.'

      case 'minimum':
        return `Number must be greater than or equal to ${error.params?.comparison}.`

      case 'maximum':
        return `Number must be less than or equal to ${error.params?.comparison}.`

      case 'minItems':
        return `Component must contain at least ${error.params?.limit} children.`

      case 'maxItems':
        return `Component must contain at most ${error.params?.limit} children.`

      case 'oneOf':
        return 'Component type is not allowed.'

      default:
        return error.message ?? 'Validation failed.'
    }
  }

  private isChildCompositionError(
    error: ErrorObject,
  ): boolean {
    return (
      error.keyword === 'oneOf' &&
      this.isChildrenPath(error.instancePath)
    )
  }

  private isChildrenPath(
    instancePath: string,
  ): boolean {
    return /\/children\/\d+$/.test(instancePath)
  }

  private getNodeAtPath(
    page: PageNode,
    instancePath: string,
  ): PageNode | undefined {
    if (!instancePath) {
      return page
    }

    const segments = instancePath
      .split('/')
      .filter(Boolean)
      .map((segment) =>
        segment
          .replace(/~1/g, '/')
          .replace(/~0/g, '~'),
      )

    let current = page

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]

      if (segment !== 'children') {
        return undefined
      }

      const index = Number(segments[++i])

      if (!Number.isInteger(index)) {
        return undefined
      }

      const child = current.children[index]

      if (!child) {
        return undefined
      }

      current = child
    }

    return current
  }
}

export function createAjvValidator(
  schema: ComponentSchema,
): AjvPageValidator {
  return new AjvPageValidator(schema)
}

export function validatePage(
  page: PageNode,
  schema: ComponentSchema,
): ValidationResult {
  const validator = createAjvValidator(schema)

  return validator.validatePage(page)
}