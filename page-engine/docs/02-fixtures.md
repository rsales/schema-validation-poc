# Page Engine Fixtures

## Purpose

The `page-engine/fixtures` directory defines the canonical validation workloads used by the Page Engine experiment.

The fixtures are intentionally designed around realistic Page Builder and Headless CMS rules instead of a minimal JSON Schema example.

They provide a stable semantic contract that can be executed by multiple validation implementations:

- AJV / JavaScript
- Rust native
- Rust/WASM

The same fixtures should be reused by every implementation so that correctness and performance comparisons remain meaningful.

---

## Fixture Structure

```text
page-engine/
└── fixtures/
    ├── page-small.json
    └── invalid/
        ├── child-not-allowed.json
        ├── invalid-enum.json
        ├── invalid-pattern.json
        ├── invalid-type.json
        ├── max-children.json
        ├── min-children.json
        ├── missing-required-field.json
        ├── number-maximum.json
        ├── number-minimum.json
        ├── string-max-length.json
        ├── string-min-length.json
        ├── unknown-component.json
        └── unknown-field.json
```

There are currently **14 canonical fixture cases**:

- 1 valid page
- 13 invalid pages

The invalid fixtures intentionally isolate one primary validation rule each.

---

# Valid Fixture

## `page-small.json`

### Purpose

Represents a valid Page Builder document.

### Structure

```text
page
└── hero
    ├── heading
    ├── text
    └── button
```

### Rules exercised

- Valid `page` component
- Valid `hero` component
- Valid nested components
- Required fields present
- Valid string fields
- Valid enum values
- Valid number values
- Allowed child relationships
- Valid child counts

This fixture is the baseline for the positive validation path.

Expected result:

```text
valid = true
errors = []
```

---

# Invalid Fixtures

## 1. `unknown-component.json`

### Rule

Reject a component type that is not defined in `component-schema.json`.

Example:

```text
page
└── video
```

`video` is not registered as a component.

### Expected error

```text
unknown_component
```

### Purpose

Tests component registry lookup.

---

## 2. `unknown-field.json`

### Rule

Reject fields that are not declared by the component schema.

Example:

```text
hero.fields.debug
```

The `hero` component does not define a `debug` field.

### Expected error

```text
unknown_field
```

### Purpose

Tests strict field contracts.

---

## 3. `missing-required-field.json`

### Rule

Required fields must be present.

Example:

```text
hero.fields.title
```

is required but omitted.

### Expected error

```text
required
```

### Purpose

Tests required-field enforcement.

---

## 4. `invalid-type.json`

### Rule

Field values must match their declared type.

Example:

```text
hero.fields.title = 12345
```

The field expects:

```text
type = string
```

### Expected error

```text
type
```

### Purpose

Tests primitive type validation.

---

## 5. `invalid-enum.json`

### Rule

Enum fields must contain one of the declared values.

For `hero.alignment`:

```text
left
center
right
```

are valid.

The fixture uses:

```text
justify
```

### Expected error

```text
enum
```

### Purpose

Tests finite-value constraints.

---

## 6. `string-min-length.json`

### Rule

String values must satisfy `minLength`.

The `hero.title` field requires:

```json
{
  "minLength": 5
}
```

The fixture uses a string shorter than five characters.

### Expected error

```text
minLength
```

### Purpose

Tests lower string-length boundaries.

---

## 7. `string-max-length.json`

### Rule

String values must satisfy `maxLength`.

The `hero.title` field allows a maximum of:

```json
{
  "maxLength": 80
}
```

The fixture contains a title longer than 80 characters.

### Expected error

```text
maxLength
```

### Purpose

Tests upper string-length boundaries.

---

## 8. `invalid-pattern.json`

### Rule

String values must match the declared regular expression.

The `section.fields.id` field uses:

```regex
^[a-z0-9-]+$
```

The fixture contains an invalid value such as:

```text
Invalid Section!
```

### Expected error

```text
pattern
```

### Purpose

Tests regex-based content constraints.

This is particularly relevant to the Page Builder use case because CMS schemas commonly contain validation rules such as:

- slugs
- IDs
- URLs
- custom identifiers
- formatted strings

---

## 9. `number-minimum.json`

### Rule

Numeric fields must not be below the declared minimum.

`grid.columns` requires:

```json
{
  "minimum": 1
}
```

The fixture uses:

```text
0
```

### Expected error

```text
minimum
```

### Purpose

Tests numeric lower boundaries.

---

## 10. `number-maximum.json`

### Rule

Numeric fields must not exceed the declared maximum.

`grid.columns` allows:

```json
{
  "maximum": 12
}
```

The fixture uses:

```text
13
```

### Expected error

```text
maximum
```

### Purpose

Tests numeric upper boundaries.

---

## 11. `child-not-allowed.json`

### Rule

A component may only contain children declared in `allowedChildren`.

`hero` allows:

```text
heading
text
image
button
```

The fixture attempts to place:

```text
grid
```

inside the hero.

### Expected error

```text
child_not_allowed
```

### Purpose

Tests component composition rules.

