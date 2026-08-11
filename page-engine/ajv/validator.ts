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
      discriminator: true,
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
    return errors.flatMap((error) => {
      if (this.isUnknownComponentError(error, page)) {
        const node = this.getNodeAtPath(
          page,
          error.instancePath,
        )

        if (!node) {
          return []
        }

        return [
          {
            path: error.instancePath,
            code: 'CHILD_NOT_ALLOWED',
            message: `Child component "${node.type}" is not allowed here.`,
          },
          {
            path: `${error.instancePath}/type`,
            code: 'UNKNOWN_COMPONENT',
            message: `Unknown component type "${node.type}".`,
          },
        ]
      }

      return [
        {
          path: this.resolvePath(error),
          code: this.resolveCode(error, page),
          message: this.resolveMessage(error, page),
        },
      ]
    })
  }

  private resolvePath(error: ErrorObject): string {
    if (error.keyword === 'required') {
      const missingProperty =
        typeof error.params?.missingProperty === 'string'
          ? error.params.missingProperty
          : undefined

      if (missingProperty) {
        return `${error.instancePath}/${missingProperty}`
      }
    }

    if (error.keyword === 'additionalProperties') {
      const additionalProperty =
        typeof error.params?.additionalProperty === 'string'
          ? error.params?.additionalProperty
          : undefined

      if (additionalProperty) {
        return `${error.instancePath}/${additionalProperty}`
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
        return 'INVALID_TYPE'

      case 'enum':
        return 'INVALID_ENUM'

      case 'const':
        return 'INVALID_VALUE'

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

      case 'discriminator':
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

      if (!node) {
        return 'Child component is not allowed.'
      }

      if (!this.schema.components[node.type]) {
        return `Unknown component "${node.type}".`
      }

      return `Child component "${node.type}" is not allowed here.`
    }

    switch (error.keyword) {
      case 'required':
        return `Field "${error.params?.missingProperty}" is required.`

      case 'additionalProperties':
        return `Unknown field "${error.params?.additionalProperty}".`

      case 'type': {
        const field = this.getFieldName(error)
        const type = error.params?.type

        if (field) {
          return `Field "${field}" must be a ${type}.`
        }

        return `Value must be a ${type}.`
      }

      case 'enum': {
        const field = this.getFieldName(error)

        const values = (
          error.params?.allowedValues ?? []
        ).join(', ')

        if (field) {
          return `Field "${field}" must be one of: ${values}.`
        }

        return `Value must be one of: ${values}.`
      }

      case 'minLength': {
        const field = this.getFieldName(error)
        const limit = error.params?.limit

        if (field) {
          return `Field "${field}" must have at least ${limit} characters.`
        }

        return `String must contain at least ${limit} characters.`
      }

      case 'maxLength': {
        const field = this.getFieldName(error)
        const limit = error.params?.limit

        if (field) {
          return `Field "${field}" must have at most ${limit} characters.`
        }

        return `String must contain at most ${limit} characters.`
      }

      case 'pattern': {
        const field = this.getFieldName(error)

        if (field) {
          return `Field "${field}" does not match the required pattern.`
        }

        return 'String does not match the required pattern.'
      }

      case 'minimum': {
        const field = this.getFieldName(error)
        const limit = error.params?.limit

        if (field) {
          return `Field "${field}" must be greater than or equal to ${limit}.`
        }

        return `Number must be greater than or equal to ${limit}.`
      }

      case 'maximum': {
        const field = this.getFieldName(error)
        const limit = error.params?.limit

        if (field) {
          return `Field "${field}" must be less than or equal to ${limit}.`
        }

        return `Number must be less than or equal to ${limit}.`
      }

      case 'minItems':
        return `Component must have at least ${error.params?.limit} children.`

      case 'maxItems':
        return `Component must have at most ${error.params?.limit} children.`

      case 'discriminator':
        return 'Component type is not allowed.'

      case 'oneOf':
        return 'Component type is not allowed.'

      default:
        return error.message ?? 'Validation failed.'
    }
  }

  private getFieldName(
    error: ErrorObject,
  ): string | undefined {
    const segments = error.instancePath
      .split('/')
      .filter(Boolean)

    const fieldsIndex = segments.indexOf('fields')

    if (fieldsIndex === -1) {
      return undefined
    }

    return segments[fieldsIndex + 1]
  }

  private isUnknownComponentError(
    error: ErrorObject,
    page: PageNode,
  ): boolean {
    if (
      error.keyword !== 'discriminator' &&
      error.keyword !== 'oneOf'
    ) {
      return false
    }

    const node = this.getNodeAtPath(
      page,
      error.instancePath,
    )

    return !!node && !this.schema.components[node.type]
  }

  private isChildCompositionError(
    error: ErrorObject,
  ): boolean {
    return (
      (
        error.keyword === 'oneOf' ||
        error.keyword === 'discriminator'
      ) &&
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