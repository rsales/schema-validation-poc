# Schema Validation POC

Experimental repository for researching validation architectures for Page Builder and Headless CMS systems.

The repository currently contains two related but independent experiments:

## Projects

### schema-validation

Benchmark and comparison of:

- Node.js + AJV
- Native Rust
- Rust + WebAssembly

The goal is to understand:

- validation performance
- memory usage
- runtime overhead
- WASM boundary costs
- operational complexity
- cross-runtime trade-offs

See [schema-validation/](./schema-validation/).

### page-engine

Experimental Page Builder validation engine implemented in Rust.

Unlike the benchmark project, Page Engine explores the architecture of a domain-specific validation engine capable of incremental validation.

It currently includes:

- PageNode model
- Component schema
- compiled schema
- NodePath
- PageChange
- change resolution
- affected scope calculation
- targeted validation
- incremental validation
- full vs incremental benchmarks

See [page-engine/](./page-engine/).

## Relationship

The two projects are related but intentionally separated.

`schema-validation` asks:

> Which validation execution strategy is most efficient?

`page-engine` asks:

> How can a Page Builder validation engine avoid validating the entire document after every change?

The second project emerged from the findings of the first experiment.