This is one of the most important Page Builder-specific validations because component hierarchies are part of the schema contract.

---

## 12. `min-children.json`

### Rule

A component must contain at least the configured number of children.

`section` requires:

```json
{
  "minChildren": 1
}
```

The fixture contains zero children.

### Expected error

```text
minChildren
```

### Purpose

Tests lower child-count boundaries.

---

## 13. `max-children.json`

### Rule

A component must not exceed the configured maximum number of children.

`grid` allows:

```json
{
  "maxChildren": 12
}
```

The fixture contains 13 cards.

### Expected error

```text
maxChildren
```

### Purpose

Tests upper child-count boundaries.

---

# Validation Matrix

| Fixture | Category | Rule | Expected Error |
|---|---|---|---|
| `page-small.json` | Valid | Complete valid page | — |
| `unknown-component.json` | Component | Unknown component type | `unknown_component` |
| `unknown-field.json` | Component | Unknown field | `unknown_field` |
| `missing-required-field.json` | Field | Required field missing | `required` |
| `invalid-type.json` | Field | Invalid primitive type | `type` |
| `invalid-enum.json` | Field | Invalid enum value | `enum` |
| `string-min-length.json` | String | Below minimum length | `minLength` |
| `string-max-length.json` | String | Above maximum length | `maxLength` |
| `invalid-pattern.json` | String | Regex mismatch | `pattern` |
| `number-minimum.json` | Number | Below minimum | `minimum` |
| `number-maximum.json` | Number | Above maximum | `maximum` |
| `child-not-allowed.json` | Children | Invalid child type | `child_not_allowed` |
| `min-children.json` | Children | Too few children | `minChildren` |
| `max-children.json` | Children | Too many children | `maxChildren` |

---

# Rules Covered

The current fixture set covers the following validation dimensions:

```text
Component
├── component exists
└── field exists

Field
├── required
└── type

String
├── minLength
├── maxLength
└── pattern

Number
├── minimum
└── maximum

Enum
└── allowed values

Children
├── allowedChildren
├── minChildren
└── maxChildren
```

This gives the experiment **13 independent invalidation paths** plus one valid baseline.

---

# Why These Fixtures Matter

The goal is not to maximize the number of fixtures.

The goal is to create a **representative validation workload** that resembles the rules found in real Page Builder and Headless CMS systems.

A page can contain:

```text
Page
└── Section
    └── Container
        └── Grid
            ├── Card
            │   ├── Heading
            │   └── Button
            ├── Card
            └── Card
```

Each node may introduce:

- required fields
- primitive type checks
- enum checks
- regex checks
- numeric ranges
- string ranges
- child restrictions
- recursive validation

The combination of these rules is what makes the workload interesting for the performance experiment.

---

# Fixture Contract and Cross-Runtime Parity

Once established, the fixture suite should be treated as a **canonical validation contract**.

The same logical fixtures are consumed by:

```text
                 Page Engine Contract
                         │
                         ▼
                 14 canonical fixtures
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
          AJV           Rust        Rust/WASM
```

A validator implementation should not modify the fixtures simply to make its own results pass.

If two engines disagree, the difference should be investigated as an implementation or contract-mapping issue.

The current test suite explicitly checks parity across these implementations.

---

# Correctness Baseline

The current JavaScript test suite reports:

```text
91 tests
91 passed
0 failed
```

The fixture-related tests cover:

- direct validation
- invalid fixture rejection
- AJV parity
- Rust parity
- WASM parity

The fixtures therefore function as more than unit-test data: they are the shared semantic workload used to establish cross-runtime equivalence.

---

# Relationship with Incremental Validation

The fixtures primarily establish **validation correctness**.

Incremental validation introduces a separate dimension:

```text
Page
 │
 ├── fixture
 │
 ▼
Validation contract
```

versus:

```text
Page Change
 │
 ▼
Change Resolver
 │
 ▼
Affected Scope
 │
 ▼
Validation contract
```

The same validation rules must apply regardless of whether the validator receives:

- the entire page, or
- an affected subset of the page.

Therefore, fixture correctness is a prerequisite for meaningful incremental-validation benchmarks.

---

# Adding New Fixtures

A new fixture should be added when it represents a validation rule that is:

1. meaningful for Page Builder or Headless CMS content;
2. deterministic;
3. independently testable;
4. required by the validation contract.

When adding a fixture:

1. Add the JSON file.
2. Document the expected validation rule.
3. Define the canonical error code.
4. Add it to the validation matrix.
5. Ensure all validation implementations produce equivalent semantics.
6. Run the complete test suite.

Avoid creating multiple fixtures that exercise exactly the same rule unless a new structural or semantic dimension is being tested.

---

# Guiding Principle

The fixture suite is a **controlled experimental workload**.

It should remain stable while implementation details evolve.

When the benchmark changes, the workload should normally remain unchanged.

When the validation contract changes, the fixture suite may need to evolve with it.

This separation allows the experiment to distinguish:

```text
Contract change
        vs
Implementation change
        vs
Performance change
```

That distinction is essential for reliable conclusions.
