# Numerology Backend and Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the numerology engine to users — a backend endpoint for the signed-in user and for saved subjects, and a mobile screen that reads the numbers out in Azerbaijani and English.

**Architecture:** Mirrors the natal-chart feature end to end. Backend gets `apps/backend/src/numerology/` with the same route/service/cache-port/redis-adapter split as `apps/backend/src/chart/`. Mobile gets an API client, a pure offline service with injected deps, a pure text formatter, and a screen — matching `natalChartApi.ts`, `offline/natalChartService.ts`, `chart/chartText.ts` and `NatalChartScreen.tsx` respectively.

**Tech Stack:** Express + TypeScript + Drizzle + zod + Upstash Redis (backend); Expo Router + React Native (mobile); Vitest + Supertest throughout.

**Covers issues:** #64, #65, #66. The calc-engine domain (#58–#63) is already merged.

---

## The decision this plan rests on

**Numerology needs the full birth name, and the profile does not have one.**

`profiles.displayName` is nullable, is seeded from the Google account at sign-up, and is filled by onboarding's "name" step — so in practice it holds a first name or a nickname. Expression, Soul Urge and Personality are computed from every letter of the **full birth name**. Feeding a nickname in produces numbers that are wrong but look right — the same silent-corruption class as the timezone bug this project already fixed once.

So Task 1 adds a nullable `profiles.full_name` column with a migration, and numerology returns a clear "we need your full name" error until it is set. `subjects.name` is already `notNull` and is whatever the user typed for that person, so subjects work with no schema change; the service documents that it is treated as the birth name.

**Do not** compute numerology from `displayName` as a fallback. A wrong number silently presented is worse than a prompt asking for one more field.

## What this plan does NOT do

- **No Pro/Free gating.** No entitlement mechanism exists anywhere in this codebase yet (`NatalChartResponse.interpretation` is typed nullable and hardcoded `null`, with a comment pointing at the future subscription epic). Numerology follows the same convention: an `interpretation: null` seam, no invented gating.
- **No interpretation text.** The reading section renders empty, exactly as the natal chart's does today. That is epic #76.

---

## File structure

**Backend — created:**

| File | Responsibility |
| --- | --- |
| `apps/backend/src/numerology/numerologyCacheKey.ts` | Deterministic sha256 over the inputs a profile depends on |
| `apps/backend/src/numerology/numerologyResultCache.ts` | Cache port + `getOrComputeNumerology` + `InMemoryNumerologyResultCache` |
| `apps/backend/src/numerology/redisNumerologyResultCache.ts` | Upstash adapter with a generation counter |
| `apps/backend/src/numerology/numerologyInput.ts` | `numerologyDataToInput()` — shared by profile and subject paths |
| `apps/backend/src/numerology/numerologyService.ts` | Interface + `createNumerologyService(deps)` factory |
| `apps/backend/src/numerology/numerologyRoute.ts` | `GET /numerology` |

Plus a co-located `.test.ts` for `numerologyCacheKey`, `numerologyInput`, `numerologyService` and `numerologyRoute`.

**Backend — modified:** `db/schema.ts`, `auth/types.ts`, `auth/repository.ts`, `auth/errors.ts`, `profile/profileRoute.ts`, `subjects/subjectsService.ts`, `subjects/subjectsRoute.ts`, `config/env.ts`, `app.ts`, plus a generated migration under `drizzle/`.

