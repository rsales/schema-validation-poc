# Schema Validation POC — Current Results

## Current status

Working implementations exist for:

- Node.js validation
- Native Rust validation
- Rust → WebAssembly compilation
- `wasm-bindgen` bindings
- Node/WASM validation
- Native Rust benchmarking
- Criterion validation-only benchmarking

## WASM API

The generated module exposes:

```ts
export function init_validator(schema_json: string): void;

export function validate_page(page_json: string): boolean;
```

Validation has been confirmed for both valid and invalid pages:

```text
Rust/WASM validation: true
Rust/WASM validation: false
```

## Latest native Rust benchmark

| Fixture | Size | Blocks | Avg/run | P95/run | Ops/sec |
|---|---:|---:|---:|---:|---:|
| Small | 0.35 KB | 2 | 17.600 ms | 29.096 ms | 5,681,978 |
| Medium | 9.03 KB | 50 | 29.967 ms | 33.088 ms | 333,702 |
| Large | 89.44 KB | 500 | 29.573 ms | 39.935 ms | 33,814 |
| Huge | 899.63 KB | 5,000 | 29.457 ms | 33.581 ms | 3,395 |

The average is the time for all iterations in a benchmark run, not the latency of one validation.

## Earlier validation-only WASM benchmark

Approximately:

| Fixture | Ops/sec |
|---|---:|
| Small | 5.88M |
| Medium | 369K |
| Large | 34.4K |
| Huge | 3.4K |

The WASM results were close to native Rust for the same validation-oriented workload.

## Key observation

```text
Rust Native ≈ Rust/WASM
```

for pure validation.

The larger cost appears when the full Node.js → WASM → Rust path is included.

Therefore, the current evidence suggests that WebAssembly itself is not the primary problem; the integration boundary and surrounding runtime work are important contributors.

## Architectural interpretation

### Node.js-only

```text
Node.js
   |
   v
AJV
```

is currently the pragmatic choice because it avoids:

- WASM boundary overhead
- Rust build requirements
- additional generated artifacts
- cross-language debugging
- additional deployment complexity

### Cross-runtime validation

```text
             Rust validator
                   |
             +-----+-----+
             |           |
           Native       WASM
             |           |
          Rails        Node
                       Browser
```

becomes more compelling when one validation implementation must be reused across multiple runtimes.

The primary benefit is portability and shared logic, not simply raw validation speed.

## Current hypothesis

> For a Node.js-only Page Builder or Headless CMS, AJV is likely the better engineering choice. Rust + WASM becomes valuable when validation logic must be shared across runtimes or environments.

This hypothesis should be validated with the controlled Docker benchmark.
