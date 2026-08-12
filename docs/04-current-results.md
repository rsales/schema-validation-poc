# Schema Validation POC --- Current Results

## Current status

Working implementations exist for:

-   Node.js validation
-   Native Rust validation
-   Rust → WebAssembly compilation
-   `wasm-bindgen` bindings
-   Node/WASM validation
-   Native Rust benchmarking
-   Criterion validation-only benchmarking
-   Isolated AJV memory benchmarking

The Rust/WASM memory benchmark is the next measurement being
implemented.

## WASM API

The generated module exposes:

``` ts
export function init_validator(schema_json: string): void;

export function validate_page(page_json: string): boolean;
```

Validation has been confirmed for both valid and invalid pages:

``` text
Rust/WASM validation: true
Rust/WASM validation: false
```

## Latest native Rust benchmark

  Fixture          Size   Blocks     Avg/run     P95/run     Ops/sec
  --------- ----------- -------- ----------- ----------- -----------
  Small         0.35 KB        2   17.600 ms   29.096 ms   5,681,978
  Medium        9.03 KB       50   29.967 ms   33.088 ms     333,702
  Large        89.44 KB      500   29.573 ms   39.935 ms      33,814
  Huge        899.63 KB    5,000   29.457 ms   33.581 ms       3,395

The average is the time for all iterations in a benchmark run, not the
latency of one validation.

## Earlier validation-only WASM benchmark

Approximately:

  Fixture     Ops/sec
  --------- ---------
  Small         5.88M
  Medium         369K
  Large         34.4K
  Huge           3.4K

The WASM results were close to native Rust for the same
validation-oriented workload.

## AJV memory benchmark

The current memory benchmark runs each fixture in an isolated Node.js
process and measures the memory lifecycle from process baseline through
validator initialization, fixture initialization, warmup, and
validation.

Latest observed results:

  ---------------------------------------------------------------------------------------
  Fixture     Baseline   Validator   Fixture    After Peak RSS     Peak      RSS     Heap
                   RSS         RSS       RSS   Warmup              Heap    Delta    Delta
  --------- ---------- ----------- --------- -------- -------- -------- -------- --------
  Small       70.91 MB    83.20 MB  83.22 MB 83.88 MB 86.05 MB 14.26 MB 15.14 MB  6.20 MB

  Medium      75.03 MB    83.53 MB  83.55 MB 84.20 MB 86.55 MB 14.25 MB 11.52 MB  6.22 MB

  Large       74.91 MB    83.00 MB  83.34 MB 83.47 MB 85.81 MB 13.45 MB 10.91 MB  5.43 MB

  Huge        75.05 MB    83.11 MB  86.94 MB 87.08 MB 87.44 MB 13.96 MB 12.39 MB  5.98 MB
  ---------------------------------------------------------------------------------------

### Initial observations

The validator initialization introduces a significant memory footprint
relative to the Node.js process baseline.

For the Medium, Large, and Huge fixtures, validator initialization
increases RSS by approximately 8 MB.

The Huge fixture also shows a substantially larger fixture footprint
than the smaller fixtures, increasing RSS by approximately 3.8 MB after
fixture initialization.

The smaller fixtures contribute comparatively little RSS because their
JSON documents are small relative to the overall Node.js runtime and
validator footprint.

> **Note:** The Small fixture produced a lower-than-usual process
> baseline in this run. Because process-level memory measurements are
> sensitive to runtime initialization and OS-level conditions,
> individual runs should not be treated as statistically definitive.
> Repeated controlled runs are required before drawing final
> architectural conclusions.

### Memory interpretation

RSS is currently the primary process-level memory metric.

Heap usage is tracked as a complementary metric because RSS can include
native allocations, runtime overhead, allocator behavior, and, for the
WASM implementation, WebAssembly memory.

The current AJV results should therefore be considered an initial
baseline rather than a final memory comparison.

## Key observation

``` text
Rust Native ≈ Rust/WASM
```

for pure validation.

The larger cost appears when the full Node.js → WASM → Rust path is
included.

Therefore, the current evidence suggests that WebAssembly itself is not
the primary problem; the integration boundary and surrounding runtime
work are important contributors.

## Architectural interpretation

### Node.js-only

``` text
Node.js
   |
   v
AJV
```

is currently the pragmatic choice because it avoids:

-   WASM boundary overhead
-   Rust build requirements
-   additional generated artifacts
-   cross-language debugging
-   additional deployment complexity

### Cross-runtime validation

``` text
             Rust validator
                   |
             +-----+-----+
             |           |
           Native       WASM
             |           |
          Rails        Node
                       Browser
```

becomes more compelling when one validation implementation must be
reused across multiple runtimes.

The primary benefit is portability and shared logic, not simply raw
validation speed.

## Current hypothesis

> For a Node.js-only Page Builder or Headless CMS, AJV is likely the
> better engineering choice. Rust + WASM becomes valuable when
> validation logic must be shared across runtimes or environments.

This hypothesis should be validated with the controlled Docker benchmark
and the remaining CPU, startup, artifact-size, and WASM memory
measurements.