**Mobile — created:**

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/api/numerologyApi.ts` | `fetchNumerology()`, `getSubjectNumerology(id)` |
| `apps/mobile/src/offline/numerologyService.ts` | Pure, deps-injected; type-only imports |
| `apps/mobile/src/offline/numerologyServiceWiring.ts` | The only file importing native bits |
| `apps/mobile/src/numerology/numerologyText.ts` | Locale-driven formatter (the `chartText.ts` pattern) |
| `apps/mobile/src/screens/NumerologyScreen.tsx` | The screen |
| `apps/mobile/app/numerology.tsx` | Thin route adapter |

Plus co-located tests for `numerologyText.ts` and `offline/numerologyService.ts`.

**Mobile — modified:** `src/i18n/translations.ts`, `src/screens/ProfileScreen.tsx`, `app/profile.tsx`, `src/screens/PeopleScreen.tsx`, `app/people.tsx`, `src/screens/ProfileScreen.tsx`'s birth-data form (for the new full-name field).

---

### Task 1: Add `profiles.fullName` (#64 prerequisite)

**Files:**
- Modify: `apps/backend/src/db/schema.ts`, `apps/backend/src/auth/types.ts`, `apps/backend/src/auth/repository.ts`, `apps/backend/src/profile/profileRoute.ts`
- Generate: a migration under `apps/backend/drizzle/`

- [ ] **Step 1: Write the failing test**

Add to `apps/backend/src/profile/profileRoute.test.ts` (mirror the existing update tests in that file):

```ts
it('accepts and returns fullName', async () => {
  const { app, accessToken } = await buildApp();
  const res = await request(app)
    .patch('/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ fullName: 'Çingiz Əliyev' });

  expect(res.status).toBe(200);
  expect(res.body.profile.fullName).toBe('Çingiz Əliyev');
});

it('rejects a fullName that is empty or too long', async () => {
  const { app, accessToken } = await buildApp();
  for (const fullName of ['', 'x'.repeat(121)]) {
    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName });
    expect(res.status).toBe(400);
  }
});
```

- [ ] **Step 2: Run it, confirm it fails**

`npm test -w @astrocalc/backend -- src/profile/profileRoute.test.ts`

- [ ] **Step 3: Add the column**

In `apps/backend/src/db/schema.ts`, inside `profiles`, directly after `displayName`:

```ts
  // The full birth name, as numerology needs it. Deliberately separate from
  // `displayName`, which is seeded from the Google account and is usually a
  // first name or a nickname — computing Expression/Soul Urge/Personality from
  // that would produce numbers that are wrong but look right.
  fullName: text('full_name'),
```

Nullable, because existing profiles have none and onboarding must stay skippable.

- [ ] **Step 4: Thread it through the types and repository**

- `apps/backend/src/auth/types.ts`: add `fullName: string | null;` to `interface Profile`, and `fullName?: string | null;` to `ProfileUpdateInput`.
- `apps/backend/src/auth/repository.ts`: include `fullName` wherever `displayName` is selected/mapped/updated, in **both** `DrizzleUserRepository` and `InMemoryUserRepository`. Grep for `displayName` in that file and handle every hit — missing one in the in-memory fake will make tests pass against a repo that behaves differently from production.
- `apps/backend/src/profile/profileRoute.ts`: add `fullName: z.string().trim().min(1).max(120).nullable().optional()` to the update schema, alongside the existing `displayName` rule (match its exact style).

- [ ] **Step 5: Generate the migration**

```bash
npm run db:generate -w @astrocalc/backend
```

Review the generated SQL — it must be a single `ALTER TABLE "profiles" ADD COLUMN "full_name" text;` with no destructive statements. If drizzle-kit proposes anything else (a drop, a rename, a type change), stop and report it rather than applying it.

Do **not** run `db:migrate` — that hits the live Neon database and is the user's call.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -w @astrocalc/backend
git add apps/backend/src/db/schema.ts apps/backend/src/auth/types.ts apps/backend/src/auth/repository.ts apps/backend/src/profile/profileRoute.ts apps/backend/src/profile/profileRoute.test.ts apps/backend/drizzle
git commit -m "feat(backend): add profiles.fullName for numerology (#64)"
```

---

### Task 2: Numerology cache (#64)

**Files:**
- Create: `apps/backend/src/numerology/numerologyCacheKey.ts` (+ test), `numerologyResultCache.ts`, `redisNumerologyResultCache.ts`

Mirror `apps/backend/src/chart/chartCacheKey.ts`, `chartResultCache.ts` and `redisChartResultCache.ts` **exactly** — read all three first and copy their structure, doc-comment style and the `canonicalize()` helper.

- [ ] **Step 1: Write the failing cache-key test**

