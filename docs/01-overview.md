# Project Overview

## Purpose

This project is a proof of concept designed to investigate JSON Schema validation performance across different execution environments.

The original motivation is a page-builder architecture where page definitions are represented as JSON and need to be validated before being persisted or delivered to clients.

The experiment compares:

- Node.js + TypeScript + Ajv
- Rust + JSON Schema
- Rust compiled to WebAssembly

## Problem

A page can contain a potentially large number of nested blocks.

Before the page can be persisted, the structure must be validated against a JSON Schema.

The main question is:

> Can Rust/WASM provide meaningful performance improvements for this validation workload?

## Experimental Approach

The project deliberately separates:

1. Schema compilation.
2. JSON parsing.
3. JavaScript ↔ WASM communication.
4. JSON Schema validation.
5. End-to-end execution.

This prevents one benchmark from hiding where the actual cost comes from.

## Success Criteria

The experiment does not assume that Rust/WASM will be faster.

A successful experiment should identify:

- where the time is spent;
- whether WASM introduces meaningful overhead;
- whether native Rust provides a faster validator;
- whether specialized code generation changes the result;
- at which document sizes each implementation becomes advantageous.
