import type {
  ComponentSchema,
  PageNode,
  ValidationResult,
} from './types'

import { validatePage } from './validator'

export interface ValidationEngine {
  validate(
    page: PageNode,
    schema: ComponentSchema,
  ): ValidationResult
}

export class TypeScriptValidationEngine
  implements ValidationEngine
{
  validate(
    page: PageNode,
    schema: ComponentSchema,
  ): ValidationResult {
    return validatePage(page, schema)
  }
}