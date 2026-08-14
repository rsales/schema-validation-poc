# Schema Validation POC --- Next Steps

## Current progress

### Completed

-   AJV performance benchmark
-   Rust/WASM performance benchmark
-   Native Rust benchmark
-   Criterion validation-only benchmark
-   Isolated AJV memory benchmark
-   Memory metric definitions and process-isolation methodology

### In progress

-   Rust/WASM memory benchmark

### Planned

-   P99 latency
-   CPU usage
-   Startup time
-   Artifact size
-   Controlled Docker benchmark
-   Final architectural analysis

## 1. Complete Rust/WASM memory benchmark

The Rust/WASM memory benchmark should use the same lifecycle and metrics
as the AJV benchmark:

``` text
Process start
     |
     v
Baseline RSS
     |
     v
WASM module / validator initialization
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

The goal is to make the AJV and Rust/WASM memory measurements directly
comparable.

## 2. Add P99 latency

The current performance benchmark reports average latency and P95.

P99 should be added to capture tail behavior:

``` text
Average
P95
P99
```

This is particularly useful for evaluating occasional runtime or
boundary spikes.

## 3. Measure CPU usage

CPU consumption should be measured during the validation workload.

The goal is to determine whether one implementation achieves similar
throughput while requiring more or less CPU time.

CPU measurements should be collected independently from the latency
benchmark when possible to avoid measurement overhead affecting the
timing results.

## 4. Measure startup time

Startup should be separated from steady-state validation:

``` text
Process start
    |
    v
Runtime initialization
    |
    v
Validator initialization
    |
    v
Ready
```

For AJV, startup includes loading AJV and compiling the schema.

For Rust/WASM, startup should include loading the generated WASM module
and initializing the validator.

## 5. Measure artifact size

The WASM implementation should report:

-   `.wasm` artifact size
-   generated JavaScript binding size
-   TypeScript declaration size, if relevant

Compression can be reported separately if deployment size is important.

## 6. Controlled Docker benchmark

After the individual benchmarks are established, run the complete
comparison in controlled Docker environments.

The objective is reproducibility, not claiming perfectly deterministic
hardware measurements.

The environment should fix:

-   Node.js version
-   Rust version
-   dependency versions
-   schema
-   fixtures
-   warmup
-   number of runs
-   CPU limits
-   memory limits

The benchmark should compare:

``` text
Node.js + AJV
Native Rust
Rust + WASM
```

## 7. Separate benchmark dimensions

The final benchmark should distinguish:

``` text
Startup
   |
Schema compilation / initialization
   |
JSON parsing / preparation
   |
Validation
   |
JS ↔ WASM boundary
   |
Total operation
```

This prevents a fast validation engine from being incorrectly
interpreted as a fast end-to-end architecture.

## 8. Final comparison matrix

The final report should compare:

  Metric                     Node + AJV   Native Rust   Rust + WASM
  ------------------------ ------------ ------------- -------------
  Throughput                                          
  Average latency                                     
  P95                                                 
  P99                                                 
  CPU usage                                           
  Memory usage                                        
  Startup time                                        
  Artifact size                                       
  Portability                                         
  Integration complexity                              

## 9. Architectural decision

The final recommendation should not be based on throughput alone.

The decision should consider:

``` text
Performance
    +
Memory
    +
CPU
    +
Startup
    +
Artifact size
    +
Integration complexity
    +
Runtime portability
```

The expected outcome is one of:

### Option A --- AJV

Use AJV when the system is primarily Node.js-based and cross-runtime
validation is not required.

### Option B --- Rust/WASM

Use Rust/WASM when the same validation implementation must be shared
across multiple runtimes or environments.

### Option C --- Hybrid

Use Rust as the canonical validation core and expose it through native
bindings or WASM depending on the consuming runtime.

## Current direction

The current evidence favors AJV for a Node.js-only Page Builder /
Headless CMS.

The Rust/WASM architecture remains strategically interesting when
validation logic needs to be shared across Node.js, Rails, browsers, or
other runtimes.

The next decisive evidence should come from the controlled benchmark and
the remaining resource-usage measurements.
