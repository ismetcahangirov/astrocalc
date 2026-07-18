/**
 * The mobile app's window onto `@astrocalc/calc-engine`.
 *
 * The engine's main entry is React Native safe — it depends only on pure-JS
 * `astronomy-engine` + `luxon`, never on `geo-tz`/Node `fs` — so the app can
 * compute a full natal chart on-device with no extra polyfills (issue #20). The
 * one `geo-tz`-backed piece, coordinate → timezone lookup, stays on the backend
 * (imported there from `@astrocalc/calc-engine/node`); on the device we reuse
 * the IANA zone the backend already resolved and stored on the profile.
 *
 * Offline orchestration (fetch-vs-compute, caching, sync, Pro gating) lives in
 * `src/offline/natalChartService.ts`; this module just re-exports the engine
 * surface those callers need.
 */
export {
  CalcEngineError,
  computeNatalChart,
  type NatalChart,
  type NatalChartInput,
  type NatalChartOptions,
} from '@astrocalc/calc-engine';
