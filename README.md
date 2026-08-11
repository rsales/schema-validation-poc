# Schema Validation POC

A proof of concept for evaluating JSON Schema validation strategies for Page Builder and Headless CMS architectures.

The project compares **Node.js + AJV**, **native Rust**, and **Rust compiled to WebAssembly** to understand the trade-offs between performance, integration overhead, portability, and operational complexity.

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

The Rust implementation uses the [`jsonschema`](https://crates.io/crates/jsonschema) crate.

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

## Current Findings

The experiment has produced an important distinction between **validation performance** and **end-to-end integration performance**.

### Native Rust

The Rust validation engine is extremely fast when measured directly.

Criterion validation-only measurements are approximately:

| Fixture | Typical validation time |
|---|---:|
| Small | ~166 ns |
| Medium | ~3.05 μs |
| Large | ~28.5 μs |
| Huge | ~282.7 μs |

### Rust + WASM

Pure validation through the WASM implementation is in the same general performance class as native Rust.

However, when the complete Node.js → WASM → Rust path is measured, additional runtime and boundary costs become significant.

This means:

```text
Pure validation:

Native Rust ≈ Rust/WASM
```

does not necessarily imply:

```text
Complete application:

Node + Rust/WASM > Node + AJV
```

The surrounding runtime and language boundary matter.

## Current Hypothesis

For a **Node.js-only Page Builder or Headless CMS**, AJV is currently the most pragmatic choice.

It avoids:

- WASM boundary overhead
- Rust build requirements
- generated WASM artifacts
- cross-language debugging
- additional deployment complexity

Rust + WASM becomes considerably more interesting when the same validation implementation needs to be shared across different runtimes.

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

The primary benefit in that scenario is **cross-runtime reuse**, rather than simply raw validation speed.

## Benchmark Fixtures

The benchmark uses Page Builder-like JSON documents with different sizes:

| Fixture | Approx. size | Blocks |
|---|---:|---:|
| Small | ~0.35 KB | 2 |
| Medium | ~9 KB | 50 |
| Large | ~89 KB | 500 |
| Huge | ~900 KB | 5,000 |

Benchmark iterations are scaled according to fixture size.

## Benchmark Implementations

The project currently contains several benchmark approaches.

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

### Test WASM validation

```bash
npm run wasm:test
```

Expected output includes:

```text
Rust/WASM validation: true
```

and invalid documents should return:

```text
Rust/WASM validation: false
```

## Project Structure

```text
schema-validation-poc/
│
├── docs/
│   ├── 01-overview.md
│   ├── 02-architecture.md
│   ├── 03-benchmark-methodology.md
│   ├── 04-current-results.md
│   └── 05-next-steps.md
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

## Next Experiment: Controlled Docker Benchmark

The next major step is to run the benchmark in controlled Docker environments.

The goal is not to claim that Docker makes benchmarks perfectly deterministic. The goal is to reduce environmental differences between implementations and make results easier to reproduce.

The controlled benchmark should compare:

```text
Node.js + AJV
Native Rust
Rust + WASM
```

under the same:

- CPU constraints
- memory constraints
- runtime versions
- dependency versions
- fixtures
- schema
- warmup
- number of runs

The benchmark should also separate:

```text
Startup
   |
Schema compilation
   |
JSON parsing
   |
Validation
   |
WASM boundary
   |
Total operation
```

Additional measurements should include:

- throughput
- average latency
- P95
- P99
- CPU usage
- memory usage
- startup time
- artifact size

This should provide a more reliable basis for the final architectural decision.

## Documentation

More detailed documentation is available in [`docs/`](./docs/):

- [Overview](./docs/01-overview.md)
- [Architecture](./docs/02-architecture.md)
- [Benchmark Methodology](./docs/03-benchmark-methodology.md)
- [Current Results](./docs/04-current-results.md)
- [Next Steps](./docs/05-next-steps.md)

## Status

This repository is an experimental POC.

The current goal is **not** to produce a production-ready validation library. It is to gather enough technical and performance evidence to decide whether a Rust/WASM validation core makes architectural sense for Page Builder / Headless CMS scenarios.

---

**Current direction:** establish a controlled Docker benchmark before making the final architectural recommendation.
