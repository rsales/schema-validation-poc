# Page Engine

A Rust-based experimental validation engine for Page Builder and Headless CMS document structures.

The project explores how a Page Builder can validate documents efficiently after edits by combining:

- compiled schemas
- targeted validation
- affected-scope resolution
- incremental validation
- Rust execution
- WebAssembly
- change-aware validation strategies

The central architectural question is no longer only whether incremental validation is faster than full validation, but **how to determine which validation strategy is appropriate for a given page change**.

## Goals

The Page Engine explores:

- Page Builder document validation
- component definitions
- compiled schemas
- JSON Schema validation
- `NodePath` resolution
- `PageChange` modeling
- change resolution
- affected validation scopes
- targeted validation
- incremental validation
- structured validation errors
- Rust validation performance
- WebAssembly execution
- full vs incremental validation
- change-aware validation strategies

## Architecture

The current validation model is:

```text
Page
 |
 +-- PageNode tree
 |
 +-- Page Schema
 |
 +-- Compiled Schema
 |
 +-- PageChange
       |
       v
  Change Resolver
       |
       v
 Affected Scope
       |
       v
 Targeted Validation
       |
       v
 Incremental Validation
```

The central idea is that a change should not necessarily require validating the complete document.

For example:

```text
User edits a field
       |
       v
PageChange
       |
       v
Changed Node
       |
       v
Affected Scope
       |
       v
Targeted Validation
```

## Incremental Validation

The engine distinguishes between local field changes and structural changes.

### Field changes

A field-level change can often be validated by inspecting only the changed node.

```text
Field change
     |
     v
Changed node
     |
     v
Targeted validation
```

This is currently the strongest use case for incremental validation.

### Structural changes

Adding, removing, or moving a node can affect structural ancestors.

A move can affect both the old and new locations:

```text
Node moved
    |
    +---- old location
    |
    +---- new location
```

The engine therefore resolves the affected scope before performing validation.

## Validation Strategy

The current implementation demonstrates that incremental validation is **not universally faster**.

Localized field changes can produce a substantial improvement, while structural changes may currently be more expensive because scope resolution and targeted validation introduce additional work.

This leads to the next architectural direction:

```text
                    Page Change
                         |
                +--------+--------+
                |                 |
           Local field       Structural
              change           change
                |                 |
                v                 v
          Incremental       Evaluate scope
           validation             |
                            +------+------+
                            |             |
                       Incremental       Full
                       validation      validation
```

The goal is evolving from simply comparing **full vs incremental validation** to exploring **change-aware validation**.

A future strategy could estimate the cost of a change based on:

- change type
- affected scope size
- structural depth
- number of affected nodes
- estimated validation cost

and then choose between full and incremental validation.

# Runtime Architecture

The Page Engine is also being evaluated across multiple execution environments.

```text
                    Validation Engine
                           |
              +------------+------------+
              |                         |
         TypeScript / JS            Rust
                                      |
                                      v
                                    WASM
```

This allows us to separate two different questions:

### Question 1 — How much work should be performed?

```text
Full validation
       vs
Incremental validation
```

### Question 2 — How efficiently can that work be executed?

```text
AJV
Rust
Rust → WebAssembly
```

These are complementary benchmark dimensions.

# WebAssembly

The Rust validation engine is currently exposed through WebAssembly.

The generated package lives in:

```text
page-engine/
└── wasm/
    ├── page_engine.js
    ├── page_engine.d.ts
    ├── page_engine_bg.wasm
    └── page_engine_bg.wasm.d.ts
```

The WASM package is generated with:

```bash
npm run build:wasm
```

which executes:

```bash
wasm-pack build rust --target web --out-dir ../wasm
```

The JavaScript/TypeScript benchmarks consume the generated package directly:

```ts
import {
  PageValidator,
} from '../wasm/page_engine.js'
```

The previous duplicate `benchmarks/wasm/` artifact directory has been removed so that there is a single source of generated WASM artifacts.

## WASM Validation APIs

The current WASM API supports several validation paths.

### Compiled validation

The schema is compiled once:

```text
Schema JSON
    |
    v
PageValidator
    |
    v
Compiled schema
```

Pages can then be validated repeatedly.

### Resident page validation

A page can be loaded into the Rust/WASM representation:

```text
Page JSON
   |
   v
load_page()
   |
   v
Resident page
   |
   v
validate_resident()
```

This avoids repeatedly parsing the same page representation.

### Incremental validation

The WASM layer also exposes incremental validation capabilities:

```text
Page
 +
PageChange
      |
      v
affected scope
      |
      v
incremental validation
```

This has parity coverage against the Rust and TypeScript implementations.

# Correctness

The project currently has **91 passing tests** across the TypeScript, AJV, Rust, and WASM validation layers.

```text
91 passed
0 failed
```

The test suite covers:

