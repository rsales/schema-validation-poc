# Page Engine Validation Contract

## Status

**Version:** 1.0  
**Status:** Experimental / Reference Contract  
**Scope:** `experiment/page-engine`

This document defines the validation contract for the Page Engine experiment.

The purpose of this contract is to establish a single, deterministic set of validation rules that every implementation must follow.

The implementations may differ internally, but they must produce equivalent validation results for the same page document and component schema.

The initial implementations planned for comparison are:

- TypeScript reference implementation
- AJV
- Rust native
- Rust compiled to WebAssembly

---

## 1. Goals

The Page Engine represents content as a hierarchical component tree.

The validator must validate:

1. Field-level constraints
2. Structural constraints

The validator must support deeply nested component trees so that the benchmark resembles a realistic Page Builder or Headless CMS workload.

The benchmark must measure equivalent work across all implementations.

---

## 2. Page Document Model

Every node follows this structure:

```json
{
  "id": "hero-1",
  "type": "hero",
  "fields": {},
  "children": []
}
```

| Property | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Unique identifier of the node |
| `type` | string | yes | Component type |
| `fields` | object | yes | Component-specific field values |
| `children` | array | yes | Nested component nodes |

### 2.1 `id`

`id` belongs to the node structure and is **not** a component field.

This avoids having two sources of truth such as:

```text
node.id
fields.id
```

---

## 3. Component Schema

The component schema defines the rules for each component type.

Location:

```text
page-engine/schema/component-schema.json
```

A component definition has:

```json
{
  "fields": {},
  "allowedChildren": [],
  "minChildren": 0,
  "maxChildren": 0
}
```

The root `components` object acts as the component registry.

If a node references a component type that does not exist in the registry, validation fails with:

```text
unknown_component
```

---

## 4. Field Validation

Supported field types:

```text
string
number
boolean
enum
```

Unknown fields must be rejected.

For example, if `button` does not define `color`, then:

```json
{
  "type": "button",
  "fields": {
    "color": "red"
  }
}
```

is invalid.

Error code:

```text
unknown_field
```

---

## 5. Required Fields

A field with:

```json
{
  "required": true
}
```

must exist in `fields`.

Error code:

```text
required
```

---

## 6. String Fields

String fields may define:

```text
required
minLength
maxLength
pattern
```

The value must be a string.

Invalid values produce:

```text
type
```

Length violations produce:

```text
minLength
maxLength
```

Pattern violations produce:

```text
pattern
```

Example:

```json
{
  "type": "string",
  "required": true,
  "minLength": 5,
  "maxLength": 80,
  "pattern": "^[a-z0-9-]+$"
}
```

---

## 7. Number Fields

Number fields may define:

```text
required
minimum
maximum
```

The value must be a number.

Type violations produce:

```text
type
```

Range violations produce:

```text
minimum
maximum
```

Example:

```json
{
  "type": "number",
  "required": true,
  "minimum": 1,
  "maximum": 12
}
```

---

## 8. Boolean Fields

Boolean fields must contain either:

```text
true
false
```

Any other value produces:

```text
type
```

No additional boolean constraints are currently defined.

---

## 9. Enum Fields

Enum fields define an explicit list of accepted values.

Example:

```json
{
  "type": "enum",
  "required": true,
  "values": [
    "primary",
    "secondary",
    "outline"
  ]
}
```

Values outside the list produce:

```text
enum
```

---

## 10. Child Validation

Components may define:

```text
allowedChildren
minChildren
maxChildren
```

These rules apply to direct children.

### 10.1 Allowed Children

Only component types listed in `allowedChildren` are permitted as direct children.

Violations produce:

```text
child_not_allowed
```

Nested descendants are validated independently according to their own component definitions.

### 10.2 Minimum Children

If:

```json
{
  "minChildren": 1
}
```

then an empty `children` array is invalid.

Error code:

```text
minChildren
```

### 10.3 Maximum Children

If:

```json
{
  "maxChildren": 4
}
```

then more than four direct children is invalid.

Error code:

```text
maxChildren
```

---

## 11. Recursive Validation

Validation is recursive.

For every node:

```text
1. Validate node structure
2. Resolve component definition
3. Validate fields
4. Validate direct child constraints
5. Recursively validate children
```

Traversal strategy is an implementation detail. Validation semantics must remain equivalent.

---

## 12. Validation Result

The canonical conceptual result is:

```json
{
  "valid": true,
  "errors": []
}
```

For an invalid document:

```json
{
  "valid": false,
  "errors": [
    {
      "path": "children[0].fields.title",
      "code": "minLength",
      "message": "..."
    }
  ]
}
```

Each error should contain:

| Property | Type | Description |
|---|---|---|
| `path` | string | Location of the invalid value |
| `code` | string | Machine-readable validation code |
| `message` | string | Human-readable explanation |

The `path` and `code` are the important machine-readable values.

---

## 13. Error Paths

Paths identify the exact location of invalid content.

Example:

```text
children[0].fields.title
```

