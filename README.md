# AstroCalc

A calculation-first astrology app — zodiac/daily horoscope, natal charts,
transits & compatibility, numerology, and the Matrix of Destiny — built as
an accurate, fast calculation tool first and a "fun astrology app" second.
Account-gated, Free/Pro subscription model.

> **Status: pre-implementation / planning phase.** No application code has
> been written yet. This repository currently holds project scope, design
> direction, and the full GitHub issue breakdown (Epics → sub-issues) that
> serves as the source of truth for what gets built. See
> [Roadmap](#roadmap--milestones) and the [issue tracker][issues].

[issues]: https://github.com/ismetcahangirov/astrocalc/issues

## Overview

| | |
|---|---|
| **Platforms** | Mobile (iOS + Android, React Native/Expo) · Admin panel (web) · Marketing site (web) |
| **Languages** | Azerbaijani (primary), Turkish, English, Russian — full parity across all four |
| **Budget** | $0 to start — every chosen service must have a workable free tier, with a clear upgrade path and no hard vendor lock-in |
| **Core principle** | Calculation accuracy and performance come first; the premium experience is built on top of a correct, well-tested calculation engine |

## Features

Each feature area below is tracked as a GitHub Epic issue, broken into
sub-issues with acceptance criteria and technical notes. Two epics have
been piloted in full detail as a reference for the rest:
[Authentication & User Profile (#1)](https://github.com/ismetcahangirov/astrocalc/issues/1)
and [Natal Chart (#11)](https://github.com/ismetcahangirov/astrocalc/issues/11).

- **Authentication & Profile** — Google OAuth, WhatsApp OTP (Meta Cloud API), onboarding, GDPR-compliant deletion/export
- **Zodiac & Daily Horoscope** — accurate sun-sign calculation from ecliptic longitude (not a static date table), daily/weekly content, push notifications
- **Natal Chart** — planetary positions, house systems (Placidus default), aspects, SVG/Skia wheel visualization, multilingual interpretation
- **Transits & Compatibility** — current transit analysis against a natal chart, synastry between two people
- **Numerology** — Life Path / Expression / Soul Urge / Personality numbers, with a documented AZ/TR/RU transliteration table for the Pythagorean letter-number system
- **Matrix of Destiny** — base-22 reduction algorithm, octagram visualization, original interpretive content, cross-validated against reference calculators
- **Subscriptions & Ads** — RevenueCat entitlements, AdMob rewarded ads for free users, server-side entitlement verification (client `isPro` flags are never trusted)
- **PDF Export** — branded, server-rendered PDF export of results
- **Localization (i18n)** — AZ/TR/EN/RU with locale-aware date/number formatting and case handling
- **Admin Panel** — KPIs, user management, subscription/payment monitoring, ad config, content & translation editing, feature flags, role-based access
- **Backend & Infrastructure** — Express + TypeScript API, Postgres (Neon), Redis (Upstash), async job queue (QStash)
- **Security & Anti-Piracy** — server-side entitlement re-verification, app attestation, certificate pinning, rate-limiting (see [Security](#security-posture))
- **Design System & Animation** (mobile) — dark + gold theme, NativeWind, Reanimated/Moti/Lottie
- **Marketing Website** — Next.js, shadcn/ui
- **Testing, CI/CD & Release** — calc-engine unit tests as a first-class concern, E2E tests, EAS Build, GitHub Actions CI

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native (Expo, custom dev client, New Architecture + Hermes), TypeScript strict | AdMob and app-integrity modules require a custom dev client — plain Expo Go won't work |
| Mobile styling | NativeWind | Tailwind syntax for React Native (plain `tailwindcss` doesn't run on RN) |
| Mobile state | Redux Toolkit + RTK Query | Server-state caching |
| Mobile animation | Reanimated v3, Moti, Lottie, (react-native-skia for the chart wheel) | 60fps UI-thread animation, no JS-thread jank |
| Backend | Node.js + Express + TypeScript | |
| Database | Neon (serverless Postgres) | Generous free tier, branching for test/staging at no extra cost |
| ORM | Drizzle ORM | Lightweight, TypeScript-first, serverless-friendly |
| Cache / rate-limit | Upstash Redis (HTTP-based) | Serverless-friendly free tier |
| Job queue | Upstash QStash | Async PDF generation, notification scheduling |
| Calculation engine | `astronomy-engine` (MIT) | Swiss Ephemeris is the industry standard but AGPL-3.0-licensed, which conflicts with a closed-source commercial app at zero budget |
| Time handling | `geo-tz` + `luxon` | Historically-accurate timezone/DST resolution — a naive static UTC offset produces wrong natal charts |
| Auth | Google OAuth, WhatsApp OTP (Meta Cloud API), JWT access+refresh | |
| Payments | RevenueCat | Free tier covers the zero-budget phase; avoids building billing infra from scratch |
| Ads | AdMob (rewarded ads only) | |
| Admin/marketing web | Next.js, shadcn/ui | |

See individual issues for full technical notes per feature — the tables
above summarize [master spec](https://github.com/ismetcahangirov/astrocalc/issues/1)-level decisions, not implementation detail.

## Repository Structure

Not yet scaffolded. The intended layout is a monorepo:

```
apps/
  mobile/       # Expo React Native app
  backend/      # Express API
  admin/        # Admin panel (web)
  website/      # Marketing site (Next.js)
packages/
  calc-engine/  # Shared, platform-independent calculation logic
                # (zodiac, natal chart, numerology, matrix) — used by
                # both backend and mobile (for offline calculation)
```

Scaffolding this structure is tracked in
[#12](https://github.com/ismetcahangirov/astrocalc/issues/12) (calc-engine)
and the yet-to-be-created Backend & Infrastructure epic.

## Getting Started

There's no code to run yet — this section will be filled in once the
monorepo is scaffolded (tracked separately; see the issue tracker for the
`chore` label).

## Roadmap / Milestones

| Milestone | Scope |
|---|---|
| **M0 — Setup & Infra** | Repo, CI/CD, Neon/Redis setup, design tokens |
| **M1 — Auth + Basic Calculations (MVP)** | Google/WhatsApp auth, zodiac, numerology |
| **M2 — Complex Calculations** | Natal chart, Matrix of Destiny |
| **M3 — Monetization** | RevenueCat, AdMob, PDF export |
| **M4 — Admin Panel** | |
| **M5 — Marketing Website** | |
| **M6 — Security Hardening & Localization Polish** | |
| **M7 — Beta & Store Submission** | |

Track progress via [milestones](https://github.com/ismetcahangirov/astrocalc/milestones)
and [issues][issues].

## Security Posture

No client-side mobile app is fully "crack-proof" — that's true industry-wide.
The realistic, achievable goal here: valuable logic (real calculation
results, especially detailed Pro-tier interpretation) never lives
client-side — it's always served from an authenticated, entitlement-checked
backend request. A cracked/repackaged APK can show UI, but can't get real
Pro results, because the backend re-verifies subscription status on every
request. See the Security & Anti-Piracy epic for concrete measures
(server-side entitlement checks, Play Integrity/App Attest, certificate
pinning, rate-limiting).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch/PR workflow, commit
conventions, and issue/label conventions. Project-specific instructions for
AI coding agents live in [CLAUDE.md](./CLAUDE.md).

## License

Not yet decided — tracked as a follow-up issue. Do not assume any license
grant until one is added.
