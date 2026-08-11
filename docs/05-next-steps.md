# Schema Validation POC — Next Steps

## Completed

- [x] Define Page JSON model
- [x] Define JSON Schema
- [x] Generate page fixtures
- [x] Implement Node.js validation
- [x] Implement Rust validation
- [x] Compile Rust to WebAssembly
- [x] Generate `wasm-bindgen` bindings
- [x] Validate pages through WASM
- [x] Add Node/WASM benchmark
- [x] Add native Rust benchmark
- [x] Add Criterion validation-only benchmark
- [x] Run benchmarks on multiple Macs
- [x] Document initial findings

## Phase 1 — Controlled Docker benchmark

Create a reproducible benchmark environment for:

```text
Node + AJV
Rust Native
Rust + WASM
```

All implementations should use the same:

- schema
- fixtures
- benchmark protocol
- warmup strategy
- number of runs
- CPU limits
- memory limits

Proposed structure:

```text
benchmark/
├── docker-compose.yml
├── node/
│   └── Dockerfile
├── rust/
│   └── Dockerfile
└── runner/
```

## Phase 2 — Separate the costs

Measure these independently:

```text
1. Process startup
2. Runtime startup
3. Schema compilation
4. JSON parsing
5. Validation
6. WASM boundary
7. Total operation
```

This prevents integration overhead from being incorrectly attributed to the JSON Schema engine.

## Phase 3 — Concurrency

Test:

```text
1 worker
2 workers
4 workers
8 workers
```

Measure:

- throughput
- latency
- P95
- P99
- CPU
- memory

This is relevant to a CMS receiving many page updates simultaneously.

## Phase 4 — Error reporting

The current WASM API returns only:

```ts
boolean
```

A production-oriented API should eventually expose structured errors:

```ts
interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
}
```

Potential error fields:

```text
instance path
schema path
keyword
message
```

This is important for Page Builder editors because `true/false` alone is insufficient for actionable feedback.

## Phase 5 — API design

The current minimal API is:

```text
init_validator(schema_json)
validate_page(page_json)
```

A future API could support:

```text
initialize
validate
validate_many
get_errors
version
```

The boundary should remain small and stable.

## Phase 6 — Code generation investigation

After the benchmark is stable, investigate whether schema-specific code generation changes the comparison.

Potential candidates:

- AJV standalone/code generation
- specialized Rust validation
- precompiled schema representations

Equivalent workloads must be compared.

## Phase 7 — Architectural decision

### Node + AJV

Best fit when:

```text
CMS = Node
Backend = Node
```

### Rust native

Best fit when:

```text
Backend = Rust
```

### Rust + WASM

Potentially best fit when:

```text
Backend = Rails
CMS = Node
Browser = validation
```

and a single validation implementation is desirable.

## Final decision criteria

Evaluate:

- validation throughput
- P95/P99 latency
- startup cost
- memory usage
- WASM/binary size
- build complexity
- deployment complexity
- debugging experience
- error reporting
- cross-runtime reuse
- long-term maintenance

Performance alone should not determine the architecture.
