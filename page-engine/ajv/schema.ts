import type {
  ComponentSchema,
  ComponentDefinition,
  FieldDefinition,
} from '../src/types'

export interface JsonSchema {
  $schema: string
  $defs: Record<string, unknown>
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
  [key: string]: unknown
}

function fieldToJsonSchema(
  field: FieldDefinition,
): Record<string, unknown> {
  switch (field.type) {
    case 'string':
      return {
        type: 'string',
        ...(field.minLength !== undefined && {
          minLength: field.minLength,
        }),
        ...(field.maxLength !== undefined && {
          maxLength: field.maxLength,
        }),
        ...(field.pattern !== undefined && {
          pattern: field.pattern,
        }),
      }

    case 'number':
      return {
        type: 'number',
        ...(field.minimum !== undefined && {
          minimum: field.minimum,
        }),
        ...(field.maximum !== undefined && {
          maximum: field.maximum,
        }),
      }

    case 'enum':
      return {
        enum: field.values,
      }

    default:
      throw new Error(
        `Unsupported field type: ${field.type}`,
      )
  }
}

function buildFieldsSchema(
  component: ComponentDefinition,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [fieldName, field] of Object.entries(
    component.fields,
  )) {
    properties[fieldName] = fieldToJsonSchema(field)

    if (field.required) {
      required.push(fieldName)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && {
      required,
    }),
    additionalProperties: false,
  }
}

function buildChildrenSchema(
  allowedChildren: string[],
): Record<string, unknown> {
  if (allowedChildren.length === 0) {
    return {
      type: 'array',
      items: false,
    }
  }

  return {
    type: 'array',

    items: {
      oneOf: allowedChildren.map((childName) => ({
        $ref: `#/$defs/${childName}`,
      })),
    },
  }
}

function componentToJsonSchema(
  name: string,
  component: ComponentDefinition,
): Record<string, unknown> {
  return {
    type: 'object',

    properties: {
      id: {
        type: 'string',
      },

      type: {
        const: name,
      },

      fields: buildFieldsSchema(component),

      children: {
        ...buildChildrenSchema(
          component.allowedChildren,
        ),

        minItems: component.minChildren,
        maxItems: component.maxChildren,
      },
    },

    required: [
      'id',
      'type',
      'fields',
      'children',
    ],

    additionalProperties: false,
  }
}

export function buildJsonSchema(
  schema: ComponentSchema,
): JsonSchema {
  const definitions: Record<string, unknown> = {}

  for (const [name, component] of Object.entries(
    schema.components,
  )) {
    definitions[name] =
      componentToJsonSchema(
        name,
        component,
      )
  }

  const page = schema.components.page

  if (!page) {
    throw new Error(
      'Page Engine schema must define a "page" component.',
    )
  }

  return {
    $schema:
      'https://json-schema.org/draft/2020-12/schema',

    $defs: definitions,

    type: 'object',

    properties: {
      id: {
        type: 'string',
      },

      type: {
        const: 'page',
      },

      fields: buildFieldsSchema(page),

      children: {
        ...buildChildrenSchema(
          page.allowedChildren,
        ),

        minItems: page.minChildren,
        maxItems: page.maxChildren,
      },
    },

    required: [
      'id',
      'type',
      'fields',
      'children',
    ],

    additionalProperties: false,
  }
}