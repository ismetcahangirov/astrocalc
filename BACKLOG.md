# Backlog

Reverse-chronological log of completed work on AstroCalc. Add an entry here
whenever a task is finished (merged or ready for review) — what was done,
and the related issue/PR numbers.

## 2026-07-19

- Offline calculation support (mobile) — #20 (core logic done; needs the
  `/natal-chart` backend endpoint to exercise end-to-end). Split
  `packages/calc-engine` into a React-Native-safe main entry (pure JS —
  `astronomy-engine` + `luxon` only) and a Node-only `/node` subpath
  carrying the `geo-tz`-backed timezone lookup (needs `fs`, can't run in
  RN). Added `computeNatalChart()` combining planetary positions, houses,
  and aspects into one result. `apps/mobile`: `natalChartService`
  orchestrates online/offline chart retrieval — backend chart (+ Pro
  interpretation) when reachable, on-device computation via the identical
  algorithm when offline (never showing Pro interpretation offline),
  queuing the offline result to sync once connectivity returns. Remaining:
  the backend `/natal-chart` + `/natal-chart/sync` routes this client
  calls don't exist yet.
- Chart result caching (performance) — #19. `apps/backend`: new `chart`
  module — `hashChartCacheKey()` (a stable SHA-256 fingerprint of
  birthDate/birthTime/lat/lng/houseSystem/orbConfig, per the issue's technical
  notes), the `ChartResultCache` interface + `getOrComputeChart()` helper (the
  entry point the future chart-computation endpoint will call), an in-memory
  implementation for tests/local dev, and `RedisChartResultCache` — an Upstash
  Redis implementation that namespaces cached entries under a per-user
  "generation" counter so `invalidate(userId)` is a single `INCR` rather than
  an unbounded key scan, with a configurable long TTL (`CHART_CACHE_TTL_SECONDS`,
  default 180 days) reclaiming orphaned entries left behind by invalidation.
  `ChartResultCache` implements the `ChartCacheInvalidator` port #7 already
  wired into `profileService` — `app.ts` now passes a real
  `RedisChartResultCache`/`InMemoryChartResultCache` instead of the
  documented `NoopChartCacheInvalidator` stand-in, so editing a birth-relevant
  profile field actually invalidates that user's cached chart. 17 new unit
  tests, including one asserting a cache hit is ≥10x faster than the original
  (simulated) computation. Remaining: there is no chart-computation
  service/route yet in this repo (not part of EPIC 3's rolled-out sub-issues)
  for `getOrComputeChart()` to actually be called from — it's ready for
  whichever future issue adds that endpoint.
- Multilingual interpretation text infrastructure — #18 (storage/service/API
  layer done; bulk seed content and mobile i18next wiring remain). New
  `packages/calc-engine` `interpretations` module: locale/category types, the
  ten interpreted planets, canonical subject-key builders for
  planet-sign/planet-house/aspect combinations, and
  `listInterpretationSubjects()` — the single source of truth for the full
  465-combination matrix. Added `findHouseNumber()` to `houses.ts` (which
  house a longitude falls in, wrap-safe). Backend: new `interpretation_texts`
  Postgres table (composite PK category+subjectKey+locale, admin-audit
  columns), a repository/cache/service layered the same way as the geocoding
  module (Redis-cached, in-memory fallback), and `/interpretations` routes —
  authenticated single/batch reads with automatic English fallback, plus
  admin-token-gated upsert and a completeness ("missing") audit endpoint for
  the EPIC 10 admin panel. 34 new backend tests + 9 new calc-engine tests.
  Remaining: the original-content generator/seed script to populate all 465
  combinations × 4 languages, and the mobile `natal-chart.json` i18next
  namespace + API client.

## 2026-07-18

- Historical timezone accuracy (geo-tz + luxon) — #16. `packages/calc-engine`:
  new `timezone` module that determines the historically-correct IANA zone from
  birth coordinates via `geo-tz` (the full "all" dataset, so pre-1970-divergent
  zones like `America/Indiana/Indianapolis` survive) and converts local birth
  time to UT via `luxon`'s zone-aware `DateTime` — never a static offset.
  Exposes `findTimeZones()`, `localTimeToUtc()`, and the end-to-end
  `resolveBirthInstant()` (returns the UT ISO string every downstream module
  consumes). 20 new unit tests (86 total green) covering the 2007 US DST
  extension, pre-1900 Paris Local Mean Time, Moscow's 2011/2014 non-DST offset
  changes, southern-hemisphere inverted DST (Sydney), Indiana's late DST
  adoption, ambiguous/non-existent DST-boundary local times, and validation.
- Planetary position calculation (astronomy-engine integration) — #13.
  `packages/calc-engine`: new `computePlanetaryPositions()` — apparent
  geocentric tropical ecliptic longitude, sign/degree, signed longitudinal
  speed, and retrograde status for the Sun, Moon, Mercury–Pluto, both lunar
  nodes (true or mean model), and optional Chiron (opt-in two-body Kepler
  propagation from JPL osculating elements, approximate). 22 new unit tests
  (47 total green), including accuracy checks against JPL Horizons reference
  values (every body within ±1 arcminute) and independent cross-checks
  against `astronomy-engine`'s own node-search/frame machinery.
