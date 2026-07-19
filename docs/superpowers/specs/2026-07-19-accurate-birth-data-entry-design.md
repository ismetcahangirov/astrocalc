# Spec 1 — Accurate birth-data entry (date/time pickers, map, auto-timezone)

Date: 2026-07-19
Status: approved (design)
Follow-on: [Spec 2 — Multiple people (saved subjects)](./2026-07-19-multiple-subjects-design.md)

## Problem

The birth-data a natal chart is computed from is currently entered and stored
in ways that make the result inaccurate or hard to get right:

1. **Birth date / time are free-text fields.** The onboarding and profile
   screens use `TextInput`s (`keyboardType="numbers-and-punctuation"`), so the
   format is ambiguous and easy to mis-enter.
2. **Timezone is never derived — it must be hand-typed.** Selecting a place
   fills `lat`/`lng` but *not* `birthPlaceTimezone`. The only way to set the
   timezone is the "manual" fallback, where the user types an IANA name such as
   `Asia/Baku`. Almost no one knows their birth zone's IANA id, and the backend
   chart calculation **requires** a timezone (`natalChartService` lists
   `birthPlaceTimezone` in its `missing` set otherwise). A wrong or absent zone
   shifts the UT conversion and therefore every planet and house cusp.
3. **The correct tool exists but is unused.** `@astrocalc/calc-engine/node`
   exports `findTimeZones(lat, lng)` (a `geo-tz` lookup that is historically
   accurate across DST-rule changes), and its own doc comment claims "backend
   code resolves the birth-place timezone at profile-save time" — but a grep
   shows it is **never called by the backend**. The keystone is missing.

## Goals

- Replace typed birth date/time with modal pickers.
- Let the user pick a birth place on a map (no third-party API key).
- **Auto-derive the IANA timezone from lat/lng on the backend at save time**, so
  the chart is correct regardless of how the place was entered. This is the
  accuracy fix; the pickers and map are the UX layer on top of it.
- Build the entry pieces as reusable components (consumed by Spec 2's subject
  form).

## Non-goals

- Multiple subjects / other people — that is Spec 2.
- On-device (offline) timezone derivation. The RN-safe calc-engine build
  deliberately excludes `geo-tz` (needs Node `fs`). The backend save is the
  authoritative point where the stored timezone is set; offline compute then
  reuses that stored zone.

## Backend

### 1. Auto-timezone on profile save (the keystone)

In the profile save path (`profileService` → used by `PATCH /profile`):

- After merging the patch, if the resulting profile has both `birthPlaceLat`
  and `birthPlaceLng`, call `findTimeZones(lat, lng)` from
  `@astrocalc/calc-engine/node` and set `birthPlaceTimezone` to the first
  result. **Ignore any client-sent `birthPlaceTimezone`** — the server is the
  single source of truth for the zone.
- If lat/lng are absent, leave `birthPlaceTimezone` null.
- If `findTimeZones` returns an empty array (open ocean / no zone), leave it
  null; the chart's own "missing fields" contract then applies.
- The derivation only needs to run when lat/lng actually changed (cheap either
  way; keep it simple and always derive when both are present).

The backend already depends on `@astrocalc/calc-engine`; switch the relevant
import to the `/node` subpath so `findTimeZones` is available. `geo-tz`'s
dataset is bundled with the package.

### 2. Reverse-geocode endpoint

`GET /geocoding/reverse?lat=<num>&lng=<num>` (auth-required, same as
`/geocoding/search`):

- Add a `reverse(lat, lng)` method to `NominatimClient`
  (`/reverse?format=jsonv2&lat=&lon=`), cached and rate-limited through the
  existing `GeocodeCache` / `NominatimRateLimiter`.
- Response: `{ name, region, timezone }` where `timezone = findTimeZones(lat,
  lng)[0] ?? null`.
- On Nominatim failure, still return `{ name: null, region: null, timezone }`
  (the tz derivation is local and independent of Nominatim), so the map can
  always show at least the derived zone.

Used by the map picker to label a dropped pin and preview the derived zone.

## Mobile

Adds two native modules (→ native rebuild required):
`@react-native-community/datetimepicker`, `react-native-webview`
(both installed via `npx expo install`).

### 1. Date picker

`DatePickerField` wrapping `@react-native-community/datetimepicker` in modal
mode. Replaces the typed `birthDate` input in the onboarding wizard and the
profile screen. Stores `YYYY-MM-DD`. `maximumDate = today`, `minimumDate` a
sane floor (1900-01-01). Displays the chosen date formatted per the active
locale.

### 2. Time picker

`TimePickerField` (same library) in modal mode, replacing the typed
`birthTime`. Stores `HH:mm`. Still gated by the existing `birthTimeKnown`
switch — when time is unknown the picker is disabled and no time is sent.

### 3. Map picker (OpenStreetMap, no API key)

`BirthPlaceMap`: a `react-native-webview` rendering an inline Leaflet page with
OSM raster tiles. Tapping (or dragging the marker) drops a pin; the page posts
`{ lat, lng }` to RN via `postMessage`. RN then calls `GET /geocoding/reverse`
and fills the place name + shows the derived timezone (read-only confirmation).
Presented in a modal opened from the birth-place field.

### 4. `BirthPlaceSearchField` refactor

- Keep the existing search/autocomplete.
- Add a **"Pick on map"** action that opens the `BirthPlaceMap` modal;
  selecting a point fills the same `BirthPlaceValue`.
- **Remove the manual timezone field** — the zone is derived server-side. Keep
  manual lat/lng as a deep fallback (it, too, gets auto-tz'd on save).

### 5. Reusability boundary

The reuse unit is the three field components — `DatePickerField`,
`TimePickerField`, `BirthPlaceSearchField` (with its map) — plus a thin
`BirthDataFields` composite that groups date + time + place. Onboarding keeps
its step-wizard shell but renders these components; the profile screen renders
`BirthDataFields`. Spec 2's subject add/edit form renders the same
`BirthDataFields`.

## i18n

Add keys for the new controls ("Select date", "Select time", "Pick on map",
"Selected location", derived-timezone label, etc.). The mobile app currently
wires `en`/`az`; add the same keys for `tr`/`ru` where the translation table
already carries the other locales, otherwise `en` fallback. Follow the existing
`translations.ts` structure.

## Correctness guarantee (why the calculation becomes right)

Whatever path sets the location — search, map tap, or manual lat/lng — only
`lat`/`lng` are trusted from the client. At save the backend derives the
historically-correct IANA zone from those coordinates via `geo-tz`, stores it,
and `natalChartService` feeds it to `resolveBirthInstant()` for an accurate
local→UT conversion. That closes the gap that currently makes charts wrong.

## Testing

- **Backend (Vitest + Supertest):**
  - `profileService` derives the zone on save: Baku coordinates →
    `Asia/Baku`; a US coordinate with a pre-2007 birth date exercising the DST
    boundary → correct zone; lat/lng absent → `birthPlaceTimezone` stays null;
    client-sent bogus timezone is overwritten.
  - `GET /geocoding/reverse`: returns name + derived zone; Nominatim failure
    still yields the derived zone.
- **Mobile:** pure-`.ts` logic only (date/time format + validation helpers),
  matching the repo convention of not unit-testing `.tsx` components.

## Native deps / rebuild

`@react-native-community/datetimepicker`, `react-native-webview` → run
`expo run:android` (and iOS later) to rebuild the dev client.
