# Schema Validation POC — Overview

## Purpose

This proof of concept evaluates different approaches for validating Page Builder JSON documents against a JSON Schema.

The main question is whether a Rust-based validator compiled to WebAssembly provides enough practical benefit to justify the additional complexity when compared with a native JavaScript validator such as AJV.

The experiment also evaluates the same Rust validator in its native form to separate the validation engine's performance from the JavaScript/WASM boundary.

## Current approaches

1. **Node.js + AJV**
2. **Native Rust + `jsonschema`**
3. **Rust + WebAssembly + `wasm-bindgen`**

## Current conclusion

The Rust validator is very fast when executed natively. The WebAssembly version is also close to native Rust for the validation workload.

However, when the complete Node.js → WASM → Rust path is measured, JavaScript/WASM integration overhead becomes significant.

For a Node.js-only Page Builder or Headless CMS, AJV is therefore currently the more pragmatic option.

Rust + WASM becomes more interesting when the same validation engine must be shared across runtimes such as Node.js, Ruby/Rails, or browser applications.

## Next direction

The next experiment is a reproducible Docker-based benchmark comparing Node.js + AJV, native Rust, and Rust + WASM under the same benchmark conditions.
