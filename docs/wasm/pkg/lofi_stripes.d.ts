/* tslint:disable */
/* eslint-disable */
/**
* @param {Uint8Array} font_bytes
*/
export function set_font(font_bytes: Uint8Array): void;
/**
* @param {Uint8Array} image_bytes
*/
export function set_image(image_bytes: Uint8Array): void;
/**
* @param {string} text_top
* @param {string} text_bottom
* @param {number} font_size
* @param {number} stripe_count
* @param {number} stripe_height_percent
* @returns {Uint8Array}
*/
export function draw_image(text_top: string, text_bottom: string, font_size: number, stripe_count: number, stripe_height_percent: number): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly set_font: (a: number, b: number) => void;
  readonly set_image: (a: number, b: number) => void;
  readonly draw_image: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
