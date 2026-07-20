# Spec 3 — Numerology & Matrix of Destiny roadmap

Date: 2026-07-20
Status: approved (design)
Scope: decomposition only — each epic below gets its own implementation plan
Issues: #56 (this doc), #57 (Numerology), #67 (Matrix of Destiny), #76 (content)

## Problem / goal

`README.md` promises four calculation domains. Only one is built: the natal
chart (and the zodiac primitives it is composed from — signs and degrees exist
as part of planetary positions, not as a domain of their own).
Numerology and Matrix of Destiny have **no implementation at all** —
no calc-engine module, no exported type, no test, no backend route, no DB table,
no mobile screen, no i18n key. Every occurrence of the word "matrix" in the
codebase today is either a forward-looking comment on chart infrastructure
(`chartCacheKey.ts:5`, `chartResultCache.ts:5`) or an unrelated combinatorial
usage ("the 465-subject matrix" of interpretation rows).

This document decomposes both features into epics and sub-issues so each can be
planned and shipped independently.

## Decisions

**Matrix methodology: Natalia Ladini.** The Matrix of Destiny has no single
canonical standard — schools disagree on which secondary lines exist and how the
ancestral square is derived. Ladini's is the most widely documented and the one
most online calculators implement, which is what makes the README's
"cross-validated against reference calculators" requirement achievable at all.
Picking a school is a prerequisite for writing a single meaningful test.

**Numerology scope: the full package.** Core four (Life Path, Expression, Soul
Urge, Personality) plus Birthday, Maturity, Personal Year/Month, Pinnacles and
Challenges.

**Calculation first, content second.** The calculation code for both features is
a few hundred lines. The interpretation content is roughly 1600 original texts
(~405 subject keys × 4 locales) — by volume, ~80% of the work. Screens ship
with the reading section empty (exactly as the natal chart's "Your Reading" is
today) and the content lands as its own epic. This keeps content authoring off
the critical path for shipping working calculations.

**Only reachable subject keys are enumerated.** Numerology's key count settled at
**185**, not the ~189 first estimated, because several master numbers cannot
occur at the positions they were first assigned. Life Path sums three reduced
1–9 components (max 27), so 33 is impossible; Pinnacles 1, 2 and 4 sum two such
components (max 18), so only 11 survives; Pinnacle 3 sums two Pinnacles (max
22), so 22 is reachable but 33 is not. Enumerating an unreachable key would ask
the content epic to write text that can never display, and would make the admin
completeness checklist permanently unsatisfiable. An exhaustive sweep over
1900–2030 confirmed the enumerated ranges match the values the formulas
actually produce, exactly.

**No shared "calculation plugin" abstraction.** Both features mirror the
natal-chart shape end to end — pure function in `calc-engine`, route + service +
cache in the backend, API client + screen in mobile — rather than being built on
a generic registry. With only two consumers, and with numerology (pure numbers)
and Matrix (Skia octagram) differing sharply in their presentation needs, a
shared layer would be guessed rather than derived. Revisit if a third domain
lands.

**Free/Pro split matches the natal chart.** Computed numbers/arcana are
RN-safe and may be computed on-device (so they work offline); interpretation
text stays behind the backend as Pro-only data, per spec §5.1.

## Shared groundwork

The interpretation subsystem is currently astrology-only in two places, and both
epics need it widened before their reading text can be stored:

- `calc-engine/src/interpretations.ts` — `InterpretationCategory` is a union of
  `planet-sign | planet-house | aspect`, and `listInterpretationSubjects()`
  enumerates only astrology subjects (it drives both the seed script and a
  parity test).
- `apps/backend/src/interpretations/interpretationRoute.ts:9` — the same three
  values, hard-coded as a `zod` enum.

The `interpretation_texts` table itself (`category`/`subjectKey`/`locale`/
`content`, PK on all three) is already generic enough to hold numerology and
Matrix rows **without a migration**.

## Epic A — Numerology (#57, M1)

Pure calculation lives in `packages/calc-engine/src/numerology.ts`, following
the package's stated convention: plain functions, fully-typed JSON-serializable
input/output, `CalcEngineError` on invalid input, no Node built-ins.

