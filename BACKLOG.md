# Backlog

Reverse-chronological log of completed work on AstroCalc. Add an entry here
whenever a task is finished (merged or ready for review) — what was done,
and the related issue/PR numbers.

## 2026-07-19

- Auth epic cleanup: account linking, a JWT clock bug, and closing out
  already-done work — #2, #4, #5, #7, #10 (all sub-issues of #1). Swept every
  open sub-issue of the auth epic to see which were genuinely closeable in one
  PR:
  - **#4 (account linking) — real gap, implemented.** `authService.signInWithGoogle`
    used to auto-link a Google sign-in to any existing account sharing its
    email, with no user confirmation — exactly the behavior #4's own
    acceptance criteria call out as wrong (email/phone spoofing risk), and
    already flagged twice in this log as untouched. Fixed: a same-email match
    now returns a `link_required` outcome (masked email, no session) instead
    of a token pair. New `auth/accountLinkToken.ts` mints a short-lived
    (10 min default) signed token carrying the pending Google identity; new
    `POST /auth/link/confirm` (bearer-authed) completes the link once the
    caller has proven ownership of the existing account some other way (e.g.
    WhatsApp OTP), and only if the authenticated session matches the token's
    candidate account — otherwise `account_link_mismatch` (403). Every
    completed link is recorded in a new `account_link_audit` table. Mobile:
    `useGoogleAuth` surfaces `linkRequired` (not an error); `LoginScreen`
    shows "an account already exists for `jo**@example.com`, continue with
    WhatsApp"; `OtpLoginScreen` takes an optional `linkToken` prop and
    exchanges it via `confirmAccountLink` right after a successful OTP verify.
    Narrower than the full policy: only handles Google-finds-existing-email;
    there's still no path for WhatsApp-first accounts to add/link an email
    later (no email field exists in that flow).
  - **#5 (JWT/session management) — real bug, fixed.** `sessionService.test.ts`
    had 6 failing tests (flagged in the #7 entry below as "tracked under #5"
    but never actually fixed). Root cause: `tokens.ts` signs with an
    injectable clock (for deterministic tests) but verified with
    `jwt.verify`'s real system clock — a test clock set far from wall-clock
    time made every token look expired. Fixed by passing `clockTimestamp` into
    `jwt.verify`. All 6 tests now pass; combined with the pre-existing (and
    already-tested) rotation/reuse-detection/admin-revoke/secure-storage
    behavior, every acceptance criterion on #5 is now genuinely verified.
  - **#7 (profile edit) — already done, verified and closing.** Its one open
    criterion (birth-data edits invalidating the cached chart) was completed
    for real back in the #19 chart-caching entry below (`app.ts` passes a real
    `RedisChartResultCache`/`InMemoryChartResultCache` instead of the no-op
    invalidator) — just never linked back to close the issue. Re-verified the
    wiring; no code changes needed here.
  - **#10 (rate-limiting/abuse protection) — mostly already done, one real gap
    closed.** OTP throttling, lockout, and admin-alert logging were already
    fully wired server-side. The gap: `useOtpAuth` surfaced the backend's raw
    English `AuthError.message` directly, regardless of app language —
    failing #10's own "a clear, friendly error message (localized)" criterion.
    New `otp/errorMessages.ts` maps error codes to translated strings (EN/AZ),
    appending a formatted countdown for cooldown/lockout/rate-limit errors the
    same way the screen already displays other countdowns. Extracted
    `ApiError`/`OtpApiError` into dependency-free `api/apiError.ts` /
    `otp/otpApiError.ts` so this pure mapping logic (and its test) don't drag
    in `config.ts` → `expo-constants`, which doesn't parse cleanly under
    Vitest's SSR transform — a real, previously-latent issue this is the first
    test to have hit.
  - **#2 (Google OAuth) — already done, verified and closing.** Mobile button
    (with an `expo-auth-session` fallback) + backend `google-auth-library`
    verification (aud/iss/exp/email_verified) + auto-create/session were all
    already implemented and tested; no code changes needed.
  - **Not closed: #9 (account deletion & GDPR export).** Still genuinely
    incomplete — `LogExportNotifier` is a console.log stub with no real
    email/push channel, so a completed export has no way to reach the user
    with the download link outside local logs (already flagged in the entry
    below). Left alone rather than picking an email provider without being
    asked to.
  Also fixed 2 pre-existing `tsc --noEmit` errors unrelated to any specific
  issue (`config/duration.ts`'s `UNIT_SECONDS` lookup, `accountRoute.ts`'s
  unguarded `req.params.jobId`) found while getting a clean baseline before
  touching this code.