- generated page schema validation
- AJV validation
- page model behavior
- `NodePath`
- `PageChange`
- field changes
- node additions
- node removals
- node moves
- invalid component detection
- invalid field detection
- required fields
- field types
- enum constraints
- string constraints
- number constraints
- children constraints
- fixture validation
- Rust validation parity
- WASM validation parity
- WASM incremental validation parity
- resident validation parity
- resident incremental validation parity

Run the complete test suite with:

```bash
npm test
```

# Runtime Benchmarks

The current consolidated runtime benchmark uses:

```text
iterations: 100000
```

Current representative results:

| Implementation | Total | Throughput |
|---|---:|---:|
| AJV | 54.05 ms | **1,850,291 validations/sec** |
| Rust WASM - compiled | 141.63 ms | 706,046 validations/sec |
| Rust WASM - resident | 139.81 ms | 715,260 validations/sec |

These measurements are **runtime throughput benchmarks**, not measurements of the architectural value of incremental validation.

For this fixture and benchmark setup, AJV remains faster than the Rust/WASM implementation.

Resident WASM provides a small improvement over compiled validation with repeated page parsing:

```text
Rust WASM - compiled
706,046 validations/sec

Rust WASM - resident
715,260 validations/sec
```

The difference is currently modest.

## WASM Benchmark Breakdown

### Resident validation

```text
iterations:            100000
page load:              0.0281 ms
validation:           140.15 ms
avg validation:         0.001401 ms
throughput:           713,534 validations/sec
```

### Validation and serialization

```text
validation:                 139.76 ms
validation + serialization: 143.02 ms
serialization:                3.25 ms

validation throughput:      715,492 validations/sec
full throughput:             699,214 validations/sec
```

Serialization is measurable but relatively small compared with the validation workload in this benchmark.

### Structured validation

The structured benchmark uses the already parsed JavaScript page representation:

```text
Rust WASM - compiled + structured

iterations: 100000
total:      423.19 ms
avg:        0.004232 ms
throughput: 236,302 validations/sec
```

This experiment is useful for understanding JS/WASM boundary and data-representation costs.

# Incremental Benchmarking

The original full-vs-incremental benchmark used:

```text
iterations: 100000
```

The benchmark compares the same page changes using full-document and incremental validation.

The historical result was:

| Change | Full | Incremental | Speedup |
|---|---:|---:|---:|
| Field change | 1117.35 ms | 41.27 ms | **27.07x** |
| Node added | 1127.00 ms | 2551.32 ms | 0.44x |
| Node removed | 1003.76 ms | 2137.85 ms | 0.47x |
| Node moved | 1109.10 ms | 2749.14 ms | 0.40x |

Throughput:

| Change | Full validations/sec | Incremental validations/sec |
|---|---:|---:|
| Field change | 89,497 | **2,423,097** |
| Node added | 88,731 | 39,195 |
| Node removed | 99,625 | 46,776 |
| Node moved | 90,163 | 36,375 |

These numbers demonstrate why the engine should not blindly use incremental validation for every change.

For localized field changes:

```text
Full validation
1117.35 ms
     |
     v
Incremental validation
 41.27 ms

27.07x faster
```

For structural changes, the current implementation has enough scope-resolution and targeted-validation overhead that full validation can still be faster.

# Benchmark Commands

## Build WASM

```bash
npm run build:wasm
```

## Consolidated runtime benchmark

```bash
npx tsx benchmarks/summary.bench.ts
```

## Internal WASM loop

```bash
npx tsx benchmarks/wasm-internal.bench.ts
```

## Resident page benchmark

```bash
npx tsx benchmarks/wasm-resident.bench.ts
```

## WASM stages benchmark

```bash
npx tsx benchmarks/wasm-stages.bench.ts
```

## Structured WASM benchmark

```bash
npx tsx benchmarks/wasm-structured.bench.ts
```

## Incremental benchmark

```bash
cargo run   --manifest-path rust/Cargo.toml   --release   --bin incremental-benchmark
```

# Tests

Run the complete JavaScript/TypeScript test suite:

```bash
npm test
```

Run the Rust test suite:

```bash
cargo test   --manifest-path rust/Cargo.toml
```

# Project Structure

```text
page-engine/
│
├── ajv/
│   ├── ...
│   └── tests/
│
├── benchmarks/
│   ├── fixtures.ts
│   ├── summary.bench.ts
│   ├── wasm-internal.bench.ts
│   ├── wasm-resident.bench.ts
│   ├── wasm-stages.bench.ts
│   └── wasm-structured.bench.ts
│
├── fixtures/
│   ├── page-small.json
│   └── ...
│
├── rust/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── path/
│   │   ├── change_resolver/
│   │   ├── scope/
│   │   ├── validator/
│   │   ├── incremental/
│   │   ├── benchmark.rs
│   │   ├── incremental_benchmark.rs
│   │   ├── scale_benchmark.rs
│   │   └── main.rs
│   └── ...
│
├── schema/
│   └── component-schema.json
│
├── src/
│   ├── ...
│   └── ...
│
├── tests/
│   └── ...
│
├── wasm/
│   ├── page_engine.js
│   ├── page_engine.d.ts
│   ├── page_engine_bg.wasm
│   └── page_engine_bg.wasm.d.ts
│
├── package.json
└── README.md
```

