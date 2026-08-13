/* tslint:disable */
/* eslint-disable */

/**
 * Compiled WASM validator.
 *
 * The schema is parsed and compiled exactly once
 * when the validator is created.
 *
 * Subsequent calls only parse the page and execute
 * the compiled validation rules.
 */
export class PageValidator {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Creates a compiled validator from a schema JSON.
     *
     * Schema parsing and regex compilation happen once.
     */
    constructor(schema_json: string);
    /**
     * Validates a page using the compiled schema.
     *
     * The page is parsed on every call.
     */
    validate(page_json: string): string;
}

/**
 * Baseline WASM API.
 *
 * Compiles the schema and parses the page on every call.
 * Kept intentionally for benchmark comparison.
 */
export function validate_page(schema_json: string, page_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_pagevalidator_free: (a: number, b: number) => void;
    readonly pagevalidator_new: (a: number, b: number) => [number, number, number];
    readonly pagevalidator_validate: (a: number, b: number, c: number) => [number, number, number, number];
    readonly validate_page: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
