# Page Engine

A Rust-based experimental validation engine for Page Builder and Headless CMS document structures.

The project explores whether a Page Builder can validate only the parts of a document affected by a change instead of validating the entire page after every edit.

## Goals

The Page Engine explores:

- Page Builder document validation
- compiled schemas
- component definitions
- JSON Schema validation
- NodePath resolution
- change resolution
- affected validation scopes
- targeted validation
- incremental validation
- structured validation errors
- native Rust performance
- full vs incremental validation

## Architecture

The current validation flow is:

```text
Page
 |
 +-- PageNode tree
 |
 +-- Page Schema
 |
 +-- Compiled Schema
 |
 +-- Page Change
       |
       v
  Change Resolver
       |
       v
 Affected Scope
       |
       v
Targeted Validation
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

The current implementation distinguishes between local field changes and structural changes.

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

### Structural changes

Adding, removing, or moving a node can affect its structural ancestors and, in the case of a move, both the old and new locations.

```text
Node moved
    |
    +---- old location
    |
    +---- new location
```

The engine therefore resolves the affected scope before performing validation.

## Current Test Results

The current implementation has **24 passing unit tests** covering:

- path resolution
- change resolution
- affected validation scopes
- structural ancestor resolution
- targeted validation
- incremental validation
- global error path preservation

```text
24 passed
0 failed
```

## Current Benchmark Results

The first full-vs-incremental benchmark was executed with:

```text
iterations: 100000
```

### Results

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

## Interpretation

The results show that incremental validation is **not universally faster**.

For localized field changes, the current implementation provides a substantial improvement:

```text
Full validation
1117.35 ms
     |
     v
Incremental validation
 41.27 ms

27.07x faster
```

Structural changes currently produce the opposite result.

Adding, removing, or moving nodes introduces enough scope-resolution and targeted-validation overhead that full validation is currently faster.

Therefore, the current hypothesis is:

```text
Local field change
        |
        v
Incremental validation
        |
        v
Significant potential speedup
```

while:

```text
Structural change
        |
        v
Affected-scope resolution
        |
        v
Incremental validation
        |
        v
May be more expensive than full validation
```

This suggests that a production Page Engine should not blindly choose incremental validation for every change.

A future strategy could select the validation mode based on the type and estimated scope of the change:

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

The goal is therefore evolving from simply comparing **full vs incremental validation** to exploring **change-aware validation**.

## Benchmark Command

Run the incremental benchmark with:

```bash
cargo run   --manifest-path rust/Cargo.toml   --release   --bin incremental-benchmark
```

The benchmark compares the same change scenarios using full-document and incremental validation.

## Tests

Run the complete Rust test suite with:

```bash
cargo test   --manifest-path rust/Cargo.toml
```

Expected result currently:

```text
24 passed; 0 failed
```

## Project Structure

```text
page-engine/
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
└── README.md
```

## Relationship with Schema Validation

The repository also contains a separate benchmark project:

```text
schema-validation/
```

That project evaluates the execution cost of:

```text
Node.js + AJV
Native Rust
Rust + WebAssembly
```

Page Engine builds on a different question.

The benchmark asks:

> Which validation runtime is efficient?

Page Engine asks:

> How much validation work actually needs to be performed after a Page change?

These are complementary questions.

A future architecture could potentially combine both ideas:

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
                  /         \
                 /           \
             Full          Incremental
               |                |
               +-------+--------+
                       |
                       v
                Validation Core
```

The validation core itself could eventually be implemented using one of the strategies investigated by the `schema-validation` experiment.

## Roadmap

### Phase 1 — Core model

- [x] PageNode model
- [x] NodePath
- [x] PageChange
- [x] Change resolution
- [x] Affected scope calculation

### Phase 2 — Validation

- [x] Compiled schema
- [x] Full validation
- [x] Targeted validation
- [x] Incremental validation
- [x] Structured validation paths

### Phase 3 — Benchmarking

- [x] Full vs incremental benchmark
- [x] Field change benchmark
- [x] Node addition benchmark
- [x] Node removal benchmark
- [x] Node move benchmark
- [ ] Larger and more realistic page fixtures
- [ ] Scope-size analysis
- [ ] Allocation and CPU profiling

### Phase 4 — Change-aware strategy

Investigate whether the engine can automatically select between:

```text
incremental validation
        vs
full validation
```

based on:

- change type
- affected scope size
- structural depth
- number of affected nodes
- estimated validation cost

### Phase 5 — WASM integration

Investigate exposing the Page Engine through WebAssembly so that the same validation model can potentially run in:

- Node.js
- browser
- other supported runtimes

## Status

This project is an experimental POC.

The current results demonstrate that incremental validation can be extremely effective for localized field changes, while structural changes still require optimization.

The next architectural question is therefore not simply:

> "Is incremental validation faster?"

but:

> "Can the engine intelligently determine when incremental validation is cheaper than full validation?"

