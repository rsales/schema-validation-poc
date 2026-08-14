# Schema Validation POC — Architecture

## Current architecture

```text
                         Page JSON
                            |
                            v
                     JSON Schema
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
            Node          Rust        Rust/WASM
             AJV          Native          |
              |             |             |
              +-------------+-------------+
                            |
                         Result
                    VALID / INVALID
```

## Node.js / AJV

```text
Node.js
   |
   v
AJV
   |
   v
JSON Schema validation
```

This is the simplest architecture when the CMS and backend are already Node.js-based.

## Native Rust

```text
Rust process
    |
    v
jsonschema
    |
    v
Page validation
```

The native implementation establishes the performance of the Rust validation engine without a WASM boundary.

## Rust + WebAssembly

```text
Node.js
   |
   v
wasm-bindgen
   |
   v
WebAssembly
   |
   v
Rust jsonschema
   |
   v
Validation result
```

The generated bindings currently expose:

```ts
export function init_validator(schema_json: string): void;

export function validate_page(page_json: string): boolean;
```

The schema is initialized once and the validator is reused.

## Intended lifecycle

```text
Application startup
       |
       v
Load schema
       |
       v
Initialize validator
       |
       v
Keep validator alive
       |
       v
Validate pages
```

Schema compilation should not happen for every page.

## Page Builder relevance

```text
CMS
 |
 v
Page JSON
 |
 v
Schema validation
 |
 +---- invalid --> reject
 |
 +---- valid ----> persist
                       |
                       v
                    Client
```

If everything is Node.js, AJV is likely the simplest solution.

If validation must be shared between Node.js, Rails, and browser environments, a Rust core compiled to WASM becomes more compelling.