Create `apps/backend/src/numerology/numerologyCacheKey.test.ts`, mirroring `chartCacheKey.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashNumerologyCacheKey, type NumerologyCacheKeyInput } from './numerologyCacheKey';

const BASE: NumerologyCacheKeyInput = {
  fullName: 'John Smith',
  birthDate: '1990-03-07',
  referenceMonth: '2026-07',
};

describe('hashNumerologyCacheKey', () => {
  it('is stable for the same input', () => {
    expect(hashNumerologyCacheKey(BASE)).toBe(hashNumerologyCacheKey({ ...BASE }));
  });

  it('is insensitive to key order', () => {
    const reordered: NumerologyCacheKeyInput = {
      referenceMonth: BASE.referenceMonth,
      birthDate: BASE.birthDate,
      fullName: BASE.fullName,
    };
    expect(hashNumerologyCacheKey(reordered)).toBe(hashNumerologyCacheKey(BASE));
  });

  it('changes when any input changes', () => {
    const base = hashNumerologyCacheKey(BASE);
    expect(hashNumerologyCacheKey({ ...BASE, fullName: 'Jane Smith' })).not.toBe(base);
    expect(hashNumerologyCacheKey({ ...BASE, birthDate: '1990-03-08' })).not.toBe(base);
    expect(hashNumerologyCacheKey({ ...BASE, referenceMonth: '2026-08' })).not.toBe(base);
  });
});
```

- [ ] **Step 2: Implement the cache key**

`NumerologyCacheKeyInput` is `{ fullName: string; birthDate: string; referenceMonth: string }`.

The **`referenceMonth` field is the point of this task** and needs a doc comment saying so: Personal Year and Personal Month change with the calendar, so a cache keyed only on name and birth date would serve a stale Personal Month into the next month. Keying on `YYYY-MM` — the month, not the full date — makes the entry expire naturally at the month boundary while still getting a cache hit for every request within the month.

Hash with `createHash('sha256').update(JSON.stringify(canonical)).digest('hex')` over the same `canonicalize()` helper `chartCacheKey.ts` uses. Copy that helper rather than importing it across feature folders.

- [ ] **Step 3: Implement the cache port and adapters**

- `numerologyResultCache.ts`: `interface NumerologyResultCache { get<T>(ownerId, key): Promise<T|null>; set<T>(ownerId, key, value): Promise<void>; invalidate(ownerId): Promise<void>; }`, plus `getOrComputeNumerology<T>(cache, ownerId, key, compute)` and `class InMemoryNumerologyResultCache` — all mirroring `chartResultCache.ts`.
- `redisNumerologyResultCache.ts`: mirror `redisChartResultCache.ts` with key prefixes `numerology:gen:${ownerId}` and `numerology:${ownerId}:${generation}:${hash}`.

Note: unlike `ChartResultCache`, this port does **not** need to extend `ChartCacheInvalidator` — nothing wires it into `ProfileServiceDeps`. Keep `invalidate` on it anyway, since profile edits must drop stale numerology.

- [ ] **Step 4: Test, then commit**

```bash
npm test -w @astrocalc/backend
git add apps/backend/src/numerology/
git commit -m "feat(backend): numerology result cache with month-scoped keys (#64)"
```

---

### Task 3: Numerology service and route (#64)

**Files:**
- Create: `apps/backend/src/numerology/numerologyInput.ts` (+ test), `numerologyService.ts` (+ test), `numerologyRoute.ts` (+ test)
- Modify: `apps/backend/src/auth/errors.ts`, `apps/backend/src/config/env.ts`, `apps/backend/src/app.ts`

- [ ] **Step 1: Add the error class**

In `apps/backend/src/auth/errors.ts`, alongside `IncompleteProfileError`, matching its style exactly:

```ts
/**
 * The profile is missing data numerology needs — most often `fullName`, which
 * older profiles predate. Mirrors {@link IncompleteProfileError}'s shape so the
 * client can handle both the same way.
 */
export class IncompleteNumerologyProfileError extends AuthError {
  constructor(missing: string[]) {
    super('incomplete_profile', 'Profile is missing data required for numerology', 422, {
      missing,
    });
  }
}
```

