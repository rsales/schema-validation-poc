import type {
  ComponentDefinition,
  ComponentSchema,
  FieldDefinition,
  PageNode,
  ValidationError,
  ValidationResult,
} from './types'

export function validatePage(
  page: PageNode,
  schema: ComponentSchema,
): ValidationResult {
  const errors: ValidationError[] = []

  validateNode(page, schema, '$', errors)

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateNode(
  node: PageNode,
  schema: ComponentSchema,
  path: string,
  errors: ValidationError[],
): void {
  const component = schema.components[node.type]

  if (!component) {
    errors.push({
      path: `${path}.type`,
      code: 'UNKNOWN_COMPONENT',
      message: `Unknown component type "${node.type}".`,
    })

    return
  }

  validateFields(
    node.fields,
    component,
    `${path}.fields`,
    errors,
  )

  validateChildren(
    node.children,
    component,
    `${path}.children`,
    errors,
  )

  node.children.forEach((child, index) => {
    validateNode(
      child,
      schema,
      `${path}.children[${index}]`,
      errors,
    )
  })
}

function validateFields(
  fields: Record<string, unknown>,
  component: ComponentDefinition,
  path: string,
  errors: ValidationError[],
): void {
  for (const [fieldName, definition] of Object.entries(component.fields)) {
    const fieldPath = `${path}.${fieldName}`
    const value = fields[fieldName]

    if (value === undefined || value === null) {
      if (definition.required) {
        errors.push({
          path: fieldPath,
          code: 'REQUIRED',
          message: `Field "${fieldName}" is required.`,
        })
      }

      continue
    }

    validateField(
      value,
      fieldName,
      definition,
      fieldPath,
      errors,
    )
  }

  for (const fieldName of Object.keys(fields)) {
    if (!(fieldName in component.fields)) {
      errors.push({
        path: `${path}.${fieldName}`,
        code: 'UNKNOWN_FIELD',
        message: `Unknown field "${fieldName}".`,
      })
    }
  }
}

function validateField(
  value: unknown,
  fieldName: string,
  definition: FieldDefinition,
  path: string,
  errors: ValidationError[],
): void {
  switch (definition.type) {
    case 'string':
      validateString(
        value,
        fieldName,
        definition,
        path,
        errors,
      )
      break

    case 'number':
      validateNumber(
        value,
        fieldName,
        definition,
        path,
        errors,
      )
      break

    case 'enum':
      validateEnum(
        value,
        fieldName,
        definition,
        path,
        errors,
      )
      break
  }
}

function validateString(
  value: unknown,
  fieldName: string,
  definition: FieldDefinition,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof value !== 'string') {
    errors.push({
      path,
      code: 'INVALID_TYPE',
      message: `Field "${fieldName}" must be a string.`,
    })

    return
  }

  if (
    definition.minLength !== undefined &&
    value.length < definition.minLength
  ) {
    errors.push({
      path,
      code: 'MIN_LENGTH',
      message: `Field "${fieldName}" must have at least ${definition.minLength} characters.`,
    })
  }

  if (
    definition.maxLength !== undefined &&
    value.length > definition.maxLength
  ) {
    errors.push({
      path,
      code: 'MAX_LENGTH',
      message: `Field "${fieldName}" must have at most ${definition.maxLength} characters.`,
    })
  }

  if (definition.pattern !== undefined) {
    const regex = new RegExp(definition.pattern)

    if (!regex.test(value)) {
      errors.push({
        path,
        code: 'PATTERN',
        message: `Field "${fieldName}" does not match the required pattern.`,
      })
    }
  }
}

function validateNumber(
  value: unknown,
  fieldName: string,
  definition: FieldDefinition,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    errors.push({
      path,
      code: 'INVALID_TYPE',
      message: `Field "${fieldName}" must be a number.`,
    })

    return
  }

  if (
    definition.minimum !== undefined &&
    value < definition.minimum
  ) {
    errors.push({
      path,
      code: 'MINIMUM',
      message: `Field "${fieldName}" must be greater than or equal to ${definition.minimum}.`,
    })
  }

  if (
    definition.maximum !== undefined &&
    value > definition.maximum
  ) {
    errors.push({
      path,
      code: 'MAXIMUM',
      message: `Field "${fieldName}" must be less than or equal to ${definition.maximum}.`,
    })
  }
}

function validateEnum(
  value: unknown,
  fieldName: string,
  definition: FieldDefinition,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof value !== 'string') {
    errors.push({
      path,
      code: 'INVALID_TYPE',
      message: `Field "${fieldName}" must be a string.`,
    })

    return
  }

  if (
    definition.values !== undefined &&
    !definition.values.includes(value)
  ) {
    errors.push({
      path,
      code: 'INVALID_ENUM',
      message: `Field "${fieldName}" must be one of: ${definition.values.join(', ')}.`,
    })
  }
}

function validateChildren(
  children: PageNode[],
  component: ComponentDefinition,
  path: string,
  errors: ValidationError[],
): void {
  if (children.length < component.minChildren) {
    errors.push({
      path,
      code: 'MIN_CHILDREN',
      message: `Component must have at least ${component.minChildren} children.`,
    })
  }

  if (children.length > component.maxChildren) {
    errors.push({
      path,
      code: 'MAX_CHILDREN',
      message: `Component must have at most ${component.maxChildren} children.`,
    })
  }

  for (const [index, child] of children.entries()) {
    if (!component.allowedChildren.includes(child.type)) {
      errors.push({
        path: `${path}[${index}]`,
        code: 'CHILD_NOT_ALLOWED',
        message: `Child component "${child.type}" is not allowed here.`,
      })
    }
  }
}