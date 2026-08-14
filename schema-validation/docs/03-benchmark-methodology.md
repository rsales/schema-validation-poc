# Schema Validation POC --- Benchmark Methodology

## Objective

Compare:

-   Node.js + AJV
-   Native Rust
-   Rust + WebAssembly

using Page Builder-like JSON documents.

## Fixtures

  Fixture     Approx. size   Blocks
  --------- -------------- --------
  Small          \~0.35 KB        2
  Medium            \~9 KB       50
  Large            \~89 KB      500
  Huge            \~900 KB    5,000

## Benchmark protocol

The performance benchmark uses 50 measurement runs.

Warmup and iteration counts are scaled by fixture size:

  Fixture     Warmup   Iterations
  --------- -------- ------------
  Small       10,000      100,000
  Medium      10,000       10,000
  Large        1,000        1,000
  Huge           100          100

The memory benchmark uses the same fixture and workload configuration,
but runs each fixture in an isolated Node.js process.

## Performance metrics

The performance benchmark reports:

-   Average execution time
-   Average time per operation
-   P95 latency
-   Operations per second
-   Number of validations

The most useful throughput metric is:

``` text
operations / second
```

because each run contains multiple validation iterations.

## Memory benchmark

Memory usage is measured separately from the performance benchmark.

This separation prevents memory instrumentation from affecting latency
and throughput measurements.

Each fixture is executed in an isolated Node.js process:

``` text
Memory Benchmark
       |
       +---- Small  → isolated process
       |
       +---- Medium → isolated process
       |
       +---- Large  → isolated process
       |
       +---- Huge   → isolated process
```

This prevents previously loaded fixtures or runtime state from affecting
subsequent measurements.

### Memory measurement lifecycle

Each fixture follows the same lifecycle:

``` text
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

### Memory metrics

#### Baseline RSS

Memory resident in the process before loading the validator.

#### Validator RSS

Memory resident after the validator has been loaded and initialized.

For AJV this includes:

-   AJV runtime
-   JSON Schema
-   AJV instance
-   compiled validator

For Rust/WASM this includes:

-   WASM module
-   validator initialization
-   schema initialization

#### Fixture RSS

Memory resident after the Page fixture has been loaded and initialized.

For AJV this means the JSON document has been parsed into JavaScript
objects.

For Rust/WASM this includes the initialized page representation used by
the WASM validator.

#### After Warmup

Memory resident after the configured warmup validation phase.

#### Peak RSS

The highest Resident Set Size observed during the benchmark.

RSS represents process-level memory usage and may include:

-   JavaScript heap
-   native allocations
-   runtime overhead
-   allocator overhead
-   WebAssembly memory

#### Peak Heap

The highest JavaScript heap usage observed during the benchmark.

#### RSS Delta

``` text
Peak RSS - Baseline RSS
```

This represents the observed increase in process-level memory during the
benchmark.

#### Heap Delta

``` text
Peak Heap Used - Baseline Heap Used
```

This represents the observed increase in JavaScript heap usage.

### Memory interpretation

Memory results should not be interpreted from a single metric.

RSS is the primary metric for evaluating process-level memory usage
because it includes memory outside the JavaScript heap, including native
and WebAssembly allocations.

Heap metrics provide additional context about JavaScript-managed memory.

A lower `heapUsed` value does not necessarily mean that the complete
process consumes less memory.

Similarly, RSS should be interpreted together with the baseline,
validator initialization, fixture initialization, and peak values.

## Validation-only vs end-to-end

The POC distinguishes:

### Validation-only

Input is already prepared and the benchmark focuses on the validator.

### End-to-end

Includes work such as:

``` text
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

This distinction is particularly important for WASM because JavaScript ↔
WASM boundary costs can become measurable.

## Native Rust / Criterion

Criterion was added to measure the Rust validation operation directly.

Observed validation-only measurements were approximately:

  Fixture     Typical time
  --------- --------------
  Small           \~166 ns
  Medium         \~3.05 µs
  Large          \~28.5 µs
  Huge          \~282.7 µs

These results demonstrate that the Rust validation engine itself is much
faster than complete benchmark timings that include surrounding
application work.

## Benchmark noise

Local runs showed occasional spikes such as 30--50 ms while normal runs
were often around 15--30 ms.

Potential causes include:

-   OS scheduling
-   background processes
-   CPU frequency changes
-   thermal/power management
-   runtime effects
-   virtualization

Therefore, local results should be treated as comparative measurements
rather than absolute hardware specifications.

## Cross-machine testing

The benchmark was executed on both a Mac mini and a MacBook Pro.

The exact numbers differed, but the overall behavior was consistent:

-   Small pages are extremely fast.
-   Medium pages remain very fast.
-   Larger documents increasingly depend on the amount of data being
    traversed.
-   Native Rust and WASM remain in the same general performance class
    for validation-only workloads.
-   The complete WASM integration path can be substantially more
    expensive than pure validation.

## Planned controlled benchmark

The next methodology improvement is Docker.

The objective is reproducibility, not claiming that Docker produces
perfectly native hardware measurements.

The controlled environment should fix:

-   Node.js version
-   Rust version
-   dependency versions
-   schema
-   fixtures
-   warmup
-   number of runs
-   CPU limits
-   memory limits

The final benchmark should separately measure:

``` text
Startup
Schema compilation
JSON parsing
Validation
JS ↔ WASM boundary
Total operation
```

Additional measurements should include:

-   throughput
-   average latency
-   P95
-   P99
-   CPU usage
-   memory usage
-   startup time
-   artifact size