- [ ] **Step 2: Write `numerologyInput.ts`**

```ts
/** The fields numerology reads. Both `Profile` and `Subject` structurally satisfy this. */
export interface NumerologyData {
  fullName?: string | null;
  name?: string | null;
  birthDate: string | null;
}

export type MissingNumerologyField = 'fullName' | 'birthDate';

/**
 * Map a profile or subject to a `NumerologyInput`, or throw listing what is missing.
 *
 * A profile carries `fullName` (added for this feature); a subject carries the
 * required `name` it was created with, which is treated as that person's birth
 * name. Accepting either is what lets one function serve both paths, the same
 * trick `birthDataToChartInput` uses.
 */
export function numerologyDataToInput(data: NumerologyData, referenceDate: string): NumerologyInput
```

Accumulate a `missing[]` array and `throw new IncompleteNumerologyProfileError(missing)` if non-empty — mirror `birthChartInput.ts` exactly. The name is `data.fullName ?? data.name ?? null`; a blank-after-trim name counts as missing.

Test it directly: a profile with `fullName` works; a profile with only `displayName` fails with `missing: ['fullName']`; a subject with `name` works; a missing `birthDate` reports `['birthDate']`; both missing reports both.

- [ ] **Step 3: Write the service**

Mirror `natalChartService.ts`:

```ts
export interface NumerologyResponse {
  profile: NumerologyProfile;
  /** Always `null` until the interpretation-content epic (#76). See NatalChartResponse. */
  interpretation: null;
}

export interface NumerologyService {
  getNumerology(userId: string, referenceDate: string): Promise<NumerologyResponse>;
}

export interface NumerologyServiceDeps {
  repo: Pick<UserRepository, 'getProfile'>;
  cache: NumerologyResultCache;
}
```

`getNumerology` builds the input via `numerologyDataToInput`, derives the cache key (`referenceMonth` is `referenceDate.slice(0, 7)`), and calls `getOrComputeNumerology(cache, userId, key, () => computeNumerologyProfile(input))`.

- [ ] **Step 4: Write the route**

Mirror `natalChartRoute.ts` exactly — `createNumerologyRouter(service, tokenService)`, `const auth = requireAuth(tokenService)`, handlers as `async (req, res, next)` with `try/catch { next(err) }`, user id read as `req.userId as string`, response returned **bare** as `{ profile, interpretation }` (the natal-chart convention, not the subjects wrapper convention).

`GET /` takes an optional `referenceDate` query param:

```ts
const querySchema = z.object({
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'referenceDate must be YYYY-MM-DD')
    .optional(),
});
```

Validate with `safeParse` + `throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Invalid request body')` — the exact idiom the other routes use.

**When the param is absent, default to the server's current UTC date** (`new Date().toISOString().slice(0, 10)`) and document in a comment that the client should send its own local date, because "today" is a local-timezone question and the cycle numbers change on a date boundary.

- [ ] **Step 5: Write the route test**

Mirror `natalChartRoute.test.ts`'s `buildApp()` setup — a real `express()`, `InMemoryUserRepository`, a real token from `createTokenService`, `errorHandler` registered last. Cover: 401 without auth; 422 `incomplete_profile` with `missing: ['fullName']` for a profile that has none; a successful 200 whose `profile.lifePath.value` matches a hand-checked value; 400 for a malformed `referenceDate`; and that two calls with the same `referenceDate` hit the cache (assert by counting compute calls via a spy dep, or by asserting equal results and a single cache entry).

- [ ] **Step 6: Wire it into `app.ts`**

Add `NUMEROLOGY_CACHE_TTL_SECONDS` to `apps/backend/src/config/env.ts` mirroring `CHART_CACHE_TTL_SECONDS` (same default and the same `0 means no TTL` convention).

Add a `buildNumerologyResultCache(redis, env)` helper at the bottom of `app.ts` mirroring `buildChartResultCache`, including the `console.warn` fallback message.

Mount **before** `app.use(errorHandler)`:

