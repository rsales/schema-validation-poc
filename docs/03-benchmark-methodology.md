# Benchmark Methodology

## Goals

The benchmark compares validation latency and throughput across implementations.

Primary metrics:

- average latency;
- P95 latency;
- validations per second;
- document size;
- number of blocks.

## Fixtures

| Fixture | Blocks | Approx. Size |
|---|---:|---:|
| Small | 2 | 0.22 KB |
| Medium | 50 | 6.16 KB |
| Large | 500 | 60.86 KB |
| Huge | 5,000 | 613.96 KB |

## Warmup

Each fixture is warmed up before measurement.

This matters because Node.js runs inside V8 and may benefit from JIT optimization.

The WASM benchmark is also warmed up before measurements.

## Multiple Runs

Each fixture is measured over 50 runs.

Each run performs a number of validations appropriate to the fixture size.

Smaller documents use more iterations while larger documents use fewer iterations.

## Metrics

### Average latency

Average run duration divided by the number of validations performed in that run.

### P95

The P95 value represents the 95th percentile of benchmark run durations.

### Throughput

```text
validations
───────────
duration
```

expressed as validations per second.

## Pure Validation Benchmark

Excluded from the measurement loop:

- schema compilation;
- JSON serialization;
- JSON parsing;
- fixture generation.

The page is initialized before timing starts.

## WASM Boundary

The current WASM pure-validation benchmark includes the cost of invoking the exported WASM function from JavaScript:

```text
JavaScript
    ↓
WASM function call
    ↓
Rust validator
    ↓
boolean
```

A future benchmark will isolate the function-call overhead independently.

## End-to-End Benchmark

A separate benchmark will measure:

```text
Page object
    ↓
JSON.stringify()
    ↓
WASM boundary
    ↓
serde_json
    ↓
JSON Schema validation
    ↓
boolean
```

## Native Rust Benchmark

The next benchmark will run the same Rust validation logic natively.

This separates Rust validator cost from WASM runtime/boundary cost.

## Reproducibility

Benchmarks should ideally run:

- on the same machine;
- with the same runtime versions;
- with optimized Rust builds;
- after a consistent warmup;
- with the same fixtures;
- with the same benchmark configuration.

Results should be treated as local measurements.
