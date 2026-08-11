# Schema Validation POC — Benchmark Methodology

## Objective

Compare:

- Node.js + AJV
- Native Rust
- Rust + WebAssembly

using Page Builder-like JSON documents.

## Fixtures

| Fixture | Approx. size | Blocks |
|---|---:|---:|
| Small | ~0.35 KB | 2 |
| Medium | ~9 KB | 50 |
| Large | ~89 KB | 500 |
| Huge | ~900 KB | 5,000 |

## Benchmark protocol

The current benchmark uses 50 measurement runs.

Warmup and iteration counts are scaled by fixture size:

| Fixture | Warmup | Iterations |
|---|---:|---:|
| Small | 10,000 | 100,000 |
| Medium | 10,000 | 10,000 |
| Large | 1,000 | 1,000 |
| Huge | 100 | 100 |

## Metrics

The benchmark reports:

- Average execution time
- Average time per operation
- P95 latency
- Operations per second
- Number of validations

The most useful throughput metric is:

```text
operations / second
```

because each run contains multiple validation iterations.

## Validation-only vs end-to-end

The POC now distinguishes:

### Validation-only

Input is already prepared and the benchmark focuses on the validator.

### End-to-end

Includes work such as:

```text
JSON string
   |
   v
runtime / binding
   |
   v
JSON parsing
   |
   v
schema validation
```

This distinction is particularly important for WASM because JavaScript ↔ WASM boundary costs can become measurable.

## Native Rust / Criterion

Criterion was added to measure the Rust validation operation directly.

Observed validation-only measurements were approximately:

| Fixture | Typical time |
|---|---:|
| Small | ~166 ns |
| Medium | ~3.05 µs |
| Large | ~28.5 µs |
| Huge | ~282.7 µs |

These results demonstrate that the Rust validation engine itself is much faster than the complete benchmark timings that include surrounding application work.

## Benchmark noise

Local runs showed occasional spikes such as 30–50 ms while normal runs were often around 15–30 ms.

Potential causes include:

- OS scheduling
- background processes
- CPU frequency changes
- thermal/power management
- runtime effects
- virtualization

Therefore, local results should be treated as comparative measurements rather than absolute hardware specifications.

## Cross-machine testing

The benchmark was executed on both a Mac mini and a MacBook Pro.

The exact numbers differed, but the overall behavior was consistent:

- Small pages are extremely fast.
- Medium pages remain very fast.
- Larger documents increasingly depend on the amount of data being traversed.
- Native Rust and WASM remain in the same general performance class for validation-only workloads.
- The complete WASM integration path can be substantially more expensive than pure validation.

## Planned controlled benchmark

The next methodology improvement is Docker.

The objective is reproducibility, not claiming that Docker produces perfectly native hardware measurements.

The controlled environment should fix:

- Node.js version
- Rust version
- dependency versions
- schema
- fixtures
- warmup
- number of runs
- CPU limits
- memory limits

The final benchmark should separately measure:

```text
Startup
Schema compilation
JSON parsing
Validation
JS ↔ WASM boundary
Total operation
```
