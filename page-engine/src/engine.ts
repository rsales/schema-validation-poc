import type {
  ComponentSchema,
  PageChange,
  PageNode,
  ValidationResult,
} from './types'

import {validatePage} from './validator'

export interface ValidationEngine {
  validate(
    page: PageNode,
    schema: ComponentSchema,
  ): ValidationResult

  validateIncremental(
    page: PageNode,
    schema: ComponentSchema,
    change: PageChange,
  ): ValidationResult
}

export class TypeScriptValidationEngine
  implements ValidationEngine
{
  validate(
    page: PageNode,
    schema: ComponentSchema,
  ): ValidationResult {
    return validatePage(
      page,
      schema,
    )
  }

  validateIncremental(
    page: PageNode,
    schema: ComponentSchema,
    _change: PageChange,
  ): ValidationResult {
    return this.validate(
      page,
      schema,
    )
  }
}