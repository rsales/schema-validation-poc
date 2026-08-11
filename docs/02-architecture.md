# Architecture

## TypeScript / Ajv

```text
JSON Schema
    │
    ▼
  Ajv
    │
compile once
    │
    ▼
Compiled Validator
    │
    ▼
Page Object
    │
    ▼
boolean
```

## Rust / WASM

```text
JSON Schema
    │
    ▼
 Rust/WASM
    │
validator_for()
    │
    ▼
JSON Schema Validator
    │
    ▼
Cached Page
    │
    ▼
validate_cached()
    │
    ▼
 boolean
```

## Initialization vs Validation

The schema is compiled once.

The page is parsed once for pure-validation benchmarks.

```text
Initialization
──────────────

Schema
  ↓
Validator

Page JSON
  ↓
serde_json
  ↓
Value

Validation
──────────

Value
  ↓
Validator
  ↓
boolean
```

## End-to-End Path

```text
JavaScript Object
       │
       ▼
JSON.stringify()
       │
       ▼
WASM boundary
       │
       ▼
serde_json
       │
       ▼
JSON Schema validator
       │
       ▼
boolean
```

## Why This Separation Matters

If JSON parsing is included in the validation benchmark, the benchmark no longer measures only schema validation.

Likewise, schema compilation should not be repeated for every validation.

The intended lifecycle is:

```text
compile once
validate many times
```
