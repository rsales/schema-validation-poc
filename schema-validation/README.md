# Schema Validation POC

A proof of concept for evaluating JSON Schema validation strategies for Page Builder and Headless CMS architectures.

The project compares **Node.js + AJV**, **native Rust**, and **Rust compiled to WebAssembly** to understand the trade-offs between performance, memory usage, integration overhead, portability, and operational complexity.

## Research Question

> Is Rust + WebAssembly a better validation strategy than a native JavaScript JSON Schema validator such as AJV for a Page Builder or Headless CMS?

The POC intentionally evaluates the same validation engine in different execution environments so that the cost of the runtime and language boundary can be understood separately.

## Implementations

### Node.js + AJV

The JavaScript baseline.

```text
Node.js
   |
   v
AJV
   |
   v
JSON Schema
```

This represents the simplest architecture for a Node.js-based CMS.

### Native Rust

The Rust implementation uses the `jsonschema` crate.

```text
Rust
 |
 v
jsonschema
 |
 v
Page validation
```

This provides a baseline for the raw performance of the Rust validation engine.

### Rust + WebAssembly

The Rust validator is compiled to WebAssembly and exposed to Node.js through `wasm-bindgen`.

```text
Node.js
   |
   v
wasm-bindgen
   |
   v
WebAssembly
   |
   v
Rust
   |
   v
jsonschema
```

The generated API currently exposes:

```ts
export function init_validator(schema_json: string): void;

export function validate_page(page_json: string): boolean;
```

The schema is initialized once and the validator is reused for subsequent validations.

## Current WASM Results

The current Rust/WASM pure-validation benchmark runs **50 benchmark runs per fixture** after warmup.

| Fixture | Size | Blocks | Iterations | Avg | P95 | Ops/sec |
|---|---:|---:|---:|---:|---:|---:|
| Small | 0.22 KB | 2 | 100,000 | 0.168 μs | 0.175 μs | **5,966,026** |
| Medium | 6.16 KB | 50 | 10,000 | 2.912 μs | 2.964 μs | **343,418** |
| Large | 60.86 KB | 500 | 1,000 | 29.869 μs | 30.699 μs | **33,480** |
| Huge | 613.96 KB | 5,000 | 100 | 308.850 μs | 317.322 μs | **3,238** |

The validator initialization is performed once before the benchmark workload.

The current validation test also confirms:

```text
Rust/WASM validation: true
```

### Interpretation

The current measurements show stable validation behavior after initialization.

Validation cost increases with fixture size, as expected, but the benchmark does not show an unexpected performance explosion for the tested document sizes.

These numbers represent the **pure validation workload through the Node.js/WASM binding**. They should not be interpreted as the complete cost of an end-to-end architecture involving application-level serialization, data preparation, process startup, or other runtime work.

Therefore:

```text
Pure validation performance
        ≠
End-to-end application performance
```

## Native Rust Test Status

The native Rust implementation currently builds and passes its test suite.

```bash
cargo test   --manifest-path rust/Cargo.toml
```

The current test run completes successfully.

The crate contains the native benchmark and Criterion benchmark infrastructure used to investigate the validation operation independently from the Node.js/WASM path.

## Memory

Memory is measured independently from the performance benchmark.

Each fixture runs in an isolated Node.js process, with measurements taken at defined lifecycle stages:

```text
Process start
     |
     v
Baseline RSS
     |
     v
Validator initialization
     |
     v
Validator RSS
     |
     v
Fixture initialization
     |
     v
Fixture RSS
     |
     v
Warmup
     |
     v
After Warmup
     |
     v
Validation workload
     |
     v
Peak RSS / Peak Heap
     |
     v
Final
```

The primary process-level memory metric is **Peak RSS** and its delta from the process baseline.

The benchmark records:

- Baseline RSS
- Validator RSS
- Fixture RSS
- After Warmup
- Peak RSS
- Peak Heap
- RSS Delta
- Heap Delta

RSS may include JavaScript heap, native allocations, runtime overhead, allocator behavior, and WebAssembly memory. Heap metrics therefore provide complementary context rather than replacing RSS.

Controlled memory measurements remain a separate benchmark track and should be interpreted independently from the pure validation results above.

## Current Hypothesis

For a **Node.js-only Page Builder or Headless CMS**, AJV remains the pragmatic baseline because it avoids:

- WASM boundary overhead
- Rust build requirements
- generated WASM artifacts
- cross-language debugging
- additional deployment complexity

Rust + WASM becomes more interesting when the same validation implementation needs to be shared across different runtimes.

For example:

```text
                 Rust validator
                       |
             +---------+---------+
             |                   |
          Native                WASM
             |                   |
        Ruby/Rails         Node.js / Browser
```

A possible architecture could therefore use Rust as a shared validation core while exposing it through WASM to runtimes that cannot directly consume the Rust library.

The primary potential benefit is **cross-runtime reuse**, rather than simply raw validation speed.

## Benchmark Fixtures

The current fixtures are Page Builder-like JSON documents with different sizes:

