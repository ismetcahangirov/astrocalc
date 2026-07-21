# Backlog

Reverse-chronological log of completed work on AstroCalc. Add an entry here
whenever a task is finished (merged or ready for review) — what was done,
and the related issue/PR numbers.

## 2026-07-21

- Octagram age-forecast timeline drawn on the perimeter — mobile (#97). The
  figure drew the age *ruler* (ticks + age numbers) but not the ruling arcana of
  each life sub-period, which reference calculators (`destinymatrixchart.com`)
  show as a dense ring of small numbers. Added it: the eight decade vertices
  (ages 0/10/…/70) are the outer discs, and between each adjacent pair the
  sub-period arcana are found by recursive bisection — each intermediate is the
  reduced sum of its two neighbours — three levels deep for seven sub-points per
  decade (56 total). `computeOctagramLayout()` places each on its own age angle
  (4.5°/year, the same scale the ruler uses) in a band just outside the discs;
  `OctagramChart` draws them tiny and dim so they read as a background layer, not
  competing with the discs. A local `reduceArcana()` re-expresses the calc-engine
  reduction (not exported from the package). geometry.test.ts: +4 cases,
  including an **external cross-check** — the 20→30 arc for 2000-09-13 reproduces
  `destinymatrixchart.com`'s `20, 11, 4, 20, 6, 4, 15` exactly. Mobile 188 green;
  tsc + eslint + prettier clean. Verified on a physical device.

- Octagram money/relationship line drawn on the figure — mobile. Previously the
  five money/relationship arcana (`entry–toEntry–core–toPartner–partner`, §5.1)
  were read only from the breakdown, and the figure showed just a hint (a single
  segment between the two Svadhisthana axis points plus the `$`/`♥` marks),
  because the method sources give the line no single agreed *figure* position.
  Cross-checking a user's chart (13.09.2000) against `destinymatrixchart.com`
  surfaced this as a completeness gap: reference calculators plot all five
  points. Added the three inner arcana (`toEntry`, `core`, `toPartner`) as discs
  in `computeOctagramLayout()`, placed on a quadratic bow from `entry` (south
  0.5) to `partner` (east 0.5) whose control is pushed toward the SE corner — the
  bow is what keeps `core` clear of the SE ancestral arm's inner point it would
  collide with on the straight chord. The two endpoints are **not** re-emitted
  (they are already the two Svadhisthana axis discs), and the `$`/`♥` marks now
  flank `core`. `moneyLine` became the 4-segment bowed polyline. New node kind
  `'money'`; `OctagramChart` draws it like the other inner nodes. **Emotional /
  chakra-map points were deliberately *not* added to the figure** — they have no
  agreed octagram position and already appear in the health table, so plotting
  them would mean inventing coordinates (the exact non-canonical placement the
  reference site uses). geometry.test.ts: +2 cases (bowed polyline connectivity;
  the three inner arcana on the line, in order, clear of the SE arm). Mobile 184
  green; tsc + eslint clean.

## 2026-07-20

- Matrix interpretation content — #80 (22 arcana base meanings) + #81
  (position-specific meanings), the Matrix half of `[EPIC] Numerology and Matrix
  interpretation content` (#76), which this completes. **682 Matrix subject keys
  × 4 locales (az/tr/en/ru) = 2,728 rows.** #68 (the Ladini method spec) and the
  Matrix calc-engine domain (#67) were already merged, so the position list was
  settled — the only thing missing was the interpretation *enumerator*, the
  Matrix analog of `listNumerologySubjects()`. Added `listMatrixSubjects()` +
  `matrixSubjectKey()` + a 31-member `MatrixSubjectKind` (the `arcana` base for
  #80, plus the 30 named octagram positions for #81) and folded it into
  `listInterpretationSubjects()`, exactly as numerology was.
  **The 30 positions are precisely the ones `formatMatrixDetails()` (mobile)
  labels** — the 5 core points, 6 purposes, 7 ancestral positions, the 5-point
  money/relationship line, and the 7 chakra rows — so every value the breakdown
  shows has a reading behind it. Written per position, not once per arcana: the
  Emperor on the day point ("your inborn portrait") and on the father's line
  ("the material inheritance of your father's line") are different sentences off
  the same arcana meaning, the same compositional approach the astrology and
  numerology baselines use. The health-map *summary* row and the ancestral
  corners' inner/middle triples are deliberately not keyed — they are derived
  read-outs of arcana already covered, shown only as numbers, not independently
  interpreted points.
  Required set 650 → **1,332 subjects (2,600 → 5,328 rows)**; the calc-engine
  guard that asserted Matrix was absent from `listInterpretationSubjects()` was
  flipped, and the service/route/seed count expectations updated to `+682`.
  calc-engine 377, backend 352 green; eslint + prettier clean. With #77–#82 all
  landed, epic #76 is complete.
- Numerology interpretation content — #77, #78, #79 (content) + #82 (seed +
  parity), the numerology half of `[EPIC] Numerology and Matrix interpretation
  content` (#76). All **185 numerology subject keys × 4 locales (az/tr/en/ru) =
  740 rows** of original text: the core four (Life Path, Expression, Soul Urge,
  Personality), the extended/cycle numbers (Birthday 1–31, Maturity, Personal
  Year/Month), and Pinnacles 1–4 / Challenges 1–4. Written per position, not
  once per number: a 7 Life Path and a 7 Personal Year are different sentences,
  because each number's meaning is woven with a position-specific frame (the
  same compositional approach the astrology baseline uses). Challenges carry
  their own lesson phrasing so 0 reads as a genuine value, and the four Pinnacle
  positions differ by life stage (early → late).
  **#82 folds `listNumerologySubjects()` into `listInterpretationSubjects()`**
  now that content exists behind every key, so the backend seed-parity test and
  the admin completeness checklist both enumerate numerology — a key with no
  text in any locale now fails the test instead of surfacing as a blank section.
  The required set went 465 → 650 subjects (1,860 → 2,600 rows); the calc-engine
  guard test that asserted numerology was *not* yet folded in was flipped, and
  the service/route/seed count expectations updated to `+185`.
  **Matrix content (#80/#81) deliberately not touched.** It has no authoritative
  key list in code yet — the position set is not fixed until #68's Ladini method
  settles the enumerator — so seeding it would mean inventing a scheme #68 owns.
  It joins the same way numerology just did, once that lands. calc-engine 371,
  backend 347 green; eslint + prettier clean.
- Matrix health-map summary row — follow-up to #75. The one position #67 shipped
  incomplete. Re-examining the sources showed the disagreement was narrower than
  first read: the two upper summary cells are a column sum in every source, and
  only the third had two candidates. Both reference *code* implementations use
  variant (a) — every summary cell is `reduce(sum of its own column)`, so the
  emotional cell is the emotional column's total, not `physical + energy` — and
  that is what the live calculators run; (b) came from one prose source. Adopted
  (a). Confirmed externally: 1979-07-29 computes to 14/12/8, exactly what
  `beloesolnce.ru` and `gadalkindom.ru` print. The discriminating fixture is
  1990-11-22 (a gives 16, b would give 7), since on the 1979 date the two rules
  agree by coincidence. `MATRIX_SCHEMA_VERSION` bumped to 2. calc-engine 371,
  backend 341, mobile 178 green; the spec's §5.2 and §7 updated to record the
  decision. The one thing left behind on purpose: the single-pass digit-sum bug
  one implementation has — this engine loops, so its totals are correct where
  that one's are not.
- Matrix of Destiny, end to end — #68–#75, completing `[EPIC] Matrix of
  Destiny` (#67). Spec, calc-engine domain, backend slice, and the mobile
  octagram.
  **The research (#68) was the whole job.** The Matrix has no canonical
  published standard and Ladini's own material is not on the open web in a form
  that states the arithmetic, so
  `docs/superpowers/specs/2026-07-20-matrix-of-destiny-ladini-method.md`
  reconstructs it from three independent open-source implementations (in three
  incompatible letter schemes, agreeing on every formula once normalised) and
  from five live calculators that were driven and read. §7 of that document
  lists **eight** places sources genuinely disagree, each with the adopted rule
  and the rejected variant, so a future reader who finds a losing variant
  recognises it as considered rather than missed.
  Four decisions worth naming. **The reduction rule is a real fork**, not a
  rounding difference: repeated digit-summing (adopted — every implementation,
  every live calculator, every published worked example) versus subtracting 22,
  which two sites actually implement. A chart computed under the wrong one is a
  different chart throughout. Notably the *Ladini-branded* site is itself
  unreliable here, describing the comfort zone as a flat digit sum of the whole
  birth date, which does not reproduce its own method's output.
  **The money line and the love line turned out to be the same five arcana**
  under two schools' names — verified by normalising the letter schemes, not
  assumed. They ship as one `moneyAndRelationships` field rather than two equal
  ones, because presenting one finding as two independent ones would read as a
  bug to anyone who compared them; both readings hang off the same keys in the
  content epic.
  **The health map's summary row is deliberately not implemented.** One source
  publishes a formula, the implementations disagree, and one computes it with a
  single-pass digit sum that is simply wrong past two digits. There was no
  defensible answer, so nothing shipped — recorded rather than guessed.
  And **`planetary` is flagged in its own doc comment as the weakest-supported
  position** (two sources, one of them code; two implementations omit it
  entirely), so it does not sit in the result looking as well-founded as `sky`.
  Cross-validation is external rather than self-referential: five fixture cases
  with full hand derivations, plus five further dates corroborated by three more
  calculators — the second tier asserting *only* the positions those calculators
  actually displayed, since filling in the rest from our own output would
  launder it into something that looks like evidence. All ten passed on the
  first run. Exhaustive 1900–2030 sweeps assert two independent structural
  invariants that discriminate between candidate formulas rather than restating
  them: the money line's entry point is always a multiple of 3, and the social
  purpose can never be 1, 2 or 13.
  One genuine trap the cross-check surfaced and now has a regression test: the
  ancestral centre sums the four corners **flat**, while the social purpose
  reduces its two diagonal pairs **first** — same four numbers, different
  answers (5 vs 14 for 1990-04-12). Collapsing either into the other would look
  like a harmless simplification.
  Backend mirrors the numerology slice with one deliberate difference: the cache
  key is the **birth date and nothing else** — no reference date (nothing here
  turns over with the calendar, unlike Personal Year/Month), no name, no place.
  That makes it the narrowest of the three invalidation triggers, so a name
  correction no longer drops a still-valid Matrix and a birth-place edit does
  not either. `GET /matrix` takes no query parameters at all, because a
  `referenceDate` knob would document something that does nothing.
  Mobile reuses the wheel's proven split — pure `geometry.ts`, a Skia component
  that only draws — with no glyph font needed (arcana are ASCII). The written
  breakdown beneath is not a fallback: an octagram tells a first-time viewer
  nothing about which point is which, and the purposes, the line and the chakra
  map have no agreed place on the figure at all, so they exist only below it.
  Reading sections stay empty until #76, as the chart and numerology did.
  Note the Matrix needs strictly *less* data than either sibling — a birth date,
  with no time, place or name — so a saved person who can produce neither a
  chart nor numbers still gets a full Matrix; the People list relies on that.
  884 tests green (calc-engine 367, backend 341, mobile 176), three typechecks,
  lint and format clean. The octagram's *rendering* is not covered — this repo
  excludes `.tsx` from Vitest by design and verifies it in the dev client — so
  the layout math is unit-tested and the component itself is not.
- Silent forced re-login every 15 minutes — #86 (p0). `authedFetch()` attached
  the stored access token and returned the server's answer unchanged, so once
  the 15-minute access-token TTL elapsed **every** authenticated screen failed
  with `invalid or expired access token` and the user was pushed back to
  sign-in. Both halves of the fix already existed and had simply never been
  connected: the backend's rotating `POST /auth/refresh` (#5) and the mobile
  `getRefreshToken()`, which was dead code. `authedFetch` now refreshes once on
  a 401 and retries the original request, sharing a single in-flight refresh
  promise — the backend rotates *and* replay-checks refresh tokens, so two
  concurrent refreshes would present an already-spent token and be read as a
  stolen-token replay, revoking the whole session. The rotated pair is
  persisted, and a refresh the backend rejects clears the tokens and surfaces
  `unauthorized`.
  **Two failure modes deliberately kept non-destructive:** a refresh that
  cannot reach the server throws `network_error` with the session intact
  (losing your login for riding through a tunnel is the same bug in a
  different costume), and a 5xx from the refresh endpoint throws a new
  `server_error` rather than signing the user out for the backend's fault.
  Two further findings fixed along the way: `profileApi.ts` carried its own
  copy of `authedFetch`, so the profile screens — including the launch gate —
  would have kept failing after the shared client learned to refresh; it now
  uses the shared one. And the launch gate in `app/index.tsx` caught *every*
  error from its first profile fetch and signed the user out, which after this
  change would have meant a cold start while offline still costing a login. It
  now signs out only on `unauthorized` (`src/auth/sessionGate.ts`) and offers
  retry plus a manual sign-in otherwise. 25 new tests, 138 mobile tests green;
  backend (292) and calc-engine (240) untouched and green.
- Numerology backend and mobile screen — #64–#66, completing
  `[EPIC] Numerology` (#57). Backend: `apps/backend/src/numerology/` mirroring
  the natal-chart module shape — `GET /numerology` and
  `GET /subjects/:id/numerology` (owner-scoped, 404 on a subject you do not
  own), a service factory, and a cache whose key is scoped to the **month**
  (`YYYY-MM`) rather than the day, so the Personal Year/Month cycle numbers
  cannot be served stale into the next month while every request within a month
  still hits. Mobile: API client, a pure offline service (no local cache —
  numerology has no server-derived inputs and the cycle numbers turn over
  nightly, so caching would only add staleness), a locale-driven
  `numerologyText.ts` formatter, and a `NumerologyScreen` reachable from both
  the profile and each saved person.
  **The prerequisite that shaped this work:** the profile had no full-name
  field. `displayName` is nullable and seeded from the Google account, so it is
  usually a first name — and Expression/Soul Urge/Personality are computed from
  every letter of the *full birth name*. Computing from a nickname would produce
  numbers that are wrong but look right, the same silent-corruption class as the
  timezone bug. So a nullable `profiles.full_name` column was added
  (migration `0002_lyrical_iron_man.sql`, **generated but not applied** — that
  is a live-database call), threaded through both repository implementations and
  the GDPR export, with a form field and hint on the profile screen and an
  actionable prompt (not a red error) when it is missing.
  Two bugs found and fixed during the work: profile writes were **not**
  invalidating cached numerology at all — a name-only patch never even fetched
  the before-snapshot, so a user correcting their name kept their old numbers
  indefinitely; and returning from the profile edit left the numerology screen
  showing its stale "add your full name" prompt, fixed by switching to
  `useFocusEffect`. 292 backend + 113 mobile tests green. Deliberately not
  included: any interpretation text (#76) and any Pro/Free gating (no
  entitlement mechanism exists in this codebase yet — the `interpretation: null`
  seam matches the natal chart's).
- Numerology calculation engine — #58–#63, closing the calc-engine half of
  `[EPIC] Numerology` (#57). New `packages/calc-engine/src/numerology/`:
  `reduce.ts` (digit reduction preserving masters 11/22/33 and recording karmic
  debt 13/14/16/19 — including at intermediate steps, so 49→13→4 reports the
  debt), `alphabet.ts` (AZ/TR/RU romanization + the Pythagorean letter table +
  a documented Y-adjacency rule for vowel/consonant splitting),
  `coreNumbers.ts` (Life Path, Expression, Soul Urge, Personality),
  `cycleNumbers.ts` (Birthday, Maturity, Personal Year/Month),
  `periods.ts` (four Pinnacles and four Challenges with age ranges), and
  `computeNumerologyProfile()` + `NUMEROLOGY_SCHEMA_VERSION`, mirroring
  `computeNatalChart()`. Pure and RN-safe, so device and backend agree.
  Also extracted a shared calendar-aware `parseIsoDate` (`date-parsing.ts`),
  now used by `natal-chart.ts` too — it is stricter than the regex it replaced,
  rejecting `1990-02-30`. Interpretation categories widened beyond astrology
  (#58) with `listNumerologySubjects()` kept **separate** from
  `listInterpretationSubjects()`: the latter drives the backend seed-parity test
  and the admin completeness check, so folding 185 contentless keys into it
  would have failed CI immediately — merging is #82.
  Two findings worth recording: **8 subject keys were dropped as unreachable**
  (Life Path 33, and the master numbers Pinnacles 1/2/4 cannot produce), taking
  the count from 193 to 185, verified by an exhaustive 1900–2030 sweep that
  matched the enumerated ranges exactly; and the reference-fixture suite
  (`__fixtures__/reference-numerology.ts`, three hand-computed cases across
  Latin, Azerbaijani and Cyrillic names, each carrying its own working) passed
  with no discrepancy. 240 tests green. Deliberately not included: backend
  route, mobile screen (#64–#66) and any interpretation text (#76).
- Numerology + Matrix of Destiny roadmap — Spec 3
  (`docs/superpowers/specs/2026-07-20-numerology-and-matrix-roadmap-design.md`),
  #56. Two of the four calculation domains README promises had **no
  implementation at all** — no calc-engine module, no exported type, no test,
  no route, no table, no screen, no i18n key (every "matrix" hit in the repo
  was a forward-looking comment or the unrelated "465-subject matrix" of
  interpretation rows). Decomposed both into three epics and 23 sub-issues:
  `[EPIC] Numerology` (#57, M1, 9 subs), `[EPIC] Matrix of Destiny` (#67, M2,
  8 subs), `[EPIC] Numerology and Matrix interpretation content` (#76, M2,
  6 subs). Key decisions: Matrix follows the **Natalia Ladini** method (the
  Matrix has no canonical standard, so picking a school is a prerequisite for
  writing a single meaningful test — hence #68 is a research issue that gates
  the rest); numerology ships the full package; **calculation first, content
  second** — the ~410 subject keys × 4 locales are ~80% of the work by volume,
  so screens ship with an empty reading section rather than blocking on text;
  and no generic "calculation plugin" layer (two consumers is too few to
  derive one). Shared prerequisite identified: `InterpretationCategory` and
  the `zod` enum at `interpretationRoute.ts:9` are astrology-only and must be
  widened (#58) before either epic can store reading text — the
  `interpretation_texts` table itself needs no migration.
- Accurate birth-data entry (date/time pickers + OSM map + auto-timezone) —
  Spec 1 (`docs/superpowers/specs/2026-07-19-accurate-birth-data-entry-design.md`).
  The accuracy keystone: the birth-place IANA timezone is now derived
  server-side from coordinates (calc-engine/node's `geo-tz` `findTimeZones`)
  at profile-save time instead of being hand-typed — closing the gap that
  made charts wrong (`findTimeZones` existed but was never wired in). Added a
  `GET /geocoding/reverse` endpoint (Nominatim reverse + derived timezone).
  Mobile: replaced the free-text birth date/time inputs with native modal
  pickers (`@react-native-community/datetimepicker`), added a
  `react-native-webview` + Leaflet + OpenStreetMap birth-place map picker (no
  API key — consistent with the Nominatim/OSM geocoding), and removed the
  hand-typed IANA timezone field. 15 new backend tests + 11 mobile
  format-helper tests. Verified end-to-end on the emulator: pick on map →
  "Qaradağ rayonu" + "Asia/Baku" derived → profile saved.
- Multiple people (saved subjects) — Spec 2
  (`docs/superpowers/specs/2026-07-19-multiple-subjects-design.md`). Charts
  for other people, not just yourself. Backend: `subjects` table (+ migration)
  mirroring the profile birth-data shape, owner-scoped CRUD with the same
  server-side timezone derivation and ownership isolation, per-subject chart
  compute (`GET /subjects/:id/natal-chart`), and subjects included in the GDPR
  data export (deletion already cascades via the users FK). Extracted the
  shared `birthDataToChartInput` used by both profile and subject charts.
  Mobile: a People list ("Me" pinned + saved subjects, add/edit/delete) and a
  subject form reusing Spec 1's date/time pickers + map field; the natal-chart
  screen can now render a subject's chart. 19 new backend tests. Verified on
  the emulator: People list shows "Me" chart-ready + Add-a-person form.
- Dev-client build fixes surfaced while getting the Android app to run:
  pinned Kotlin 1.9.24 (Compose Compiler compatibility), added the reanimated
  Babel plugin, aligned react-native-screens/safe-area-context to the Expo SDK
  52 versions, bumped `@react-native-google-signin/google-signin` to v16, and
  dropped the invalid PKCE param from the auth-session fallback. Google
  Sign-In now works end-to-end after adding the debug keystore's SHA-1
  (`5E:8F:…`) and enabling the custom URI scheme on the Android OAuth client
  (the OAuth consent screen was also published to production).

## 2026-07-19

- Getting Started guide + LICENSE decision — #26, #27, in one PR (both
  repo-wide chores, no code dependency between them). #26: filled in the
  README's Getting Started section and CONTRIBUTING's Local Development
  Setup section, now that the monorepo (`apps/mobile`, `apps/backend`,
  `packages/calc-engine`) is actually scaffolded — prerequisites, install,
  running backend/mobile, running tests, lint/format. Also corrected the
  README's stale "pre-implementation, no code written" status banner and
  "not yet scaffolded" repository structure section, since both were
  factually wrong next to the new setup instructions. #27: added a
  proprietary/all-rights-reserved `LICENSE` (matching the closed-source
  commercial model that was already the deciding factor against AGPL-3.0
  Swiss Ephemeris — see #11/#13) and updated the README License section.
  Audited every direct dependency across the root, `apps/backend`,
  `apps/mobile`, and `packages/calc-engine` workspaces (1210 unique
  transitive packages scanned) — all MIT/Apache-2.0/BSD/ISC or equivalent
  permissive licenses, no copyleft (GPL/AGPL/SSPL) dependencies that would
  conflict with closed-source distribution.

- Cross-validation unit tests against reference ephemeris — #21 (last
  remaining sub-issue of #11, previously `needs-research` since it requires
  manually collected external data). Collected 10 birth scenarios (varying
  latitude, hemisphere, and era: equatorial, mid/high-latitude both
  hemispheres, one deliberately inside the Arctic Circle, one pre-1900) from
  astro-seek.com's free Placidus chart calculator via a real browser, with 3
  spot-checked against astro.com. New
  `packages/calc-engine/src/__fixtures__/reference-charts.ts` stores the
  collected data (source URL + notes documented per scenario, per the
  issue's technical note); new `reference-charts.test.ts` computes each
  chart via this package's own `computeNatalChart()` and asserts positions/
  Ascendant/Midheaven within ±3 arcminutes and every unambiguous reference
  aspect (orb comfortably inside our `DEFAULT_ORBS` cap) is reproduced — 32
  new tests, 145 total (up from 113), all green.
  - Cross-checking surfaced a real, documented finding rather than a clean
    pass: for the deliberate polar scenario (Tromsø, 1960-06-21 00:00),
    astro-seek assumed Norway observed DST that June, but Norway ran no DST
    between 1945 and 1980 — the historically correct offset is UTC+1 (CET),
    which is what this package's `geo-tz`/`luxon` resolution correctly
    gives. That ~1 hour gap shifts every body proportionally to its speed
    (negligible for outer planets, enough for the Moon to fail a strict
    tolerance), so the `positions` degree-level check is skipped for that
    one scenario only (`knownDeviations`, with the full reasoning inline) —
    everything else about it, including retrograde flags, still matches.
    Separately and as intended, this same scenario confirms #14's
    Placidus→Whole Sign polar fallback: astro-seek silently returned a full
    Placidus house set with no warning, while this package correctly
    detects the latitude/date is undefined for Placidus and falls back
    (`fallbackApplied: true`), so house comparison is skipped there too —
    not a defect, a different (and, per issue #14, intentional) house
    system.
  - CI already runs this suite on every PR (`.github/workflows/calc-engine-ci.yml`
    triggers on any `packages/calc-engine/**` change and runs `test`), so no
    workflow changes were needed to satisfy the issue's CI acceptance
    criterion.

- Natal-chart wheel rendering + multilingual interpretation content — #17,
  #18 (both sub-issues of #11), in one PR. Swept the epic's remaining open
  sub-issues (#17, #18, #21) to see what could close together: #17 and #18
  are both "the mobile natal-chart result screen" from two different angles
  (the wheel visual, the reading text beneath it), so they landed as one
  screen rather than two disconnected PRs. #21 (cross-validation against
  real external calculators — astro.com/astro-seek) needs manually collected
  reference data that can't be fabricated and stays `needs-research`,
  untouched.
  - **#17 (SVG/Skia wheel) — closed.** #38 had already built
    `computeWheelLayout()` (pure geometry) but explicitly deferred "the
    react-native-skia `<Canvas>` component that actually draws these
    primitives." New `apps/mobile/src/chart/NatalChartWheel.tsx` is that
    component: the zodiac ring + sign glyphs, degree ticks, house-cusp lines
    (only present when `hasHouses` — the layout already degrades gracefully
    when birth time is unknown, so this component just draws whatever it's
    handed), de-collided planet glyphs with a retrograde "R" mark, and
    dashed/solid aspect chords per `aspectStyles`. Uses Skia's `matchFont`
    for glyph text rather than bundling a custom astrology font.
  - **#18 (multilingual interpretation text) — closed.** #42 had built the
    storage/cache/service/route layer but explicitly deferred "the
    original-content generator/seed script to populate all 465 combinations
    x 4 languages, and the mobile `natal-chart.json` i18next consumer."
    New `apps/backend/src/interpretations/seedContent.ts` generates original
    (not copied from any site) AZ/TR/EN/RU text for every one of the
    465 (planet-sign/planet-house/aspect) subjects from a small hand-written
    phrase bank (per-planet theme, per-sign/house quality, per-aspect
    dynamic) composed into fixed per-locale sentence templates — a
    reproducible baseline the admin panel (EPIC 10) can overwrite later,
    never the reverse (`seed.ts` only fills rows that don't already exist).
    Also added `POST /interpretations/for-chart` (bearer): the service's
    existing-but-unrouted `getForComputedChart()` composer, now reachable
    from the client with a computed chart's positions/cusps/aspects, so the
    mobile app never has to rebuild subject keys itself. Skipped i18next
    entirely — the app's actual i18n is a hand-rolled `LocaleContext` with
    only `en`/`az` UI chrome (not the 4 interpretation-content locales), so
    the natal-chart screen calls the new endpoint directly instead of
    introducing a second i18n system for content that's already localized
    server-side.
  - New `apps/mobile/src/screens/NatalChartScreen.tsx` (routed at
    `/natal-chart`, linked from the profile screen) ties both together:
    loads the chart via the existing offline-aware `loadNatalChart`, renders
    the wheel, and fetches/display the reading — the wheel and the reading
    fail independently, so a reading error (or being offline) never blocks
    the wheel.
  - 10 new backend tests (7 seedContent parity/content + 3 seed-script) + 5
    new interpretationRoute tests — 209 total backend tests pass, up from
    194. `test`/`typecheck`/`lint`/`format:check` clean across
    `apps/backend`, `apps/mobile` (73/73, untouched besides the new screen),
    and `packages/calc-engine` (113/113, untouched).

- Natal-chart backend API: orb-config admin endpoint, `/natal-chart`
  compute+cache, and the offline sync endpoint — #15, #19, #20 (all sub-issues
  of #11). Swept every open sub-issue of the natal-chart epic to see which
  were genuinely closeable in one PR: #15's calc-engine layer (#37) and #19's
  cache module (#41) both already existed but had no route calling them, and
  #20's mobile client (#43) was already calling `/natal-chart` +
  `/natal-chart/sync` endpoints that didn't exist yet. Building that missing
  endpoint closes all three at once:
  - **#15 (aspect calculation + configurable orbs) — backend half, closed.**
    New `orbConfig` module mirrors the `interpretations` module's
    repository/cache/service/route layering exactly: `DrizzleOrbConfigRepository`
    reads/writes the existing `aspect_orb_config` table, `OrbConfigCache`
    (Redis-backed, in-memory fallback) caches the whole effective override set
    as one value (at most five rows), and `orbConfigService.getEffectiveOrbs()`
    is a read-through cache in front of it. New routes: `GET /orb-config`
    (bearer — effective merged config + stored rows) and
    `PUT /orb-config/:aspectType` (admin-token-gated upsert, invalidates the
    cache immediately — no deploy required, satisfying the issue's own AC).
  - **#19 (chart result caching) — closed.** The cache/`getOrComputeChart()`
    infrastructure from #41 had "no chart-computation service/route yet...for
    it to actually be called from" (its own BACKLOG entry, verbatim). New
    `chart/natalChartService.ts` is that missing piece: resolves a user's
    profile to `NatalChartInput` (throwing a new `IncompleteProfileError`
    listing exactly which birth field is missing, mirroring the mobile
    client's `profileToChartInput`), loads the effective orb config, and
    calls `getOrComputeChart()` with `@astrocalc/calc-engine`'s
    `computeNatalChart` — the same function the mobile app calls offline, so
    both sides produce byte-identical charts. `GET /natal-chart` (bearer)
    exposes it.
  - **#20 (offline calculation support) — AC #3 closed, rest already done.**
    Its own BACKLOG entry from #43 already listed every other AC as done and
    named the exact gap: "the backend `/natal-chart` + `/natal-chart/sync`
    routes this client calls don't exist yet." New `POST /natal-chart/sync`
    (bearer) is that route — it deliberately ignores the offline-computed
    chart payload the client submits (the backend is the source of truth) and
    always recomputes from the current profile, refreshing the cache
    unconditionally rather than trusting client-submitted data for a
    server-side cache.
  - Not touched: #17 (Skia wheel rendering — a separate mobile UI/rendering
    task, already has its own geometry-foundation PR at #38 with the actual
    `<Canvas>` component still open) and #18 (multilingual interpretation
    content — the storage/API layer is done per #42, but writing the actual
    465×4-language text and building the mobile i18next consumer is a content
    task, not something to bundle into a backend API PR). #21
    (cross-validation against real external ephemeris data) needs manually
    collected reference values from external calculators and stays
    `needs-research`, untouched.
  - `interpretation` is `null` in every `/natal-chart` response for now — no
    subscription/Pro-entitlement concept exists anywhere in this repo yet, so
    there's nothing to gate; the mobile client's own `NatalChartInterpretation`
    type is already documented as "kept intentionally open... until the
    interpretation-content epic" for the same reason.
  35 new backend tests (4 orbConfig repository + 4 orbConfig cache + 5
  orbConfigService + 7 orbConfig route + 8 natalChartService + 7
  natalChartRoute) — 195 total backend tests pass, up from 160.
  `npm test`/`typecheck`/`lint`/`format:check` clean across `apps/backend`,
  `packages/calc-engine` (113/113, untouched), and `apps/mobile` (73/73,
  untouched).

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