- House system calculation (Placidus default, polar-latitude fallback) — #14.
  `packages/calc-engine`: new `computeHouses()` — Ascendant, Midheaven, and
  twelve numbered cusps for Placidus (default), Whole Sign, and Koch, derived
  from first principles (RAMC, true obliquity, iterative semi-arc division for
  Placidus). Inside the polar circles, where Placidus/Koch cusps are
  mathematically undefined, the result transparently falls back to Whole Sign
  and explains why (`fallbackApplied`/`fallbackReason`). Requires a full
  date-time by design, so callers without a known birth time simply omit the
  house section. 21 new unit tests (68 total green), including ground-truth
  checks against `astronomy-engine`'s own rotation matrices and a Svalbard
  polar-fallback case.
- Aspect calculation + configurable orbs — #15 (calc-engine layer done; backend
  admin config in progress). `packages/calc-engine`: new `computeAspects()` that
  finds the five major aspects for every body pair, reporting aspect type, exact
  degree difference, orb (deviation), and applying/separating status; orbs are
  configurable per aspect type over a documented `DEFAULT_ORBS`. Added signed
  longitudinal `speed` to planetary positions to drive applying/separating. 18
  new unit tests (86 total green). Backend: added the `aspect_orb_config`
  Postgres table (the shared, admin-editable, Redis-cached orb store). Remaining:
  the backend repository/cache/service/route wiring for the admin orb endpoint.
- SVG/Skia "wheel" visualization — #17 (geometry/theme foundation only; the
  Skia rendering component is not part of this work). `apps/mobile/src/chart`:
  renderer-agnostic `computeWheelLayout()` that turns planet/house/aspect data
  into flat drawable primitives — zodiac wedges, degree ticks, house-cusp
  lines, de-collided planet glyphs (a "stellium" spreading algorithm), and
  aspect chords — plus gold/dark theme tokens and per-aspect-type stroke
  styles matching the brand. Pure TypeScript (no React Native/Skia import), so
  it runs under plain Node Vitest. 19 new unit tests. Remaining: the actual
  `react-native-skia` `<Canvas>` component that draws these primitives, the
  60fps performance pass, and the retrograde "R" marker rendering.
- Implemented Google OAuth (mobile + backend) — #2. Backend: `apps/backend`
  Express + TS scaffold with `POST /auth/google` that verifies the Google ID
  token (`aud`/`iss`/`exp`/`email_verified`) via `google-auth-library`,
  find-or-creates the user + profile (with email-based account linking), opens
  a session, and issues JWT access+refresh tokens; Drizzle schema for
  users/profiles/sessions; 20 unit/integration tests (Vitest + Supertest).
  Mobile: `apps/mobile` Expo scaffold with a Google Sign-In button
  (`@react-native-google-signin/google-signin`, `expo-auth-session` fallback),
  token exchange with the backend, SecureStore token storage, and clear error
  display on the login screen.
- Set up GitHub project structure: 15 labels, 8 milestones (M0–M7) per the
  AstroCalc master spec.
- Piloted the Epic → Sub-issue rollout for two epics (translated to
  English after an initial Azerbaijani-language pass):
  - `[EPIC] Authentication & User Profile` (#1) — 9 sub-issues (#2–#10)
  - `[EPIC] Natal Chart` (#11) — 10 sub-issues (#12–#21)
  - Remaining 13 epics from the master spec still to be rolled out.
- Added `CLAUDE.md` and this `BACKLOG.md`, documenting the GitHub workflow
  convention (pull `main` → branch per task → labeled PR) — #22.
- Wrote a full `README.md` (overview, features, tech stack, roadmap,
  security posture) and `CONTRIBUTING.md` (workflow, commit convention,
  PR checklist) — #24. Spun out three follow-ups rather than blocking on
  them: local dev setup guide, license decision, lint/formatting tooling.
- Implemented the profile creation/edit screen — #7. Backend: `PATCH
  /profile` now also accepts `avatarUrl` (was missing from the onboarding
  pass); `profileService` gained a `ChartCacheInvalidator` port that fires
  when a saved patch actually changes a birth-relevant field
  (birthDate/birthTime/birthTimeKnown/birthPlace*), defaulting to a no-op
  until EPIC 3's chart-caching sub-issue (#19) exists to implement it.
  Mobile: a dark/gold `ProfileScreen` (`app/profile.tsx`) lets the user
  re-edit every onboarding field, warns when a save will recompute their
  chart, and a minimal `LocaleProvider` (en/az) makes language changes apply
  immediately across the UI — ahead of #18's interpretation-text i18n.
  Note: #6 (onboarding flow) and #19 (chart caching) are still unbuilt, so
  this screen isn't reachable from a signed-in home screen yet and the cache
  invalidation call is a documented no-op pending #19.