```ts
  // Numerology (#64): same cache/port shape as the natal chart, keyed by month
  // so the personal-year/month cycle numbers cannot be served stale.
  const numerologyService = createNumerologyService({ repo, cache: numerologyCache });
  app.use('/numerology', createNumerologyRouter(numerologyService, tokenService));
```

Also call `numerologyCache.invalidate(userId)` wherever profile writes already invalidate the chart cache — find that call in `profile/chartCacheInvalidator.ts` / `profileService.ts` and extend it, or pass the numerology cache as a second invalidator. Whichever fits with least disruption; explain the choice in a comment. A profile edit that changes `fullName` or `birthDate` **must** drop the cached numerology, or the user sees their old numbers.

- [ ] **Step 7: Test and commit**

```bash
npm test -w @astrocalc/backend
npm run lint
git add apps/backend/
git commit -m "feat(backend): numerology route, service and cache (#64)"
```

---

### Task 4: Numerology for saved subjects (#64)

**Files:**
- Modify: `apps/backend/src/subjects/subjectsService.ts`, `subjectsRoute.ts`, and their tests

Follow how `getChart(userId, id)` already works in `subjectsService.ts`: **do not** depend on `numerologyService`; re-implement the small orchestration with the same imported primitives, exactly as the existing subject-chart method does.

- [ ] **Step 1: Write the failing tests**

In `subjectsRoute.test.ts`, mirroring the existing `GET /subjects/:id/natal-chart` tests: a 200 for the owner; a **404 `subject_not_found` when another user requests it** (ownership isolation — this is the test that matters); a 422 when the subject has no birth date.

- [ ] **Step 2: Add `getNumerology(userId, id, referenceDate)` to the service**

Ownership comes from `repo.get(userId, id)` returning `null` → `throw new SubjectNotFoundError()`. Cache is keyed on **`id`** (the subject), not `userId`, matching how the subject chart namespaces per-person. `update`/`remove` must also `numerologyCache.invalidate(id)` — extend the existing invalidation calls there.

Add `numerologyCache: NumerologyResultCache` to `SubjectsServiceDeps` and wire it in `app.ts`.

- [ ] **Step 3: Add the route**

```ts
  router.get('/:id/numerology', auth, async (req, res, next) => {
    try {
      const result = await service.getNumerology(
        req.userId as string,
        req.params.id as string,
        referenceDate,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });
```

with the same optional `referenceDate` query validation as Task 3.

- [ ] **Step 4: Test and commit**

```bash
npm test -w @astrocalc/backend
git commit -m "feat(backend): numerology for saved subjects (#64)"
```

---

### Task 5: Mobile API client and offline service (#65)

**Files:**
- Create: `apps/mobile/src/api/numerologyApi.ts`, `apps/mobile/src/offline/numerologyService.ts` (+ test), `apps/mobile/src/offline/numerologyServiceWiring.ts`

- [ ] **Step 1: Write `numerologyApi.ts`**

Mirror `natalChartApi.ts` exactly, **including its private `parseJson` helper and local `ApiEnvelope<T>` type**. These are duplicated per api module in this codebase rather than shared; copy the duplication to stay consistent instead of refactoring it here.

```ts
export interface NumerologyResponse {
  profile: NumerologyProfile;
  interpretation: null;
}

export async function fetchNumerology(referenceDate: string): Promise<NumerologyResponse>;
export async function getSubjectNumerology(id: string, referenceDate: string): Promise<NumerologyResponse>;
export { ApiError } from './httpClient';
```

Paths: `/numerology?referenceDate=…` and `/subjects/${id}/numerology?referenceDate=…`.

- [ ] **Step 2: Write the failing offline-service test**

Create `apps/mobile/src/offline/numerologyService.test.ts`. It must run under plain-Node Vitest with **no React Native import**, so every import in the module under test is type-only. Cover: online path returns the backend result; a network error falls back to local `computeNumerologyProfile`; a non-network error rethrows; missing name/birth date throws `MissingNumerologyDataError` before any network call.

- [ ] **Step 3: Write `numerologyService.ts`**

Mirror `offline/natalChartService.ts`: free functions taking `deps` as a parameter (not a factory), a `MissingNumerologyDataError` carrying `missing: string[]`, and:

