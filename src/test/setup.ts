// jsdom's Blob/File implementation is missing `arrayBuffer()` (as of
// jsdom 25), unlike every real browser. Swap in Node's spec-compliant
// implementations so tests exercise the same Blob API the app relies on.
import { Blob, File } from 'node:buffer';

globalThis.Blob = Blob as unknown as typeof globalThis.Blob;
globalThis.File = File as unknown as typeof globalThis.File;
