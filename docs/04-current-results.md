# Current Results

## Node.js / Ajv

Current baseline:

| Fixture | Avg (μs) | Ops/sec |
|---|---:|---:|
| Small | 0.017 | 58.7M |
| Medium | 0.263 | 3.80M |
| Large | 2.572 | 388.8K |
| Huge | 26.017 | 38.4K |

## Rust / WASM — JSON Parsing Included

Earlier measurements passed the JSON string directly into WASM for every validation.

Approximate results:

| Fixture | Avg (μs) |
|---|---:|
| Small | 1.457 |
| Medium | 29.589 |
| Large | 289.337 |
| Huge | 2880.799 |

This showed that JSON parsing and the JavaScript/WASM data boundary can become significant.

## Rust / WASM — Cached Validation

The current benchmark parses the page once before measurement.

| Fixture | Avg (μs) | Ops/sec |
|---|---:|---:|
| Small | 0.170 | 5.88M |
| Medium | 2.708 | 369K |
| Large | 29.031 | 34.4K |
| Huge | 292.056 | 3.42K |

## Comparison

| Fixture | Ajv | Rust/WASM | Relative |
|---|---:|---:|---:|
| Small | 0.017 μs | 0.170 μs | ~10× slower |
| Medium | 0.263 μs | 2.708 μs | ~10× slower |
| Large | 2.572 μs | 29.031 μs | ~11× slower |
| Huge | 26.017 μs | 292.056 μs | ~11× slower |

## Interpretation

The current results do not demonstrate a performance advantage for Rust/WASM.

However, they also do not demonstrate that Rust itself is slower.

The current comparison is:

```text
Ajv
→ code-generated JavaScript
→ V8

vs.

Rust jsonschema
→ generic JSON Schema validator
→ WASM
```

The validator implementations are different.

## Current Hypothesis

The next experiment should compare:

```text
Ajv
  vs
Native Rust
  vs
Rust/WASM
```

If native Rust is significantly faster than WASM, the WASM runtime or boundary is an important factor.

If native Rust is similar to WASM, the main limitation is likely the validator implementation itself.

The most important future experiment is a specialized/generated Rust validator.
