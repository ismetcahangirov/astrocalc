# @astrocalc/calc-engine

Shared, platform-independent calculation engine (zodiac, natal chart,
numerology, Matrix of Destiny) used by both `apps/backend` and `apps/mobile`.
Pure TypeScript — no Node.js- or React Native-specific APIs — so the same
code runs on the server and on-device (offline calculation, #20).

This package is currently a skeleton (#12): the workspace wiring, build/test
pipeline, and shared primitives are in place; calculation domains land in
their own sub-issues (#13 planetary positions, #14 house systems, #15
aspects, #16 historical timezone accuracy, etc.).

## Usage

```ts
import { CalcEngineError } from '@astrocalc/calc-engine';
```

## Public API surface

- `CalcEngineError` (`src/errors.ts`) — base error class for all calc-engine
  failures. Carries a stable `code` (for programmatic branching) and a
  human-readable `message`. Callers use `instanceof CalcEngineError` to
  distinguish engine errors from unrelated ones.
- `GeoCoordinates` (`src/types.ts`) — `{ latitude, longitude }` in decimal
  degrees (WGS84). Shared input shape for any calculation that needs a place.

**Conventions future domain modules should follow:** each calculation domain
exports plain functions (`calculate(input): output`), not classes, with
fully-typed, JSON-serializable input/output objects — no class instances,
`Date` objects, or platform-specific types crossing the public API, so results
can flow through a REST JSON response or straight into mobile app state.
Validation/calculation failures throw a `CalcEngineError` subclass rather than
returning ad hoc error shapes.

## Development

```bash
npm run build -w packages/calc-engine       # tsc -> dist/
npm run typecheck -w packages/calc-engine
npm run test -w packages/calc-engine        # vitest
```
