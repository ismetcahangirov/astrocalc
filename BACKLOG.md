# Backlog

Reverse-chronological log of completed work on AstroCalc. Add an entry here
whenever a task is finished (merged or ready for review) — what was done,
and the related issue/PR numbers.

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