1. **(#58) Extend the interpretation category system** to non-astrology domains
   (calc-engine union + subject-key builders + backend zod enum). Shared
   prerequisite — Epic B depends on this too.
2. **(#59) Name normalization + transliteration table.** Pythagorean letter→number
   mapping (A/J/S=1 … I/R=9) over a documented AZ/TR/RU romanization: for
   Azerbaijani and Turkish this is diacritic folding (Ç→C, Ə→E, Ğ→G, İ/I→I,
   Ö→O, Ş→S, Ü→U); for Russian, an ISO-9 Cyrillic→Latin pass before the same
   table, so all four locales share one letter-value system. Must also fix a
   documented rule for when `Y` counts as a vowel.
3. **(#60) Core four:** Life Path, Expression, Soul Urge, Personality — including
   master numbers (11/22/33, preserved rather than reduced) and karmic-debt
   detection (13/14/16/19, detected *before* reduction). Life Path reduces
   month, day and year separately before summing; this differs from
   digit-summing the whole date in master-number cases, so the choice is
   documented and tested.
4. **(#61) Extended and cycle numbers:** Birthday (unreduced day, 1–31), Maturity
   (Life Path + Expression), Personal Year, Personal Month.
5. **(#62) Pinnacles and Challenges:** four positions each, with the age ranges
   derived from the Life Path number.
6. **(#63) `computeNumerologyProfile()` assembly** — the single entry point, with
   `NUMEROLOGY_SCHEMA_VERSION`, exported from `src/index.ts`, plus
   cross-validation fixtures in `src/__fixtures__/` mirroring
   `reference-charts.ts`.
7. **(#64) Backend:** `/numerology` route + service + result cache, reusing the
   existing cache-key/port-adapter shape, and a `/subjects/:id/numerology`
   variant for saved people.
8. **(#65) Mobile:** API client + offline path (pure service with injected I/O, like
   `natalChartService`).
9. **(#66) Mobile:** Numerology screen — the numbers as a written breakdown, plus
   i18n keys. Reading section renders empty until Epic C lands.

## Epic B — Matrix of Destiny (#67, M2)

Depends on Epic A's item 1 (#58).

1. **(#68) Document the Ladini method as an implementable spec** — every position, its
   formula, and at least three worked reference cases to test against. This is
   research output, not code, and it gates everything below it.
2. **(#69) Base-22 reduction primitives** and the 22-arcana type.
3. **(#70) Octagram core positions** — the four cardinal points from
   day/month/year, the purpose point, and the centre ("comfort zone").
4. **(#71) Ancestral square and the secondary lines** (sky/earth purposes,
   money, love, health).
5. **(#72) `computeDestinyMatrix()` assembly** + `MATRIX_SCHEMA_VERSION` +
   fixtures cross-validated against the reference cases from item 1.
6. **(#73) Backend:** `/matrix` route + service + cache, plus the subject variant.
7. **(#74) Mobile:** API client.
8. **(#75) Mobile:** Skia octagram visualization in the gold/dark theme, reusing the
   `src/chart/` pattern (`geometry.ts` for pure layout math, a component that
   only draws) and the bundled symbol font, plus a written breakdown beneath it.

## Epic C — Interpretation content (#76, M2)

~405 subject keys × 4 locales (az/tr/en/ru) — 185 numerology, plus the Matrix
keys, which are estimated until #68 fixes the position list. Split by block so
each is a finishable unit:

1. **(#77)** Numerology — core four (47 keys: Life Path 11, the three
   name-derived numbers 12 each).
2. **(#78)** Numerology — extended and cycles (61 keys).
3. **(#79)** Numerology — Pinnacles and Challenges (77 keys: 10 + 10 + 11 + 10
   Pinnacles, 9 × 4 Challenges).
4. **(#80)** Matrix — the 22 arcana, base meanings.
5. **(#81)** Matrix — position-specific meanings.
6. **(#82)** Seed script + `listInterpretationSubjects()` parity test extended
   to cover the new categories.

## Testing

Vitest throughout, co-located `<name>.test.ts` beside each source file, matching
the existing `environment: 'node'`, `globals: false` config.

- **calc-engine:** table-driven unit tests per number/position; separate
  cross-validation suites reading from `src/__fixtures__/`, mirroring
  `reference-charts.test.ts`.
- **Backend:** route + service tests with an in-memory cache fake; ownership
  isolation on the `/subjects/:id/...` variants.
- **Mobile:** pure-logic tests for the offline services and the text formatters
  (the `chartText.ts` pattern); no React rendering required.

## Out of scope

Synastry/compatibility, PDF export, and the admin content editor. Personal
Year/Month deliberately do **not** get push notifications or scheduled
recomputation in this pass.