# Relationship with Schema Validation

The repository also contains a separate schema-validation experiment.

That project evaluates the execution cost of:

```text
Node.js + AJV
Native Rust
Rust + WebAssembly
```

Page Engine asks a different question.

### Runtime benchmark

> Which validation runtime is efficient?

### Page Engine

> How much validation work actually needs to be performed after a Page change?

These are complementary questions.

A future architecture could combine both ideas:

```text
                  Page Change
                       |
                       v
              Change Resolution
                       |
                       v
               Affected Scope
                       |
                       v
             Validation Strategy
                  /                          /                        Full          Incremental
               |                |
               +-------+--------+
                       |
                       v
                Validation Core
                       |
             +---------+---------+
             |                   |
            AJV              Rust/WASM
```

This separation is important because improving the validation runtime does not automatically reduce the amount of validation work required.

Likewise, reducing the validation scope does not automatically make the underlying runtime faster.

# Roadmap

## Phase 1 — Core Model

- [x] `PageNode` model
- [x] `NodePath`
- [x] `PageChange`
- [x] Change resolution
- [x] Affected scope calculation

## Phase 2 — Validation Engine

- [x] Compiled schema
- [x] Full validation
- [x] Targeted validation
- [x] Incremental validation
- [x] Structured validation paths

## Phase 3 — Correctness

- [x] Unit tests
- [x] Full vs incremental parity
- [x] Rust validation parity
- [x] WASM validation parity
- [x] WASM incremental validation parity
- [x] Resident validation parity

## Phase 4 — Benchmarking

- [x] Full vs incremental benchmark
- [x] Field change benchmark
- [x] Node addition benchmark
- [x] Node removal benchmark
- [x] Node move benchmark
- [x] Validation scaling benchmark
- [x] Runtime benchmark
- [x] WASM benchmark
- [x] Resident WASM benchmark
- [x] Serialization overhead benchmark
- [x] Structured JS/WASM benchmark
- [ ] Larger and more realistic page fixtures
- [ ] Scope-size analysis
- [ ] Allocation profiling
- [ ] CPU profiling

## Phase 5 — WASM Runtime

- [x] Rust → WASM compilation
- [x] WASM `PageValidator` API
- [x] Compiled schema validation
- [x] Resident page validation
- [x] Incremental validation through WASM
- [x] WASM parity tests
- [x] WASM runtime benchmarks
- [x] Centralized WASM artifacts
- [ ] JS/TS ↔ WASM integration benchmark
- [ ] Browser integration benchmark

## Phase 6 — Change-Aware Validation Strategy

The next major architectural milestone.

Investigate whether the engine can automatically select between:

```text
incremental validation
        vs
full validation
```

based on the estimated cost of the change.

Potential inputs:

- change type
- affected scope size
- structural depth
- number of affected nodes
- validation complexity
- estimated validation cost

Target architecture:

```text
                     PageChange
                         |
                         v
                 Affected Scope
                         |
                         v
                 Scope Estimator
                         |
                         v
              Validation Strategy
                 /                            /                      Incremental             Full
        validation           validation
                \              /
                 \            /
                  v          v
                Validation Core
```

## Phase 7 — End-to-End Page Builder

- [ ] Page Builder editing simulation
- [ ] Realistic editing workload
- [ ] Browser integration
- [ ] JS/TS ↔ WASM integration
- [ ] End-to-end latency benchmark
- [ ] Validation strategy selection in a real editing loop

# Current Status

This project remains an experimental POC.

The current implementation has established several important results:

1. **Incremental validation works correctly.**
2. **Localized field changes can benefit significantly from incremental validation.**
3. **Structural changes are not automatically faster with the current incremental implementation.**
4. **Rust validation can be compiled and executed through WebAssembly.**
5. **Resident WASM validation is functional and avoids repeated page parsing.**
6. **Rust/WASM validation has parity with the existing validation model.**
7. **AJV remains faster than the current Rust/WASM runtime benchmark for the tested fixture.**

The most important conclusion so far is therefore:

```text
Incremental validation
        ≠
Always faster validation
```

and:

```text
Faster runtime
        ≠
Less validation work
```

The next architectural question is:

> **Can the Page Engine intelligently determine when incremental validation is cheaper than full validation?**

That is the next major milestone: **Change-Aware Validation Strategy**.
