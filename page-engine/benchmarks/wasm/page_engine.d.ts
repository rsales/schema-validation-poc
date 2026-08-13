/* tslint:disable */
/* eslint-disable */

export class PageHandle {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
}

export class PageValidator {
    free(): void;
    [Symbol.dispose](): void;
    load_page(page_json: string): PageHandle;
    constructor(schema_json: string);
    parse_page(page_json: string): void;
    validate_and_serialize_many(page_json: string, iterations: number): number;
    validate_data(page_json: string): string;
    validate_many(page_json: string, iterations: number): boolean;
    validate_resident(page: PageHandle): boolean;
    validate_resident_many(page: PageHandle, iterations: number): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_pagehandle_free: (a: number, b: number) => void;
    readonly __wbg_pagevalidator_free: (a: number, b: number) => void;
    readonly pagevalidator_load_page: (a: number, b: number, c: number) => [number, number, number];
    readonly pagevalidator_new: (a: number, b: number) => [number, number, number];
    readonly pagevalidator_parse_page: (a: number, b: number, c: number) => [number, number];
    readonly pagevalidator_validate_and_serialize_many: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly pagevalidator_validate_data: (a: number, b: number, c: number) => [number, number, number, number];
    readonly pagevalidator_validate_many: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly pagevalidator_validate_resident: (a: number, b: number) => number;
    readonly pagevalidator_validate_resident_many: (a: number, b: number, c: number) => number;
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