```ts
export interface NumerologyServiceDeps {
  fetchNumerology: (referenceDate: string) => Promise<NumerologyResponse>;
  compute: (input: NumerologyInput) => NumerologyProfile;
  isNetworkError: (error: unknown) => boolean;
}
```

Numerology needs only a name and a birth date — no coordinates, no timezone, no birth time — so the offline path is strictly simpler than the chart's. **There is no pending-sync step and no offline cache**: the profile is cheap to recompute on device and has no server-derived inputs, so caching it locally would add a staleness bug for no gain. Say that in the module doc comment, so the omission reads as deliberate.

- [ ] **Step 4: Write `numerologyServiceWiring.ts`**

The only file importing non-type bits. Mirror `natalChartServiceWiring.ts`: a `defaultDeps()` and a thin `loadNumerology(profile, referenceDate)` wrapper.

- [ ] **Step 5: Test and commit**

```bash
npm test -w @astrocalc/mobile
git commit -m "feat(mobile): numerology API client and offline path (#65)"
```

---

### Task 6: Text formatter and translations (#66)

**Files:**
- Create: `apps/mobile/src/numerology/numerologyText.ts` (+ test)
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] **Step 1: Write the failing formatter test**

Create `apps/mobile/src/numerology/numerologyText.test.ts`, mirroring `src/chart/chartText.test.ts` — a hand-rolled minimal `NumerologyProfile` fixture, assertions per locale, no React.

Cover: every number appears as a labelled row; a master number is flagged; a karmic debt is flagged; the current Pinnacle and Challenge are marked; age ranges render as `0–34` and the open-ended last one as `53+`.

- [ ] **Step 2: Write `numerologyText.ts`**

Follow `chartText.ts` precisely: pure, locale-driven, `import type { Locale } from '../i18n/translations';`, lookup tables typed `Record<Locale, ...>`, and **names rather than symbols** (React Native `Text` uses the system font).

```ts
export interface NumerologyRow {
  key: string;
  label: string;
  value: string;
  /** e.g. "master number" / "usta rəqəm", or null. */
  badge: string | null;
}

export interface NumerologyPeriodRow {
  key: string;
  label: string;
  value: string;
  ageRange: string;
  isCurrent: boolean;
}

export interface NumerologyDetails {
  core: NumerologyRow[];
  extended: NumerologyRow[];
  cycles: NumerologyRow[];
  pinnacles: NumerologyPeriodRow[];
  challenges: NumerologyPeriodRow[];
}

export function formatNumerologyDetails(
  profile: NumerologyProfile,
  locale: Locale,
): NumerologyDetails;
```

- [ ] **Step 3: Add the i18n keys**

`translations.ts` is a **flat dotted-key map**, and `az` is typed `Record<keyof typeof en, string>` — so a key added to `en` without `az` is a compile error. Add both together, under a new `numerology.*` namespace (the 14th).

Keys needed: `title`, `subtitle`, `coreTitle`, `extendedTitle`, `cyclesTitle`, `pinnaclesTitle`, `challengesTitle`, `currentBadge`, `masterBadge`, `karmicDebtBadge`, `lifePath`, `expression`, `soulUrge`, `personality`, `birthday`, `maturity`, `personalYear`, `personalMonth`, `pinnacle`, `challenge`, `missingFullName`, `missingFullNameCta`, `loadError`, `retry`, `readingTitle`, `readingUnavailableOffline`.

`numerology.missingFullName` must be an actual instruction, not an error code — something the user can act on, since the fix is "go add your full name to your profile". Pair it with `missingFullNameCta` as the button label.

- [ ] **Step 4: Test and commit**

```bash
npm test -w @astrocalc/mobile
npm run typecheck -w @astrocalc/mobile
git commit -m "feat(mobile): numerology text formatter and translations (#66)"
```

---

### Task 7: The screen and its entry points (#66)

