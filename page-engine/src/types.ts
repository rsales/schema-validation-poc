export type FieldType =
  | 'string'
  | 'number'
  | 'enum'

export interface FieldDefinition {
  type: FieldType
  required?: boolean

  // String constraints
  minLength?: number
  maxLength?: number
  pattern?: string

  // Number constraints
  minimum?: number
  maximum?: number

  // Enum constraints
  values?: string[]
}

export interface ComponentDefinition {
  fields: Record<
    string,
    FieldDefinition
  >
  allowedChildren: string[]
  minChildren: number
  maxChildren: number
}

export interface ComponentSchema {
  components: Record<
    string,
    ComponentDefinition
  >
}

export interface PageNode {
  id: string
  type: string
  fields: Record<string, unknown>
  children: PageNode[]
}

export interface ValidationError {
  path: string
  code: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export type PageChange =
  | {
      type: 'field_changed'
      path: number[]
    }
  | {
      type: 'node_added'
      path: number[]
    }
  | {
      type: 'node_removed'
      path: number[]
    }
  | {
      type: 'node_moved'
      from: number[]
      to: number[]
    }