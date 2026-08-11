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
        type: 'string',
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
    properties[fieldName] =
      fieldToJsonSchema(field)

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
  minChildren: number,
  maxChildren: number,
): Record<string, unknown> {
  const childSchema: Record<string, unknown> = {
    type: 'object',

    properties: {
      type: {
        enum: allowedChildren,
      },
    },

    required: ['type'],

    allOf: [
      {
        $ref: '#/$defs/node',
      },
    ],
  }

  return {
    type: 'array',

    items:
      allowedChildren.length > 0
        ? childSchema
        : false,

    minItems: minChildren,
    maxItems: maxChildren,
  }
}

function buildComponentConstraints(
  componentName: string,
  component: ComponentDefinition,
): Record<string, unknown> {
  return {
    if: {
      properties: {
        type: {
          const: componentName,
        },
      },

      required: ['type'],
    },

    then: {
      properties: {
        type: {
          const: componentName,
        },

        fields: buildFieldsSchema(component),

        children: buildChildrenSchema(
          component.allowedChildren,
          component.minChildren,
          component.maxChildren,
        ),
      },
    },
  }
}

function buildNodeSchema(
  schema: ComponentSchema,
): Record<string, unknown> {
  const componentNames =
    Object.keys(schema.components)

  return {
    type: 'object',

    properties: {
      id: {
        type: 'string',
      },

      type: {
        type: 'string',
        enum: componentNames,
      },

      fields: {
        type: 'object',
      },

      children: {
        type: 'array',
      },
    },

    required: [
      'id',
      'type',
      'fields',
      'children',
    ],

    additionalProperties: false,

    allOf: componentNames.map(
      (componentName) =>
        buildComponentConstraints(
          componentName,
          schema.components[componentName],
        ),
    ),
  }
}

export function buildJsonSchema(
  schema: ComponentSchema,
): JsonSchema {
  const page = schema.components.page

  if (!page) {
    throw new Error(
      'Page Engine schema must define a "page" component.',
    )
  }

  const nodeSchema =
    buildNodeSchema(schema)

  return {
    $schema:
      'https://json-schema.org/draft/2020-12/schema',

    $defs: {
      node: nodeSchema,
    },

    type: 'object',

    properties: {
      id: {
        type: 'string',
      },

      type: {
        const: 'page',
      },

      fields: buildFieldsSchema(page),

      children: buildChildrenSchema(
        page.allowedChildren,
        page.minChildren,
        page.maxChildren,
      ),
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