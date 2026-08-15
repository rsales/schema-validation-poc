# Page Engine Validation Contract

## Status

**Version:** 1.1  
**Status:** Experimental / Reference Contract  
**Scope:** `page-engine`

This document defines the semantic validation contract for the Page Engine experiment.

The purpose of this contract is to establish a deterministic set of validation rules that every validation implementation must follow.

Implementations may differ internally, but they must produce equivalent semantic validation results for the same page document and component schema.

Current implementations and validation paths include:

- TypeScript / AJV reference validation
- Rust native validation
- Rust compiled to WebAssembly
- Resident WASM validation
- Incremental WASM validation

---

## 1. Goals

The Page Engine represents content as a hierarchical component tree.

The validator must validate:

1. Field-level constraints
2. Component-level constraints
3. Structural constraints
4. Recursive child relationships
5. Precise validation paths
6. Deterministic validation results

The same validation contract must be usable by multiple runtimes so that correctness and performance can be compared independently.

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

A component definition has the following conceptual structure:

```json
{
  "fields": {},
  "allowedChildren": [],
  "minChildren": 0,
  "maxChildren": 0
}
```

The root `components` object acts as the component registry.

If a node references a component type that does not exist in the registry, validation fails.

---

## 4. Field Validation

Supported field types are:

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

Canonical error code:

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

Canonical error code:

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

Traversal strategy is an implementation detail.

Validation semantics must remain equivalent.

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

For incremental validation, paths are also used to associate validation errors with the affected node or scope.

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

The canonical valid fixture is:

```text
page-engine/fixtures/page-small.json
```

Its representative structure is:

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

The canonical fixture suite currently contains one valid page and thirteen invalid scenarios.

The invalid fixtures isolate the following primary validation rules:

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

See [`02-fixtures.md`](./02-fixtures.md) for the complete fixture documentation.

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

The benchmark must not repeatedly parse or compile the component schema for every validation.

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

The current benchmark suite explicitly explores these boundaries through:

- compiled WASM validation
- resident page validation
- internal validation loops
- staged parsing / validation / serialization
- structured WASM API validation

See [`03-benchmark-methodology.md`](./03-benchmark-methodology.md).

---

## 20. Implementation Equivalence

Implementations are equivalent when they produce the same semantic result for the same input and component schema.

For example:

```text
Page + Component Schema
        │
        ▼
AJV
        │
        ▼
Validation Result
```

must be semantically equivalent to:

```text
Page + Component Schema
        │
        ▼
Rust
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

The current test suite verifies parity across the canonical fixtures for AJV, Rust, and WASM.

---

## 21. Incremental Validation Contract

Incremental validation introduces a second concern: not only **whether** a page is valid, but **which part of the page must be revalidated after a change**.

A change is represented conceptually as:

```text
PageChange
    │
    ▼
Change Resolver
    │
    ▼
Affected Scope
    │
    ▼
Targeted Validation
```

### 21.1 Field changes

A localized field change can often be validated at the changed node.

```text
Field change
     │
     ▼
Changed node
     │
     ▼
Targeted validation
```

### 21.2 Structural changes

Adding, removing, or moving nodes can invalidate structural constraints on ancestors.

A move can affect both the old and new locations.

```text
Node moved
    │
    ├── old location
    │
    └── new location
```

The change resolver therefore determines the affected scope before validation.

### 21.3 Full vs incremental

Incremental validation is not assumed to be faster.

The current experiment demonstrates that localized field changes can benefit significantly, while structural changes may incur enough scope-resolution and targeted-validation overhead to make full validation cheaper.

The strategy itself is therefore part of the experiment.

---

## 22. Current Correctness Baseline

The current JavaScript test suite reports:

```text
91 tests
91 passed
0 failed
```

The suite includes:

- schema validation
- Page model behavior
- path resolution
- change resolution
- fixture validation
- AJV parity
- Rust parity
- WASM parity
- WASM incremental validation
- resident validation parity
- resident incremental validation parity

The fixture set therefore functions as a cross-runtime semantic contract rather than only a TypeScript test suite.

---

## 23. Guiding Principle

The objective of this experiment is not to prove that Rust or WebAssembly is faster.

The objective is to determine:

1. how much validation work a Page Builder actually needs to perform after a change;
2. whether incremental validation can reduce that work;
3. which runtime is appropriate for executing the validation core;
4. whether interop and serialization costs change the practical result.

**Performance is the result of the experiment, not an assumption.**

