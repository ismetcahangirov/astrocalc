# Spec 2 — Multiple people (saved subjects)

Date: 2026-07-19
Status: approved (design)
Depends on: [Spec 1 — Accurate birth-data entry](./2026-07-19-accurate-birth-data-entry-design.md)

## Problem / goal

After signing in you can only compute *your own* chart. Users want to enter and
**save** other people's birth data (friends, family) and revisit their charts.
"You" become one entry in a list of people.

## Data model

- Keep the user's own data in the existing `profiles` table — onboarding,
  account export (#9) and deletion all depend on it; unifying it into subjects
  would be a risky refactor for no user-visible gain.
- Add a new `subjects` table (one row per saved person, scoped to a user):
  `id`, `userId` (FK → users, cascade delete), `name`, `birthDate`,
  `birthTime`, `birthTimeKnown`, `birthPlaceName`, `birthPlaceLat`,
  `birthPlaceLng`, `birthPlaceTimezone`, `createdAt`, `updatedAt` — the same
  birth-data shape as `profiles`.
- In the UI these are presented as **one list**: "Me" (from the profile) pinned
  at the top, followed by the user's subjects. Self reads from `profiles`,
  others from `subjects`, but they feel unified. This is also the foundation the
  future synastry/compatibility epic needs (pick any two people).

## Backend

- **CRUD** (auth-scoped to `userId`, ownership enforced — a user can only see /
  edit / delete their own subjects):
  - `POST /subjects`, `GET /subjects`, `GET /subjects/:id`,
    `PATCH /subjects/:id`, `DELETE /subjects/:id`.
  - Reuse Spec 1's auto-timezone-on-save helper: when a subject is created or
    updated with lat/lng, derive `birthPlaceTimezone` server-side.
- **Chart compute for a subject:** `GET /subjects/:id/natal-chart`, mirroring
  the existing profile natal-chart route and reusing `natalChartService` with
  the subject's birth fields. The chart-result cache is already keyed by a hash
  of the birth-data (`hashChartCacheKey`), so it is reused with no change.
- **GDPR (#9):** include subjects in the account data export and cascade-delete
  them on account deletion.

## Mobile

- **People list screen:** "Me" pinned (from the profile) + the subjects list.
  Row tap → that person's natal chart. A `+` action opens the subject form
  (reusing Spec 1's `BirthDataFields` + a name field) → `POST /subjects`. Rows
  offer edit (→ `PATCH`) and delete (→ `DELETE`, with confirm).
- **`natalChartService`:** add the ability to fetch a chart by `subjectId`
  (online) alongside the existing self path. Offline, a subject saved earlier
  already carries its server-derived timezone, so on-device compute works for
  previously-saved people.
- **Navigation:** add a People entry point from the home screen.

## Testing

- **Backend:** subjects CRUD unit/integration including **ownership isolation**
  (user A cannot read/edit/delete user B's subjects); auto-tz on subject save;
  `GET /subjects/:id/natal-chart`; export includes subjects and deletion
  cascades.
- **Mobile:** list-merge logic and subject-form validation as pure `.ts` tests.

## Sequencing

Built after Spec 1 — it consumes Spec 1's reusable `BirthDataFields` and the
shared auto-timezone derivation, so this spec is largely assembly.