Deep example:

```text
children[0].children[1].children[2].fields.url
```

This allows a CMS or Page Builder to identify exactly which field caused the failure.

---

## 14. Canonical Error Codes

The initial error vocabulary is:

```text
required
unknown_component
unknown_field
type
minLength
maxLength
minimum
maximum
pattern
enum
child_not_allowed
minChildren
maxChildren
```

Implementations may expose additional internal information, but results must be mappable to these canonical codes.

---

## 15. Valid Fixture

The current fixture:

```text
page-engine/fixtures/page-small.json
```

represents a valid document.

Its structure is:

```text
Page
└── Hero
    ├── Heading
    ├── Text
    └── Button
```

Expected result:

```json
{
  "valid": true,
  "errors": []
}
```

---

## 16. Invalid Fixtures

The implementation should eventually include invalid fixtures covering the major rules.

Examples:

| Scenario | Expected code |
|---|---|
| Missing required field | `required` |
| Unknown component | `unknown_component` |
| Unknown field | `unknown_field` |
| Invalid field type | `type` |
| String too short | `minLength` |
| String too long | `maxLength` |
| Number too small | `minimum` |
| Number too large | `maximum` |
| Invalid regex | `pattern` |
| Invalid enum | `enum` |
| Invalid child type | `child_not_allowed` |
| Too few children | `minChildren` |
| Too many children | `maxChildren` |

---

## 17. Strictness

The Page Engine uses strict validation.

The following are invalid:

- Unknown component types
- Unknown fields
- Missing required fields
- Invalid field types
- Invalid field constraints
- Invalid enum values
- Invalid child types
- Too few children
- Too many children

The validator must not silently ignore invalid content.

This is important because the Page Engine represents persisted CMS content.

---

## 18. Schema Initialization

The component schema is configuration, not page content.

The intended lifecycle is:

```text
Component Schema
       │
       ▼
Initialize validator
       │
       ▼
Validator ready
       │
       ├───────────────┐
       ▼               ▼
    Page A           Page B
       │               │
       ▼               ▼
   validate()       validate()
```

The benchmark should not repeatedly parse or compile the component schema for every validation.

Schema initialization cost should be measured separately when relevant.

---

## 19. Benchmark Contract

All implementations must validate the same page documents against the same component schema.

The following concerns must remain separate:

### Initialization

```text
Load schema
Parse schema
Compile schema
Build indexes
Allocate validator state
```

### Validation

```text
Validate an already initialized page
```

### Serialization / Interop

For example:

```text
JavaScript → WASM
WASM → JavaScript
```

These costs must not accidentally be reported as pure validation performance.

---

## 20. Reference Implementation

The first implementation should be a straightforward TypeScript validator.

Its purpose is not to win the benchmark.

Its purpose is to establish expected semantics.

The reference implementation should prioritize:

1. Correctness
2. Readability
3. Deterministic behavior
4. Structured errors

Once stable, other implementations can be compared against it.

---

## 21. Implementation Equivalence

Implementations are equivalent when they produce the same semantic result for the same input and component schema.

For example:

```text
Page + Component Schema
        │
        ▼
TypeScript Reference
        │
        ▼
Validation Result
```

must be semantically equivalent to:

```text
Page + Component Schema
        │
        ▼
AJV
        │
        ▼
Validation Result
```

and:

```text
Page + Component Schema
        │
        ▼
Rust / WASM
        │
        ▼
Validation Result
```

Internal architecture may differ.

Validation semantics must not.

---

## 22. Future Extensions

The following are intentionally outside V1:

- Conditional fields
- Cross-field validation
- Cross-component references
- Custom validation functions
- Async validation
- Localization
- Schema inheritance
- Component versioning
- Draft / published state validation
- Permissions
- Dependency-based field visibility
- Expression-based validation
- Custom formats

These may be introduced in later experiments.

---

## 23. V1 Definition of Done

- [ ] Pages can be recursively validated.
- [ ] Unknown components are rejected.
- [ ] Unknown fields are rejected.
- [ ] Required fields are validated.
- [ ] String constraints are validated.
- [ ] Number constraints are validated.
- [ ] Boolean fields are validated.
- [ ] Enum fields are validated.
- [ ] Regex patterns are validated.
- [ ] Allowed children are validated.
- [ ] Minimum children are validated.
- [ ] Maximum children are validated.
- [ ] Validation paths are reported.
- [ ] Canonical error codes are returned.
- [ ] `page-small.json` passes.
- [ ] Invalid fixtures exercise each validation rule.
- [ ] The same contract can be implemented by TypeScript, AJV, Rust Native, and Rust/WASM.

---

## 24. Guiding Principle

The objective of this experiment is not to prove that Rust or WebAssembly is faster.

The objective is to determine whether a compiled validation engine provides a meaningful advantage for complex, deeply nested Page Builder and Headless CMS workloads.

The benchmark must therefore compare equivalent work under controlled conditions.

**Performance is the result of the experiment, not an assumption.**