- WhatsApp OTP login + account deletion/GDPR export mobile UI — #3, #9. Both
  sub-issues already had complete, tested backend implementations (Google
  OAuth, OTP, JWT/session revocation, rate-limiting, and account/export were
  all wired into `app.ts` with no mobile screens on top); this PR adds only
  the missing mobile side. `apps/mobile`: new `OtpLoginScreen` — a two-step
  phone → code flow surfacing the backend's abuse-protection state
  (expiry/resend countdowns, remaining verification attempts, and a lockout
  message), reached from `LoginScreen` via a new "Continue with WhatsApp"
  option that switches in place (no new route, reuses the existing
  `onSignedIn` handoff). On a WhatsApp quota exhaustion the backend's
  `alternative: 'google'` flag now surfaces as a promoted "Use Google
  instead" action. New `AccountScreen` (`/account`, linked from a new
  "Manage account" line on the profile screen): a confirmation-phrase gated
  "Delete account" section and a "Request data export" section that polls
  job status until terminal. New pure-logic modules with unit tests —
  `otp/validation.ts` (phone/code format validation, countdown formatting)
  and `account/exportStatus.ts` (status → message mapping) — matching this
  app's convention of testing only non-`.tsx` logic. New `otpApi.ts` (plain
  fetch, unauthenticated — mirrors `authApi.ts`) and `accountApi.ts`
  (authenticated via `httpClient.ts`). 17 new unit tests. Closes #3.
  Remaining on #9: the export-ready notifier is still a console.log stub
  (`LogExportNotifier`) — no real email/push channel exists yet, so a
  completed export currently has no way to reach the user with the
  download link outside local logs; this screen can only show job status,
  not the link itself, until that channel is wired up. Also untouched:
  #4 (account-linking policy) — Google sign-in still auto-links by email
  with no user confirmation step, as already noted in the #6/#8 entry below.

- Onboarding flow (mobile) — #6, plus closed a real gap in #8 (birth-place
  search). Backend: `/geocoding/search` was fully implemented and tested but
  never mounted in `app.ts` — fixed, with Redis-backed cache/rate-limiter when
  configured, in-memory fallback otherwise (matches the existing `buildXxx`
  wiring pattern). `apps/mobile`: new `OnboardingScreen` — a five-step wizard
  (name → birth date → birth time → birth place → language) with back
  navigation, a progress indicator, the required "I don't know my birth time"
  explanation (house placements will be skipped), and an "I'll finish this
  later" exit on every step that saves a draft via `completeOnboarding` and
  resumes from wherever the user left off next time. New shared
  `BirthPlaceSearchField` (debounced autocomplete over `/geocoding/search`,
  manual lat/lng/timezone fallback when a place isn't found) — used by both
  onboarding and the profile-edit screen (#7), replacing its old plain-text
  birth-place input. New `app/index.tsx` auth gate: checks the stored session
  on launch and after sign-in, then routes to login, onboarding, or the
  profile screen (still this app's post-auth landing point — no home/dashboard
  screen exists in any merged epic yet). `LoginScreen` now takes an
  `onSignedIn` callback so the gate can re-check after a successful sign-in
  (previously sign-in succeeded but the app never navigated anywhere).
  Deviated from the issue's "react-hook-form + zod" technical note in favor of
  the plain-state validation pattern the merged #7 profile screen already
  uses — consistent with the rest of the app, no new dependency for equivalent
  behavior. 9 new unit tests for the step-order/validation logic (pure `.ts`,
  matching this app's test convention of not unit-testing `.tsx` components).
  Remaining: WhatsApp OTP has no mobile UI yet (#3's backend is done); birth
  place timezone is still a manual/optional field — there's no on-device way
  to derive it (the RN-safe calc-engine build excludes the `geo-tz`/Node
  timezone module) and the backend doesn't derive it either; only EN/AZ are
  wired on mobile, not the full AZ/TR/EN/RU set; #4 (account-linking policy)
  is untouched — Google sign-in still auto-links by email with no user
  confirmation step, which the issue's own acceptance criteria call out as
  the wrong behavior.
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
