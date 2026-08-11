# Schema Validation POC

> **Status:** Experimental — benchmarking in progress.

A proof of concept for comparing JSON Schema validation performance between Node.js/TypeScript and Rust compiled to WebAssembly (WASM).

## Goals

This POC investigates:

- JSON Schema validation using Ajv in Node.js.
- JSON Schema validation using Rust.
- Rust compiled to WebAssembly.
- JavaScript ↔ WASM boundary overhead.
- JSON parsing overhead.
- Native Rust vs Rust/WASM performance.
- The impact of document size on validation performance.
- Generic validation vs specialized/generated validators.

## Architecture

### Node.js / TypeScript

```text
Page JSON
   │
   ▼
Ajv
   │
   ▼
Compiled JSON Schema Validator
   │
   ▼
boolean
```

### Rust / WebAssembly

```text
Page JSON
   │
   ▼
Rust / WASM
   │
   ├── serde_json
   │
   └── jsonschema
          │
          ▼
      Validator
          │
          ▼
       boolean
```

The JSON Schema is compiled once and the resulting validator is reused during benchmarks.

## Project Structure

```text
schema-validation-poc/
├── schema/
│   └── page.schema.json
├── fixtures/
│   ├── page-small.json
│   ├── page-medium.json
│   ├── page-large.json
│   └── page-huge.json
├── src/
│   ├── ts/
│   │   └── validator.ts
│   ├── benchmark.ts
│   ├── benchmark-wasm.ts
│   ├── generate-fixtures.ts
│   └── wasm-test.ts
├── rust/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── src/
│   │   └── lib.rs
│   └── pkg/
└── docs/
    ├── 01-overview.md
    ├── 02-architecture.md
    ├── 03-benchmark-methodology.md
    ├── 04-current-results.md
    └── 05-next-steps.md
```

## Current Status

| Area | Status |
|---|---|
| JSON Schema definition | ✅ |
| TypeScript/Ajv validator | ✅ |
| Benchmark fixtures | ✅ |
| Node/Ajv benchmark | ✅ |
| Rust/WASM validator | ✅ |
| Rust/WASM functional tests | ✅ |
| Rust/WASM pure validation benchmark | ✅ |
| Native Rust benchmark | 🚧 |
| WASM boundary benchmark | 🚧 |
| End-to-end benchmark | 🚧 |
| Generated Rust validator | 🚧 |
| Browser benchmark | 🚧 |

## Requirements

- Node.js + npm
- Rust + Cargo
- `wasm32-unknown-unknown` target
- `wasm-bindgen`

```bash
rustup target add wasm32-unknown-unknown
```

## Installation

```bash
npm install
```

Build Rust/WASM:

```bash
cargo build   --manifest-path rust/Cargo.toml   --target wasm32-unknown-unknown   --release
```

Generate bindings:

```bash
rm -rf rust/pkg

wasm-bindgen   rust/target/wasm32-unknown-unknown/release/schema_validator.wasm   --out-dir rust/pkg   --target experimental-nodejs-module   --typescript
```

## Validation

TypeScript/Ajv:

```bash
npm run dev
```

WASM:

```bash
npm run wasm:test
```

## Fixtures

Generate fixtures:

```bash
npm run generate:fixtures
```

| Fixture | Blocks | Approx. Size |
|---|---:|---:|
| Small | 2 | 0.22 KB |
| Medium | 50 | 6.16 KB |
| Large | 500 | 60.86 KB |
| Huge | 5,000 | 613.96 KB |

## Benchmarks

Node.js / Ajv:

```bash
npm run benchmark
```

Rust / WASM:

```bash
npm run benchmark:wasm
```

Current local baseline:

| Fixture | Ajv Avg | Ajv Ops/sec | WASM Avg | WASM Ops/sec |
|---|---:|---:|---:|---:|
| Small | 0.017 μs | 58.7M | 0.170 μs | 5.88M |
| Medium | 0.263 μs | 3.80M | 2.708 μs | 369K |
| Large | 2.572 μs | 388.8K | 29.031 μs | 34.4K |
| Huge | 26.017 μs | 38.4K | 292.056 μs | 3.42K |

These are workload-specific local measurements, not universal language benchmarks.

## Current Findings

The current results do not demonstrate a performance advantage for Rust/WASM.

The comparison is currently:

```text
Ajv
→ code-generated JavaScript validation
→ V8 JIT

vs.

Rust jsonschema
→ generic JSON Schema validator
→ WASM
```

Therefore, the results should not be interpreted as proof that Rust is slower than JavaScript.

The validator implementation strategy is an important variable.

## Roadmap

1. Native Rust benchmark.
2. WASM boundary benchmark.
3. End-to-end benchmark.
4. Specialized Rust validator.
5. WASM optimization.
6. Browser benchmark.

The most interesting experiment is generating specialized Rust validation code from the JSON Schema and comparing it against Ajv.

## Caveats

Performance depends on schema complexity, document structure, validator implementation, runtime, CPU architecture, WASM runtime, parsing strategy, memory allocation, boundary overhead, and compiler optimizations.

## Current Hypothesis

Simply moving a generic JSON Schema validator from Node.js to Rust/WASM does not automatically provide a performance improvement.

The next question is whether a **specialized Rust validator compiled to WASM** can approach or outperform Ajv's code-generated validation.
