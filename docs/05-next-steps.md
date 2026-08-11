# Next Steps

## 1. Native Rust Benchmark

Implement the same validation benchmark using native Rust.

Goal:

```text
Ajv
  vs
Native Rust
  vs
Rust/WASM
```

This isolates WASM overhead.

## 2. WASM Boundary Benchmark

Measure repeated calls to an exported WASM function without JSON Schema validation.

```text
JavaScript
    ↓
WASM
    ↓
JavaScript
```

This provides a lower bound for WASM boundary cost.

## 3. End-to-End Benchmark

Measure:

```text
Page object
    ↓
JSON.stringify()
    ↓
WASM
    ↓
serde_json
    ↓
JSON Schema validation
    ↓
boolean
```

This represents a realistic integration scenario.

## 4. Validator Optimization

Investigate whether the current Rust JSON Schema implementation is the main bottleneck.

Potential approaches:

- specialized validators;
- precompiled schemas;
- generated Rust code;
- reduced allocations;
- direct structured data access.

## 5. Schema-to-Code Generation

The most interesting experiment is to generate Rust validation code from the JSON Schema.

```text
page.schema.json
       │
       ▼
 Code Generator
       │
       ▼
 validator.rs
       │
       ▼
 Rust Compiler
       │
       ▼
 WASM
```

This mirrors the code-generation strategy used by Ajv.

## 6. WASM Optimization

After establishing a correct baseline, investigate:

- Link Time Optimization (LTO);
- `opt-level`;
- `codegen-units`;
- `wasm-opt`;
- binary size;
- allocator choices.

Optimization should happen only after the baseline is stable.

## 7. Browser Benchmark

The current benchmark runs WASM under Node.js.

A later experiment should run the same module inside a real browser.

Potential environments:

- Chrome;
- Safari;
- Firefox.

## 8. Final Evaluation

The final evaluation should answer:

1. Is WASM faster?
2. If not, where is the overhead?
3. Does native Rust outperform Ajv?
4. Does generated Rust outperform Ajv?
5. Does WASM become advantageous for larger documents?
6. What is the cost of loading the WASM module?
7. What is the WASM binary size?
8. Does the performance improvement justify the architectural complexity?