| Fixture | Approx. size | Blocks |
|---|---:|---:|
| Small | 0.22 KB | 2 |
| Medium | 6.16 KB | 50 |
| Large | 60.86 KB | 500 |
| Huge | 613.96 KB | 5,000 |

Benchmark iterations are scaled according to fixture size.

## Benchmark Implementations

### Node / WASM benchmark

```bash
npm run benchmark:wasm
```

This measures the validation path from Node.js through the generated WASM bindings.

### Native Rust benchmark

```bash
cargo run   --manifest-path rust/Cargo.toml   --release   --bin benchmark
```

This runs the custom benchmark directly against the native Rust implementation.

### Criterion benchmark

```bash
cargo bench   --manifest-path rust/Cargo.toml   --bench validation
```

Criterion is used to isolate the validation operation itself and provide statistically robust measurements.

### WASM validation test

```bash
npm run wasm:test
```

Expected output includes:

```text
Rust/WASM validation: true
```

## Running the Project

### Requirements

- Node.js
- npm
- Rust
- Cargo
- `wasm-bindgen-cli`
- `wasm32-unknown-unknown` Rust target

### Install dependencies

```bash
npm install
```

### Build Rust

```bash
cargo build   --manifest-path rust/Cargo.toml   --target wasm32-unknown-unknown   --release
```

### Generate WASM bindings

```bash
rm -rf rust/pkg

wasm-bindgen   rust/target/wasm32-unknown-unknown/release/schema_validator.wasm   --out-dir rust/pkg   --target experimental-nodejs-module   --typescript
```

### Build TypeScript

```bash
npm run build
```

## Project Structure

```text
schema-validation/
│
├── docs/
│   ├── 01-overview.md
│   ├── 02-architecture.md
│   ├── 03-benchmark-methodology.md
│   ├── 04-current-results.md
│   ├── 05-next-steps.md
│   ├── 06-page-engine-validation-contract.md
│   └── 07-page-engine-fixtures.md
│
├── fixtures/
│   ├── page-small.json
│   ├── page-medium.json
│   ├── page-large.json
│   └── page-huge.json
│
├── rust/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── src/
│   └── benches/
│
├── schema/
│   └── page.schema.json
│
├── src/
│   ├── benchmark.ts
│   ├── benchmark-wasm.ts
│   ├── benchmark-memory.ts
│   ├── benchmark-memory-worker.ts
│   ├── benchmark-memory-wasm.ts
│   ├── benchmark-memory-wasm-worker.ts
│   ├── generate-fixtures.ts
│   ├── wasm-test.ts
│   └── ts/
│       └── validator.ts
│
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

## Architecture Context

The intended Page Builder flow is:

```text
User edits Page
       |
       v
Page JSON changes
       |
       v
Page Schema
       |
       v
Validation
       |
   +---+---+
   |       |
 INVALID  VALID
   |       |
 reject    v
        Save Page
           |
           v
        Client
```

The validation layer should prevent invalid Page JSON from being persisted or propagated to clients.

In a multi-runtime architecture, the validation core could be shared:

```text
                    Page Schema
                         |
                         v
                Shared Validator
                         |
          +--------------+--------------+
          |              |              |
       Node.js        Rails/Ruby      Browser
          |              |              |
         WASM           WASM           WASM
```

Whether this complexity is justified depends on the number of runtimes that actually need to share the validation logic.

## Roadmap

### Phase 1 — Controlled benchmark

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

### Phase 2 — Separate the costs

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

### Phase 3 — Concurrency

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

### Phase 4 — Error reporting

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

### Phase 5 — API design

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

### Phase 6 — Code generation investigation

After the benchmark is stable, investigate whether schema-specific code generation changes the comparison.

Potential candidates:

- AJV standalone/code generation
- specialized Rust validation
- precompiled schema representations

Equivalent workloads must be compared.

### Phase 7 — Architectural decision

The final decision should consider:

- validation throughput
- average latency
- P95/P99 latency
- CPU usage
- memory usage
- startup cost
- WASM/binary size
- build complexity
- deployment complexity
- debugging experience
- error reporting
- cross-runtime reuse
- long-term maintenance

Performance alone should not determine the architecture.

## Documentation

More detailed documentation is available in [`docs/`](./docs/):

- [Overview](./docs/01-overview.md)
- [Architecture](./docs/02-architecture.md)
- [Benchmark Methodology](./docs/03-benchmark-methodology.md)
- [Current Results](./docs/04-current-results.md)
- [Next Steps](./docs/05-next-steps.md)
- [Page Engine Validation Contract](./docs/06-page-engine-validation-contract.md)
- [Page Engine Fixtures](./docs/07-page-engine-fixtures.md)

## Status

This repository is an experimental POC.

The current goal is **not** to produce a production-ready validation library. It is to gather enough technical and performance evidence to decide whether a Rust/WASM validation core makes architectural sense for Page Builder / Headless CMS scenarios.

---

**Current direction:** complete controlled memory measurements, establish a reproducible benchmark environment, and compare the runtime, validation, and integration costs before making the final architectural recommendation.
