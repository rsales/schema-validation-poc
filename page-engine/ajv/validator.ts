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

    const errors = this.mapErrors(
      this.validate.errors ?? [],
      page,
    )

    return {
      valid: false,
      errors,
    }
  }

  private mapErrors(
    errors: ErrorObject[],
    page: PageNode,
  ): ValidationError[] {
    /*
     * The generated JSON Schema is intentionally an implementation
     * detail. AJV can produce multiple low-level errors for a single
     * semantic Page Engine error.
     *
     * Therefore we first resolve structural/component errors and then
     * map the remaining field-level AJV errors.
     */

    const structuralErrors =
      this.resolveStructuralErrors(page)

    if (structuralErrors.length > 0) {
      return structuralErrors
    }

    return this.mapFieldErrors(errors)
  }

  /**
   * Resolves the semantic component tree before exposing AJV's
   * low-level errors.
   *
   * This prevents errors such as:
   *
   *   required
   *   additionalProperties
   *   const
   *   false schema
   *
   * from different schema branches being reported together when
   * the real problem is simply that a child component is invalid
   * in its current position.
   */
  private resolveStructuralErrors(
    page: PageNode,
  ): ValidationError[] {
    const errors: ValidationError[] = []

    this.walkNode(
      page,
      '',
      errors,
    )

    return errors
  }

  private walkNode(
    node: PageNode,
    path: string,
    errors: ValidationError[],
  ): void {
    const component = this.schema.components[node.type]

    /*
     * Unknown component.
     *
     * This is intentionally resolved before checking fields/children.
     * Otherwise AJV can report all fields from every possible schema
     * branch.
     */
    if (!component) {
      errors.push({
        path: `${path}/type`,
        code: 'UNKNOWN_COMPONENT',
        message: `Unknown component type "${node.type}".`,
      })

      return
    }

    /*
     * Check the component's own fields first.
     *
     * We only do this here for structural errors. Actual field
     * constraints remain delegated to AJV.
     */

    const fields = node.fields ?? {}

    for (const fieldName of Object.keys(fields)) {
      if (!component.fields[fieldName]) {
        errors.push({
          path: `${path}/fields/${fieldName}`,
          code: 'UNKNOWN_FIELD',
          message: `Unknown field "${fieldName}".`,
        })
      }
    }

    /*
     * Required fields.
     *
     * AJV also reports these, but handling them here gives us a
     * deterministic semantic error and prevents unrelated schema
     * branches from leaking into the result.
     */
    for (const [
      fieldName,
      field,
    ] of Object.entries(component.fields)) {
      if (
        field.required &&
        !(fieldName in fields)
      ) {
        errors.push({
          path: `${path}/fields/${fieldName}`,
          code: 'REQUIRED',
          message: `Field "${fieldName}" is required.`,
        })
      }
    }

    /*
     * Children constraints.
     */
    const children = node.children ?? []

    if (
      component.minChildren !== undefined &&
      children.length < component.minChildren
    ) {
      errors.push({
        path: `${path}/children`,
        code: 'MIN_CHILDREN',
        message: `Component must have at least ${component.minChildren} children.`,
      })
    }

    if (
      component.maxChildren !== undefined &&
      children.length > component.maxChildren
    ) {
      errors.push({
        path: `${path}/children`,
        code: 'MAX_CHILDREN',
        message: `Component must have at most ${component.maxChildren} children.`,
      })
    }

    /*
     * Validate child composition.
     *
     * This is the important part for:
     *
     * child-not-allowed.json
     */
    for (
      let index = 0;
      index < children.length;
      index++
    ) {
      const child = children[index]
      const childPath = `${path}/children/${index}`

      if (
        !component.allowedChildren.includes(
          child.type,
        )
      ) {
        if (this.schema.components[child.type]) {
          errors.push({
            path: childPath,
            code: 'CHILD_NOT_ALLOWED',
            message: `Child component "${child.type}" is not allowed here.`,
          })
        } else {
          errors.push({
            path: childPath,
            code: 'CHILD_NOT_ALLOWED',
            message: `Child component "${child.type}" is not allowed here.`,
          })

          errors.push({
            path: `${childPath}/type`,
            code: 'UNKNOWN_COMPONENT',
            message: `Unknown component type "${child.type}".`,
          })
        }

        /*
         * Do not recursively validate a child whose component type
         * is not valid in this location.
         *
         * Otherwise we get noise from the child's schema such as
         * required fields from completely unrelated components.
         */
        continue
      }

      /*
       * The child is structurally valid in this location, so recurse.
       */
      this.walkNode(
        child,
        childPath,
        errors,
      )
    }
  }

  /**
   * Maps AJV errors that remain after structural resolution.
   *
   * At this point we expect field-level errors such as:
   *
   *   minLength
   *   maxLength
   *   pattern
   *   minimum
   *   maximum
   *   enum
   *   type
   */
  private mapFieldErrors(
    errors: ErrorObject[],
  ): ValidationError[] {
    return errors
      .filter((error) =>
        this.isRelevantFieldError(error),
      )
      .map((error) => ({
        path: this.resolvePath(error),
        code: this.resolveCode(error),
        message: this.resolveMessage(error),
      }))
  }

  private isRelevantFieldError(
    error: ErrorObject,
  ): boolean {
    switch (error.keyword) {
      case 'required':
      case 'additionalProperties':
      case 'type':
      case 'enum':
      case 'minLength':
      case 'maxLength':
      case 'pattern':
      case 'minimum':
      case 'maximum':
        return true

      default:
        return false
    }
  }

  private resolvePath(
    error: ErrorObject,
  ): string {
    if (error.keyword === 'required') {
      const missingProperty =
        typeof error.params?.missingProperty === 'string'
          ? error.params.missingProperty
          : undefined

      if (missingProperty) {
        return `${error.instancePath}/${missingProperty}`
      }
    }

    if (
      error.keyword ===
      'additionalProperties'
    ) {
      const additionalProperty =
        typeof error.params?.additionalProperty ===
        'string'
          ? error.params.additionalProperty
          : undefined

      if (additionalProperty) {
        return `${error.instancePath}/${additionalProperty}`
      }
    }

    return error.instancePath || '$'
  }

  private resolveCode(
    error: ErrorObject,
  ): string {
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

      default:
        return error.keyword.toUpperCase()
    }
  }

  private resolveMessage(
    error: ErrorObject,
  ): string {
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

    const fieldsIndex =
      segments.indexOf('fields')

    if (fieldsIndex === -1) {
      return undefined
    }

    return segments[fieldsIndex + 1]
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
  const validator =
    createAjvValidator(schema)

  return validator.validatePage(page)
}