/**
 * Node-only entry point of `@astrocalc/calc-engine`, imported as
 * `@astrocalc/calc-engine/node`.
 *
 * It re-exports the entire RN-safe public API (`./index`) **plus** the
 * `geo-tz`-backed coordinate → IANA-timezone lookup, which pulls in a
 * multi-megabyte dataset read from disk via Node's `fs` and therefore must not
 * reach the React Native bundle. Backend code (which resolves the birth-place
 * timezone at profile-save time) imports from here; the mobile app imports the
 * default `@astrocalc/calc-engine` entry only.
 */
export * from './index';
export { findTimeZones, resolveBirthInstant, type ResolvedInstant } from './timezone-lookup';