**Files:**
- Create: `apps/mobile/src/screens/NumerologyScreen.tsx`, `apps/mobile/app/numerology.tsx`
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`, `apps/mobile/app/profile.tsx`, `apps/mobile/src/screens/PeopleScreen.tsx`, `apps/mobile/app/people.tsx`

- [ ] **Step 1: Write the screen**

Mirror `NatalChartScreen.tsx`: the same `LoadState` discriminated union (`loading` / `error` / `ready`), the same `BG`/`GOLD` palette and style-key naming (`container`, `content`, `centered`, `title`, `sectionTitle`, `subTitle`, `detailRow`, `detailName`, `detailValue`, `error`, `retryButton`, `retryButtonText`), and the same dual-mode `subjectId` prop shape.

Sections in order: core four, extended, current cycle, Pinnacles, Challenges — then an empty reading section, matching the natal chart.

**Screens never call `useRouter`.** They take `on*` callback props; the `app/*.tsx` route file injects navigation. When the profile has no full name, render the `missingFullName` message with a button calling an `onEditProfile` prop.

The current Pinnacle and Challenge need a **visible** marker, not just a data flag — that is the whole reason those blocks carry age ranges.

- [ ] **Step 2: Write the route adapter**

`apps/mobile/app/numerology.tsx`, mirroring `app/natal-chart.tsx`:

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NumerologyScreen } from '../src/screens/NumerologyScreen';

export default function Numerology() {
  const router = useRouter();
  const { subjectId, name } = useLocalSearchParams<{ subjectId?: string; name?: string }>();
  return (
    <NumerologyScreen
      subjectId={subjectId}
      subjectName={name}
      onEditProfile={() => router.push('/profile')}
    />
  );
}
```

Routes are file-based with a bare `<Stack />` — no layout registration needed.

- [ ] **Step 3: Add the entry points**

- `ProfileScreen.tsx`: add an `onViewNumerology` prop and a button beside the existing "view chart" one; `app/profile.tsx` passes `() => router.push('/numerology')`.
- `PeopleScreen.tsx`: add `onOpenSubjectNumerology`; `app/people.tsx` passes `(id, name) => router.push({ pathname: '/numerology', params: { subjectId: id, name } })`.

- [ ] **Step 4: Add the full-name field to the profile form**

`ProfileScreen.tsx` must let the user set `fullName` — otherwise Task 1's column can never be populated and the feature is unreachable. Place it above `displayName` with a hint explaining it is used for numerology and should be the full birth name.

- [ ] **Step 5: Verify and commit**

```bash
npm test -w @astrocalc/mobile
npm run typecheck -w @astrocalc/mobile
npm run lint
git commit -m "feat(mobile): numerology screen and entry points (#66)"
```

---

### Task 8: Verify end to end, then open the PR

- [ ] **Step 1: Full green**

```bash
npm test -w @astrocalc/calc-engine
npm test -w @astrocalc/backend
npm test -w @astrocalc/mobile
npm run lint
npm run format:check
npm run typecheck -w @astrocalc/calc-engine
npm run typecheck -w @astrocalc/mobile
```

- [ ] **Step 2: Update `BACKLOG.md`**

Add an entry at the top of the current date's section. State plainly what shipped, and what did not: no interpretation text, no Pro gating, and **the migration has been generated but not applied** — that is the user's call.

- [ ] **Step 3: Open the PR**

Labels are mandatory per `CLAUDE.md`: `backend`, `mobile`, `i18n`, `p1`. Body must state `Closes #64, #65, #66.` and lead with the `profiles.fullName` decision and the un-applied migration, since those are the two things a reviewer most needs to know.

---

## Self-review notes

**Issue coverage:** #64 → Tasks 1–4; #65 → Task 5; #66 → Tasks 6–7. Task 8 is release mechanics.

**Deliberate omissions, all stated in-plan:** no Pro/Free gating (no mechanism exists to hook into); no interpretation text (#76); no offline cache for numerology (nothing server-derived to preserve); `db:migrate` not run (touches the live database).

**The two riskiest steps** are Task 1 Step 4 — threading `fullName` through *both* the Drizzle and in-memory repositories, where missing the fake makes tests green against wrong behaviour — and Task 3 Step 6, the cache invalidation on profile write, where a miss means users keep seeing stale numbers after correcting their name.
