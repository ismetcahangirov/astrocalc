# Numerology Calculation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete numerology calculation domain in `@astrocalc/calc-engine` — every number from Life Path to Challenges — as pure, React-Native-safe functions with cross-validated tests.

**Architecture:** A new `packages/calc-engine/src/numerology/` folder holding one module per concern (reduction arithmetic, alphabet handling, core numbers, cycle numbers, life periods, assembly). Everything is a plain function over JSON-serialisable data, throws `CalcEngineError` on bad input, and imports no Node built-ins — so the same code runs on the backend and on-device. The single entry point `computeNumerologyProfile()` composes the rest, mirroring how `computeNatalChart()` composes the astrology modules.

**Tech Stack:** TypeScript 5.7 (CommonJS output), Vitest 2.1 (`environment: 'node'`, `globals: false`), ESLint + Prettier.

**Covers issues:** #58, #59, #60, #61, #62, #63. Backend and mobile (#64–#66) are a separate plan.

---

## Context an engineer needs before starting

**Run tests** from the repo root:

```bash
npm test -w @astrocalc/calc-engine
```

Or a single file, from `packages/calc-engine/`:

```bash
npx vitest run src/numerology/reduce.test.ts
```

**Conventions this package enforces** (from `packages/calc-engine/README.md`):

- Each calculation domain exports plain **functions** (`calculate(input): output`), never classes.
- Input/output must be **fully-typed and JSON-serialisable** — no `Date` objects, no class instances crossing the public API.
- Validation failures throw `CalcEngineError` (`src/errors.ts`), constructed as `new CalcEngineError('invalid_input', 'message')`.
- Tests are **co-located** as `<name>.test.ts` beside the source, never in a separate `__tests__` tree.
- `globals: false` in the Vitest config means every test file must `import { describe, expect, it } from 'vitest'` explicitly.
- The repo has `noUncheckedIndexedAccess` on, so `array[i]` is `T | undefined`. Use `array[i]!` only where the index is provably in range, and prefer `for...of` where possible.
- ESLint forbids `Array<T>` — write `T[]`.

**Trap to avoid — do NOT extend `listInterpretationSubjects()` in this plan.**
That function is the source of truth for the *seed parity test* (`apps/backend/src/interpretations/seedContent.test.ts:11`) and for `interpretationService.listMissing()`. Adding 189 numerology subjects to it while no numerology content exists would immediately fail `seedContent.test.ts`, which asserts one generated row per required `(category, subjectKey, locale)`. Task 1 therefore adds a **separate** `listNumerologySubjects()` export and leaves `listInterpretationSubjects()` untouched. Wiring the two together is issue #82, in the content epic, once text exists.

---

## File structure

**Created:**

| File | Responsibility |
| --- | --- |
| `packages/calc-engine/src/date-parsing.ts` | Shared strict `YYYY-MM-DD` parser, extracted from `natal-chart.ts` so numerology does not duplicate it |
| `packages/calc-engine/src/numerology/types.ts` | `NumerologyNumber` and the shared result shapes |
| `packages/calc-engine/src/numerology/reduce.ts` | Digit reduction, master numbers, karmic debt |
| `packages/calc-engine/src/numerology/alphabet.ts` | Romanization (AZ/TR/RU), Pythagorean letter values, vowel/consonant split |
| `packages/calc-engine/src/numerology/coreNumbers.ts` | Life Path, Expression, Soul Urge, Personality |
| `packages/calc-engine/src/numerology/cycleNumbers.ts` | Birthday, Maturity, Personal Year, Personal Month |
| `packages/calc-engine/src/numerology/periods.ts` | Pinnacles and Challenges |
| `packages/calc-engine/src/numerology/index.ts` | `computeNumerologyProfile()` assembly + `NUMEROLOGY_SCHEMA_VERSION` |
| `packages/calc-engine/src/__fixtures__/reference-numerology.ts` | Hand-verified reference profiles |

Plus a co-located `.test.ts` for each of the above except `types.ts` and the fixture.

**Modified:**

| File | Change |
| --- | --- |
| `packages/calc-engine/src/interpretations.ts` | Widen `InterpretationCategory`; add numerology subject keys + `listNumerologySubjects()` |
| `packages/calc-engine/src/natal-chart.ts:105-120` | Use the extracted shared date parser |
| `packages/calc-engine/src/index.ts` | Re-export the new public API |
| `apps/backend/src/interpretations/interpretationRoute.ts:9` | Widen the `zod` category enum |

---

### Task 1: Widen the interpretation category system (#58)

**Files:**
- Modify: `packages/calc-engine/src/interpretations.ts`
- Test: `packages/calc-engine/src/interpretations.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/calc-engine/src/interpretations.test.ts`:

```ts
describe('numerology subject keys', () => {
  it('builds a stable key per number kind and value', () => {
    expect(numerologySubjectKey('life-path', 7)).toBe('life-path-7');
    expect(numerologySubjectKey('personal-year', 1)).toBe('personal-year-1');
    expect(numerologySubjectKey('challenge', 0)).toBe('challenge-0');
  });

  it('rejects a value outside the kind range', () => {
    expect(() => numerologySubjectKey('life-path', 10)).toThrow(CalcEngineError);
    expect(() => numerologySubjectKey('birthday', 32)).toThrow(CalcEngineError);
    expect(() => numerologySubjectKey('challenge', 9)).toThrow(CalcEngineError);
  });
});

describe('listNumerologySubjects', () => {
  const subjects = listNumerologySubjects();

  it('enumerates 189 subjects, all in the numerology category', () => {
    expect(subjects).toHaveLength(189);
    expect(subjects.every((s) => s.category === 'numerology')).toBe(true);
  });

  it('has no duplicate keys', () => {
    expect(new Set(subjects.map((s) => s.subjectKey)).size).toBe(subjects.length);
  });

  it('is NOT folded into listInterpretationSubjects yet (see #82)', () => {
    const astrology = listInterpretationSubjects();
    expect(astrology).toHaveLength(465);
    expect(astrology.some((s) => s.category === 'numerology')).toBe(false);
  });
});
```

Add `CalcEngineError`, `numerologySubjectKey` and `listNumerologySubjects` to the existing imports at the top of that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/interpretations.test.ts`
Expected: FAIL — `numerologySubjectKey is not a function`.

- [ ] **Step 3: Write the implementation**

In `packages/calc-engine/src/interpretations.ts`, replace the `InterpretationCategory` type and its doc comment with:

```ts
/**
 * The kinds of computed result AstroCalc writes interpretation text for.
 * The first three are natal-chart placements (#18); `numerology` and `matrix`
 * were added for the numerology (#57) and Matrix of Destiny (#67) epics.
 */
export type InterpretationCategory =
  | 'planet-sign'
  | 'planet-house'
  | 'aspect'
  | 'numerology'
  | 'matrix';
```

Then append to the same file:

```ts
/**
 * The numerology numbers that get their own interpretation text. Each kind has
 * its own valid value range, because the same digit means different things in
 * different positions — a 7 Life Path and a 7 Personal Year are unrelated
 * readings, so they are separate subjects rather than one shared "7" text.
 */
export type NumerologyNumberKind =
  | 'life-path'
  | 'expression'
  | 'soul-urge'
  | 'personality'
  | 'birthday'
  | 'maturity'
  | 'personal-year'
  | 'personal-month'
  | 'pinnacle-1'
  | 'pinnacle-2'
  | 'pinnacle-3'
  | 'pinnacle-4'
  | 'challenge-1'
  | 'challenge-2'
  | 'challenge-3'
  | 'challenge-4';

/** Values that carry master numbers: 1–9 plus 11, 22, 33. */
const MASTER_RANGE: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];
/** Values reduced to a single digit: 1–9. */
const SINGLE_RANGE: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Challenges uniquely include 0, and never exceed 8. */
const CHALLENGE_RANGE: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** Birthday is the raw day of the month, never reduced. */
const BIRTHDAY_RANGE: readonly number[] = Array.from({ length: 31 }, (_, i) => i + 1);

/** The values each numerology kind can take — also the enumeration order. */
const NUMEROLOGY_VALUE_RANGES: Record<NumerologyNumberKind, readonly number[]> = {
  'life-path': MASTER_RANGE,
  expression: MASTER_RANGE,
  'soul-urge': MASTER_RANGE,
  personality: MASTER_RANGE,
  birthday: BIRTHDAY_RANGE,
  maturity: MASTER_RANGE,
  'personal-year': SINGLE_RANGE,
  'personal-month': SINGLE_RANGE,
  'pinnacle-1': MASTER_RANGE,
  'pinnacle-2': MASTER_RANGE,
  'pinnacle-3': MASTER_RANGE,
  'pinnacle-4': MASTER_RANGE,
  'challenge-1': CHALLENGE_RANGE,
  'challenge-2': CHALLENGE_RANGE,
  'challenge-3': CHALLENGE_RANGE,
  'challenge-4': CHALLENGE_RANGE,
};

/**
 * Build the subject key for a numerology number, e.g. `life-path-7`.
 * Accepts the unsuffixed `pinnacle`/`challenge` kinds too, so callers that
 * do not care about the position can pass `'challenge'` and a value.
 */
export function numerologySubjectKey(kind: string, value: number): string {
  const range = NUMEROLOGY_VALUE_RANGES[kind as NumerologyNumberKind] ?? rangeForLooseKind(kind);
  if (!range) {
    throw new CalcEngineError('invalid_input', `unknown numerology kind: ${kind}`);
  }
  if (!range.includes(value)) {
    throw new CalcEngineError(
      'invalid_input',
      `value ${value} is not valid for numerology kind '${kind}'`,
    );
  }
  return `${kind}-${value}`;
}

/** `'pinnacle'`/`'challenge'` without a position index still have a known range. */
function rangeForLooseKind(kind: string): readonly number[] | null {
  if (kind === 'pinnacle') return MASTER_RANGE;
  if (kind === 'challenge') return CHALLENGE_RANGE;
  return null;
}

/**
 * Enumerate every numerology subject that needs interpretation text: 189 keys
 * (48 core + 61 extended/cycle + 80 pinnacle/challenge).
 *
 * Deliberately **not** merged into {@link listInterpretationSubjects} yet. That
 * function drives the backend seed-parity test and the admin completeness
 * check, both of which would fail the moment these keys appear with no content
 * behind them. Merging is issue #82, once the numerology text exists.
 */
export function listNumerologySubjects(): InterpretationSubject[] {
  const subjects: InterpretationSubject[] = [];
  for (const kind of Object.keys(NUMEROLOGY_VALUE_RANGES) as NumerologyNumberKind[]) {
    for (const value of NUMEROLOGY_VALUE_RANGES[kind]) {
      subjects.push({ category: 'numerology', subjectKey: numerologySubjectKey(kind, value) });
    }
  }
  return subjects;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @astrocalc/calc-engine`
Expected: PASS. The count check is `4 × 12 + 31 + 12 + 9 + 9 + 4 × 12 + 4 × 9 = 189`.

- [ ] **Step 5: Verify the backend parity test is still green**

Run: `npm test -w @astrocalc/backend -- src/interpretations/seedContent.test.ts`
Expected: PASS — proving `listInterpretationSubjects()` was genuinely left alone.

- [ ] **Step 6: Export from the package entry point**

In `packages/calc-engine/src/index.ts`, add to the existing `from './interpretations'` export block:

```ts
  numerologySubjectKey,
  listNumerologySubjects,
  type NumerologyNumberKind,
```

- [ ] **Step 7: Widen the backend category enum**

In `apps/backend/src/interpretations/interpretationRoute.ts:9`, change the enum to:

```ts
const categorySchema = z.enum(['planet-sign', 'planet-house', 'aspect', 'numerology', 'matrix']);
```

Keep the surrounding schema and handler unchanged.

- [ ] **Step 8: Run the full suite and commit**

```bash
npm test -w @astrocalc/calc-engine
npm test -w @astrocalc/backend
git add packages/calc-engine/src/interpretations.ts packages/calc-engine/src/interpretations.test.ts packages/calc-engine/src/index.ts apps/backend/src/interpretations/interpretationRoute.ts
git commit -m "feat(calc-engine): widen interpretation categories beyond astrology (#58)"
```

---

### Task 2: Extract the shared date parser

**Files:**
- Create: `packages/calc-engine/src/date-parsing.ts`
- Create: `packages/calc-engine/src/date-parsing.test.ts`
- Modify: `packages/calc-engine/src/natal-chart.ts:105-120`

Numerology needs the same strict `YYYY-MM-DD` parsing `natal-chart.ts` already has as a private function. Two consumers of an identical parser is where it should become shared — not a speculative abstraction.

- [ ] **Step 1: Write the failing test**

Create `packages/calc-engine/src/date-parsing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import { parseIsoDate } from './date-parsing';

describe('parseIsoDate', () => {
  it('parses a well-formed date into numeric parts', () => {
    expect(parseIsoDate('1990-03-07')).toEqual({ year: 1990, month: 3, day: 7 });
  });

  it('rejects a malformed or out-of-range date', () => {
    for (const bad of ['1990-3-7', '07.03.1990', '1990-13-01', '1990-02-30', '']) {
      expect(() => parseIsoDate(bad)).toThrow(CalcEngineError);
    }
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseIsoDate('2024-02-29').day).toBe(29);
    expect(() => parseIsoDate('2023-02-29')).toThrow(CalcEngineError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/date-parsing.test.ts`
Expected: FAIL — cannot resolve `./date-parsing`.

- [ ] **Step 3: Write the implementation**

Create `packages/calc-engine/src/date-parsing.ts`:

```ts
import { CalcEngineError } from './errors';

/**
 * Strict civil-date parsing shared by every domain that takes a birth date.
 *
 * Calendar-aware: it rejects `2023-02-30` and `2023-02-29`, not just malformed
 * strings, so a bad date fails at the boundary rather than silently rolling
 * over into the next month inside a later calculation.
 */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days in each month; February is corrected for leap years at call time. */
const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Parse a strict `YYYY-MM-DD` date, or throw `CalcEngineError('invalid_input')`. */
export function parseIsoDate(value: string): CalendarDate {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;
  if (!match) {
    throw new CalcEngineError('invalid_input', `date must be 'YYYY-MM-DD', got: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    throw new CalcEngineError('invalid_input', `month must be within [1, 12], got: ${value}`);
  }

  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]!;
  if (day < 1 || day > maxDay) {
    throw new CalcEngineError('invalid_input', `day must be within [1, ${maxDay}], got: ${value}`);
  }

  return { year, month, day };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @astrocalc/calc-engine -- src/date-parsing.test.ts`
Expected: PASS.

- [ ] **Step 5: Point `natal-chart.ts` at the shared parser**

In `packages/calc-engine/src/natal-chart.ts`, add to the imports:

```ts
import { parseIsoDate } from './date-parsing';
```

Delete the local `DATE_PATTERN` const and the entire private `parseDate` function (lines 105 and 112-120 in the current file), and change the one call site inside `toLocalDateTime`:

```ts
  const { year, month, day } = parseIsoDate(input.birthDate);
```

Leave `TIME_PATTERN` and `parseTime` exactly as they are — only the date parser moves.

- [ ] **Step 6: Run the whole suite to verify nothing regressed**

Run: `npm test -w @astrocalc/calc-engine`
Expected: PASS, including the existing natal-chart and reference-chart suites.

Note: `natal-chart.test.ts` may assert the old error message text for a bad date. If it does, update the assertion to the new message — the behaviour (throwing `CalcEngineError` with code `invalid_input`) is unchanged, and the new parser is strictly stricter.

- [ ] **Step 7: Commit**

```bash
git add packages/calc-engine/src/date-parsing.ts packages/calc-engine/src/date-parsing.test.ts packages/calc-engine/src/natal-chart.ts
git commit -m "refactor(calc-engine): extract shared strict date parsing"
```

---

### Task 3: Reduction primitives, master numbers, karmic debt (#60)

**Files:**
- Create: `packages/calc-engine/src/numerology/types.ts`
- Create: `packages/calc-engine/src/numerology/reduce.ts`
- Create: `packages/calc-engine/src/numerology/reduce.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/calc-engine/src/numerology/reduce.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { digitSum, reduceNumber, toSingleDigit } from './reduce';

describe('digitSum', () => {
  it('sums the decimal digits', () => {
    expect(digitSum(1990)).toBe(19);
    expect(digitSum(7)).toBe(7);
    expect(digitSum(0)).toBe(0);
  });
});

describe('reduceNumber', () => {
  it('reduces to a single digit', () => {
    expect(reduceNumber(1990)).toEqual({ value: 1, isMaster: false, karmicDebt: null });
    expect(reduceNumber(7)).toEqual({ value: 7, isMaster: false, karmicDebt: null });
  });

  it('preserves master numbers instead of reducing them', () => {
    expect(reduceNumber(11)).toEqual({ value: 11, isMaster: true, karmicDebt: null });
    expect(reduceNumber(22)).toEqual({ value: 22, isMaster: true, karmicDebt: null });
    expect(reduceNumber(33)).toEqual({ value: 33, isMaster: true, karmicDebt: null });
  });

  it('reduces master numbers when asked to', () => {
    expect(reduceNumber(11, { preserveMasters: false })).toEqual({
      value: 2,
      isMaster: false,
      karmicDebt: null,
    });
  });

  it('records karmic debt seen during reduction, then keeps reducing', () => {
    expect(reduceNumber(13)).toEqual({ value: 4, isMaster: false, karmicDebt: 13 });
    expect(reduceNumber(14)).toEqual({ value: 5, isMaster: false, karmicDebt: 14 });
    expect(reduceNumber(16)).toEqual({ value: 7, isMaster: false, karmicDebt: 16 });
    expect(reduceNumber(19)).toEqual({ value: 1, isMaster: false, karmicDebt: 19 });
  });

  it('records karmic debt reached at an intermediate step, not just the first sum', () => {
    // 49 -> 13 -> 4: the debt is only visible mid-reduction.
    expect(reduceNumber(49)).toEqual({ value: 4, isMaster: false, karmicDebt: 13 });
  });

  it('reports no debt for two-digit sums that are not debt numbers', () => {
    expect(reduceNumber(12).karmicDebt).toBeNull();
    expect(reduceNumber(15).karmicDebt).toBeNull();
  });

  it('rejects negative or non-integer input', () => {
    expect(() => reduceNumber(-1)).toThrow(CalcEngineError);
    expect(() => reduceNumber(1.5)).toThrow(CalcEngineError);
  });
});

describe('toSingleDigit', () => {
  it('always collapses to 0-9, masters included', () => {
    expect(toSingleDigit(11)).toBe(2);
    expect(toSingleDigit(22)).toBe(4);
    expect(toSingleDigit(33)).toBe(6);
    expect(toSingleDigit(1990)).toBe(1);
    expect(toSingleDigit(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/reduce.test.ts`
Expected: FAIL — cannot resolve `./reduce`.

- [ ] **Step 3: Write the shared types**

Create `packages/calc-engine/src/numerology/types.ts`:

```ts
/**
 * A computed numerology number, carrying not just the final value but the two
 * facts a reading depends on: whether it is a master number that was left
 * unreduced, and whether a karmic-debt number was passed through on the way
 * down. Both are lost if only the reduced digit is kept, which is why this is
 * an object rather than a bare `number`.
 */
export interface NumerologyNumber {
  /** The final value: 1–9, or a preserved master number (11, 22, 33). */
  value: number;
  /** True when {@link value} is a master number that was deliberately not reduced. */
  isMaster: boolean;
  /** The karmic-debt number (13, 14, 16 or 19) seen while reducing, else `null`. */
  karmicDebt: number | null;
}
```

- [ ] **Step 4: Write the implementation**

Create `packages/calc-engine/src/numerology/reduce.ts`:

```ts
import { CalcEngineError } from '../errors';
import type { NumerologyNumber } from './types';

/**
 * The arithmetic every numerology number is built on: repeated digit-summing
 * down to a single digit, with two exceptions that carry meaning.
 *
 * **Master numbers** (11, 22, 33) stop the reduction — an 11 Life Path is not a
 * 2. **Karmic-debt numbers** (13, 14, 16, 19) do not stop it, but are recorded:
 * a 13 still reduces to 4, and the reading needs to know it arrived there via
 * 13 rather than via 22 or 40.
 */

/** The master numbers, which reduction stops at rather than passing through. */
export const MASTER_NUMBERS: readonly number[] = [11, 22, 33];

/** The karmic-debt numbers, recorded when passed through during reduction. */
export const KARMIC_DEBT_NUMBERS: readonly number[] = [13, 14, 16, 19];

export interface ReduceOptions {
  /**
   * Stop at 11/22/33 instead of reducing them. Defaults to `true`.
   * Set `false` where a plain digit is required — Pinnacle age ranges and
   * Challenge differences, which are arithmetic inputs rather than readings.
   */
  preserveMasters?: boolean;
}

/** Sum the decimal digits of a non-negative integer. */
export function digitSum(n: number): number {
  let total = 0;
  let remaining = n;
  while (remaining > 0) {
    total += remaining % 10;
    remaining = Math.floor(remaining / 10);
  }
  return total;
}

function assertNonNegativeInteger(n: number): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new CalcEngineError('invalid_input', `expected a non-negative integer, got: ${n}`);
  }
}

/**
 * Reduce a raw sum to its numerology value, preserving master numbers and
 * recording any karmic debt passed through.
 *
 * The first debt number encountered wins — reduction is monotonically
 * decreasing, so at most one debt number can appear on any path anyway.
 */
export function reduceNumber(sum: number, options: ReduceOptions = {}): NumerologyNumber {
  assertNonNegativeInteger(sum);
  const { preserveMasters = true } = options;

  let current = sum;
  let karmicDebt: number | null = null;

  while (current > 9) {
    if (preserveMasters && MASTER_NUMBERS.includes(current)) break;
    if (karmicDebt === null && KARMIC_DEBT_NUMBERS.includes(current)) karmicDebt = current;
    current = digitSum(current);
  }

  return {
    value: current,
    isMaster: preserveMasters && MASTER_NUMBERS.includes(current),
    karmicDebt,
  };
}

/**
 * Collapse a value to a single digit 0–9, ignoring master numbers entirely.
 * Used where the number is an arithmetic operand rather than a reading.
 */
export function toSingleDigit(n: number): number {
  assertNonNegativeInteger(n);
  let current = n;
  while (current > 9) current = digitSum(current);
  return current;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/reduce.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/calc-engine/src/numerology/types.ts packages/calc-engine/src/numerology/reduce.ts packages/calc-engine/src/numerology/reduce.test.ts
git commit -m "feat(calc-engine): numerology reduction, master numbers and karmic debt (#60)"
```

---

### Task 4: Romanization and Pythagorean letter values (#59)

**Files:**
- Create: `packages/calc-engine/src/numerology/alphabet.ts`
- Create: `packages/calc-engine/src/numerology/alphabet.test.ts`

This is the accuracy keystone of the epic: every name-derived number depends on it, exactly as the natal chart depends on timezone derivation.

- [ ] **Step 1: Write the failing test**

Create `packages/calc-engine/src/numerology/alphabet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { letterValue, nameLetters, romanize, splitVowelsAndConsonants } from './alphabet';

describe('romanize', () => {
  it('folds Azerbaijani diacritics to their base Latin letter', () => {
    expect(romanize('Əliyev Çingiz')).toBe('ELIYEV CINGIZ');
    expect(romanize('Gülşən Öztürk')).toBe('GULSEN OZTURK');
    expect(romanize('Ağayev')).toBe('AGAYEV');
  });

  it('folds Turkish dotted and dotless I to the same letter', () => {
    expect(romanize('İsmayıl')).toBe('ISMAYIL');
  });

  it('transliterates Cyrillic to Latin', () => {
    expect(romanize('Иванов')).toBe('IVANOV');
    expect(romanize('Щербак')).toBe('SHCHERBAK');
  });

  it('uppercases and preserves separators for later stripping', () => {
    expect(romanize('anna-maria o’neil')).toBe('ANNA-MARIA O’NEIL');
  });
});

describe('nameLetters', () => {
  it('keeps only A-Z, dropping spaces, hyphens, apostrophes and digits', () => {
    expect(nameLetters("Anna-Maria O'Neil 3rd")).toEqual('ANNAMARIAONEILRD'.split(''));
  });

  it('rejects a name with no usable letters', () => {
    expect(() => nameLetters('   ')).toThrow(CalcEngineError);
    expect(() => nameLetters('123')).toThrow(CalcEngineError);
  });
});

describe('letterValue', () => {
  it('maps letters by the Pythagorean table', () => {
    expect([letterValue('A'), letterValue('J'), letterValue('S')]).toEqual([1, 1, 1]);
    expect([letterValue('I'), letterValue('R')]).toEqual([9, 9]);
    expect(letterValue('H')).toBe(8);
  });

  it('rejects a non-letter', () => {
    expect(() => letterValue('1')).toThrow(CalcEngineError);
  });
});

describe('splitVowelsAndConsonants', () => {
  it('treats AEIOU as vowels', () => {
    const { vowels, consonants } = splitVowelsAndConsonants('MARIA'.split(''));
    expect(vowels).toEqual(['A', 'I', 'A']);
    expect(consonants).toEqual(['M', 'R']);
  });

  it('counts Y as a vowel when it is not adjacent to another vowel', () => {
    // KYLIE: Y sits between K and L, both consonants.
    expect(splitVowelsAndConsonants('KYLIE'.split('')).vowels).toEqual(['Y', 'I', 'E']);
  });

  it('counts Y as a consonant when it is adjacent to a vowel', () => {
    // AYLA: Y follows the vowel A.
    expect(splitVowelsAndConsonants('AYLA'.split('')).consonants).toEqual(['Y', 'L']);
    // YUSIF: Y precedes the vowel U.
    expect(splitVowelsAndConsonants('YUSIF'.split('')).consonants).toEqual(['Y', 'S', 'F']);
  });

  it('partitions every letter into exactly one bucket', () => {
    const letters = 'MEHRIBANYAGUBOVA'.split('');
    const { vowels, consonants } = splitVowelsAndConsonants(letters);
    expect(vowels.length + consonants.length).toBe(letters.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/alphabet.test.ts`
Expected: FAIL — cannot resolve `./alphabet`.

- [ ] **Step 3: Write the implementation**

Create `packages/calc-engine/src/numerology/alphabet.ts`:

```ts
import { CalcEngineError } from '../errors';

/**
 * Letters to numbers, for every alphabet AstroCalc supports.
 *
 * The Pythagorean system is defined over the 26-letter Latin alphabet, so
 * Azerbaijani, Turkish and Russian names are romanized first and then valued
 * with the same table — rather than each language getting its own table. That
 * keeps one letter-value system across all four locales, so the same person's
 * Expression number does not change with the app's display language.
 *
 * Azerbaijani and Turkish already use Latin script, so romanization there is
 * diacritic folding. Russian uses an ISO-9-style Cyrillic transliteration,
 * where a single Cyrillic letter may expand to several Latin ones (Щ → SHCH);
 * that expansion is intentional and is what the letter values are computed
 * over.
 */

/**
 * Latin letters with diacritics, folded to their base letter.
 *
 * Note there is no entry for Turkish dotless `ı`: JavaScript's `toUpperCase()`
 * already maps it to plain `I` before this table is consulted. Dotted `İ`
 * (U+0130) does need an entry, because it uppercases to itself.
 */
const DIACRITIC_FOLDING: Record<string, string> = {
  Ç: 'C',
  Ə: 'E',
  Ğ: 'G',
  İ: 'I',
  Ö: 'O',
  Ş: 'S',
  Ü: 'U',
  Â: 'A',
  Î: 'I',
  Û: 'U',
};

/** Cyrillic to Latin, ISO-9 flavoured but spelled out so values stay intuitive. */
const CYRILLIC_TRANSLITERATION: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'E',
  Ж: 'ZH',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'KH',
  Ц: 'TS',
  Ч: 'CH',
  Ш: 'SH',
  Щ: 'SHCH',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'YU',
  Я: 'YA',
};

/** The Pythagorean letter-number table: A/J/S=1 … I/R=9. */
const LETTER_VALUES: Record<string, number> = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9,
};

const HARD_VOWELS: readonly string[] = ['A', 'E', 'I', 'O', 'U'];

/**
 * Uppercase a name and map every non-ASCII letter to its Latin equivalent.
 * Separators (spaces, hyphens, apostrophes) survive here and are stripped by
 * {@link nameLetters}, so callers that want to inspect word boundaries can.
 */
export function romanize(name: string): string {
  if (typeof name !== 'string') {
    throw new CalcEngineError('invalid_input', `name must be a string, got: ${typeof name}`);
  }

  let out = '';
  for (const char of name.toUpperCase()) {
    if (Object.prototype.hasOwnProperty.call(CYRILLIC_TRANSLITERATION, char)) {
      out += CYRILLIC_TRANSLITERATION[char];
    } else if (Object.prototype.hasOwnProperty.call(DIACRITIC_FOLDING, char)) {
      out += DIACRITIC_FOLDING[char];
    } else {
      out += char;
    }
  }
  return out;
}

/**
 * The scoreable letters of a name: romanized, uppercased, with everything that
 * is not A–Z removed. Spaces, hyphens, apostrophes and digits carry no value in
 * the Pythagorean system, so they are dropped rather than scored as zero.
 */
export function nameLetters(name: string): string[] {
  const letters = romanize(name)
    .split('')
    .filter((c) => c >= 'A' && c <= 'Z');

  if (letters.length === 0) {
    throw new CalcEngineError('invalid_input', `name contains no usable letters: ${name}`);
  }
  return letters;
}

/** The Pythagorean value of a single romanized letter. */
export function letterValue(letter: string): number {
  const value = LETTER_VALUES[letter];
  if (value === undefined) {
    throw new CalcEngineError('invalid_input', `not a Latin letter A-Z: ${letter}`);
  }
  return value;
}

export interface VowelSplit {
  vowels: string[];
  consonants: string[];
}

/**
 * Partition a name's letters into vowels (Soul Urge) and consonants
 * (Personality).
 *
 * A, E, I, O and U are always vowels. **Y is a vowel only when neither
 * neighbour is a hard vowel** — so it is the vowel sound in KYLIE, but the
 * consonant glide in AYLA and YUSIF. Sources disagree on Y, and the
 * syllable-based rule cannot be applied without a pronunciation dictionary;
 * this adjacency rule is deterministic, language-independent, and testable,
 * which matters more here than matching any one school.
 */
export function splitVowelsAndConsonants(letters: string[]): VowelSplit {
  const vowels: string[] = [];
  const consonants: string[] = [];

  letters.forEach((letter, i) => {
    if (HARD_VOWELS.includes(letter)) {
      vowels.push(letter);
      return;
    }
    if (letter === 'Y') {
      const prev = letters[i - 1];
      const next = letters[i + 1];
      const touchesVowel =
        (prev !== undefined && HARD_VOWELS.includes(prev)) ||
        (next !== undefined && HARD_VOWELS.includes(next));
      (touchesVowel ? consonants : vowels).push(letter);
      return;
    }
    consonants.push(letter);
  });

  return { vowels, consonants };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/alphabet.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run lint (the letter table uses a compact multi-key-per-line layout Prettier will reformat)**

```bash
npm run format
npm run lint
```

Expected: no errors. Commit whatever Prettier rewrites.

- [ ] **Step 6: Commit**

```bash
git add packages/calc-engine/src/numerology/alphabet.ts packages/calc-engine/src/numerology/alphabet.test.ts
git commit -m "feat(calc-engine): AZ/TR/RU romanization and Pythagorean letter values (#59)"
```

---

### Task 5: Core four — Life Path, Expression, Soul Urge, Personality (#60)

**Files:**
- Create: `packages/calc-engine/src/numerology/coreNumbers.ts`
- Create: `packages/calc-engine/src/numerology/coreNumbers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/calc-engine/src/numerology/coreNumbers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import {
  expressionNumber,
  lifePathNumber,
  personalityNumber,
  soulUrgeNumber,
} from './coreNumbers';

describe('lifePathNumber', () => {
  it('reduces month, day and year separately, then sums', () => {
    // 1990-03-07: month 3, day 7, year 1990 -> 1+9+9+0=19 -> 10 -> 1.
    // 3 + 7 + 1 = 11 -> master, preserved.
    expect(lifePathNumber('1990-03-07')).toEqual({
      value: 11,
      isMaster: true,
      karmicDebt: null,
    });
  });

  it('differs from whole-date digit summing in master cases', () => {
    // Summing all digits of 1990-03-07 gives 1+9+9+0+0+3+0+7 = 29 -> 11 too,
    // but 1969-12-31 separates them: month 12->3, day 31->4, year 1969->7,
    // total 14 -> 5 with karmic debt 14. Whole-date summing gives
    // 1+9+6+9+1+2+3+1 = 32 -> 5 with NO debt recorded. The debt is the tell.
    expect(lifePathNumber('1969-12-31')).toEqual({
      value: 5,
      isMaster: false,
      karmicDebt: 14,
    });
  });

  it('reduces to a plain single digit when no master or debt is involved', () => {
    // 2000-01-02: 1 + 2 + 2 = 5.
    expect(lifePathNumber('2000-01-02')).toEqual({
      value: 5,
      isMaster: false,
      karmicDebt: null,
    });
  });

  it('rejects a malformed date', () => {
    expect(() => lifePathNumber('07.03.1990')).toThrow(CalcEngineError);
  });
});

describe('expressionNumber', () => {
  it('values every letter of the full name', () => {
    // JOHN SMITH -> J1 O6 H8 N5 = 20, S1 M4 I9 T2 H8 = 24, total 44 -> 8.
    expect(expressionNumber('John Smith')).toEqual({
      value: 8,
      isMaster: false,
      karmicDebt: null,
    });
  });

  it('is unaffected by case, spacing and punctuation', () => {
    expect(expressionNumber("john  smith")).toEqual(expressionNumber('JOHN SMITH'));
  });

  it('gives an Azerbaijani name the same value as its romanization', () => {
    expect(expressionNumber('Çingiz')).toEqual(expressionNumber('Cingiz'));
  });

  it('rejects a name with no letters', () => {
    expect(() => expressionNumber('  ')).toThrow(CalcEngineError);
  });
});

describe('soulUrgeNumber', () => {
  it('values only the vowels', () => {
    // JOHN SMITH vowels: O6 I9 = 15 -> 6.
    expect(soulUrgeNumber('John Smith')).toEqual({
      value: 6,
      isMaster: false,
      karmicDebt: null,
    });
  });
});

describe('personalityNumber', () => {
  it('values only the consonants', () => {
    // JOHN SMITH consonants: J1 H8 N5 S1 M4 T2 H8 = 29 -> 11, master.
    expect(personalityNumber('John Smith')).toEqual({
      value: 11,
      isMaster: true,
      karmicDebt: null,
    });
  });
});

describe('core four consistency', () => {
  it('soul urge and personality raw sums add up to the expression raw sum', () => {
    // Not an identity of the reduced values - reduction is lossy - but the
    // underlying letter sums must partition, which is what catches a
    // vowel/consonant classification bug.
    const name = 'Mehriban Yaqubova';
    const { vowelSum, consonantSum, letterSum } = expressionNumber(name, { withSums: true });
    expect(vowelSum + consonantSum).toBe(letterSum);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/coreNumbers.test.ts`
Expected: FAIL — cannot resolve `./coreNumbers`.

- [ ] **Step 3: Write the implementation**

Create `packages/calc-engine/src/numerology/coreNumbers.ts`:

```ts
import { parseIsoDate } from '../date-parsing';
import { letterValue, nameLetters, splitVowelsAndConsonants } from './alphabet';
import { reduceNumber } from './reduce';
import type { NumerologyNumber } from './types';

/**
 * The four numbers every numerology reading starts from: one from the birth
 * date, three from the birth name.
 */

/** Sum the Pythagorean values of a list of romanized letters. */
function sumLetters(letters: string[]): number {
  return letters.reduce((total, letter) => total + letterValue(letter), 0);
}

/**
 * Life Path — the birth date's number.
 *
 * Month, day and year are each reduced **separately** before being summed.
 * The alternative (digit-summing the whole date at once) yields the same
 * answer most of the time but silently loses master numbers and karmic debt
 * that only appear at the component level, so the two are not interchangeable.
 * See the test suite for a date where they diverge.
 */
export function lifePathNumber(birthDate: string): NumerologyNumber {
  const { year, month, day } = parseIsoDate(birthDate);

  const reducedMonth = reduceNumber(month).value;
  const reducedDay = reduceNumber(day).value;
  const reducedYear = reduceNumber(year).value;

  return reduceNumber(reducedMonth + reducedDay + reducedYear);
}

export interface ExpressionSums {
  /** Sum over every letter. */
  letterSum: number;
  /** Sum over the vowels only. */
  vowelSum: number;
  /** Sum over the consonants only. */
  consonantSum: number;
}

/**
 * Expression (Destiny) — every letter of the full birth name.
 *
 * Pass `{ withSums: true }` to get the raw letter sums alongside the reduced
 * number; the assembly step uses them so the name is only parsed once.
 */
export function expressionNumber(fullName: string): NumerologyNumber;
export function expressionNumber(
  fullName: string,
  options: { withSums: true },
): NumerologyNumber & ExpressionSums;
export function expressionNumber(
  fullName: string,
  options: { withSums?: boolean } = {},
): NumerologyNumber | (NumerologyNumber & ExpressionSums) {
  const letters = nameLetters(fullName);
  const { vowels, consonants } = splitVowelsAndConsonants(letters);

  const letterSum = sumLetters(letters);
  const reduced = reduceNumber(letterSum);

  if (!options.withSums) return reduced;

  return {
    ...reduced,
    letterSum,
    vowelSum: sumLetters(vowels),
    consonantSum: sumLetters(consonants),
  };
}

/** Soul Urge (Heart's Desire) — the vowels of the full birth name. */
export function soulUrgeNumber(fullName: string): NumerologyNumber {
  const { vowels } = splitVowelsAndConsonants(nameLetters(fullName));
  return reduceNumber(sumLetters(vowels));
}

/** Personality — the consonants of the full birth name. */
export function personalityNumber(fullName: string): NumerologyNumber {
  const { consonants } = splitVowelsAndConsonants(nameLetters(fullName));
  return reduceNumber(sumLetters(consonants));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/coreNumbers.test.ts`
Expected: PASS.

If any hand-computed expectation in the test disagrees with the implementation, **recompute by hand before changing either** — a wrong expectation and a wrong implementation look identical from the test output. Write the letter-by-letter arithmetic in the failure message or a scratch comment to confirm which side is wrong.

- [ ] **Step 5: Commit**

```bash
git add packages/calc-engine/src/numerology/coreNumbers.ts packages/calc-engine/src/numerology/coreNumbers.test.ts
git commit -m "feat(calc-engine): Life Path, Expression, Soul Urge and Personality (#60)"
```

---

### Task 6: Birthday, Maturity, Personal Year and Personal Month (#61)

**Files:**
- Create: `packages/calc-engine/src/numerology/cycleNumbers.ts`
- Create: `packages/calc-engine/src/numerology/cycleNumbers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/calc-engine/src/numerology/cycleNumbers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import {
  birthdayNumber,
  maturityNumber,
  personalMonthNumber,
  personalYearNumber,
} from './cycleNumbers';

describe('birthdayNumber', () => {
  it('is the day of the month, never reduced', () => {
    expect(birthdayNumber('1990-03-07')).toBe(7);
    expect(birthdayNumber('1990-03-29')).toBe(29);
    expect(birthdayNumber('1990-03-31')).toBe(31);
  });
});

describe('maturityNumber', () => {
  it('reduces the sum of Life Path and Expression', () => {
    // 11 + 8 = 19 -> 10 -> 1, with karmic debt 19 recorded.
    expect(maturityNumber({ value: 11 }, { value: 8 })).toEqual({
      value: 1,
      isMaster: false,
      karmicDebt: 19,
    });
  });

  it('can itself be a master number', () => {
    // 5 + 6 = 11.
    expect(maturityNumber({ value: 5 }, { value: 6 })).toEqual({
      value: 11,
      isMaster: true,
      karmicDebt: null,
    });
  });
});

describe('personalYearNumber', () => {
  it('sums the birth month, birth day and the reference year', () => {
    // Birth 1990-03-07, reference 2026: 3 + 7 + (2+0+2+6=10 -> 1) = 11 -> 2.
    // Personal Year is a cycle position, so masters are reduced away.
    expect(personalYearNumber('1990-03-07', '2026-07-20')).toBe(2);
  });

  it('changes with the reference year', () => {
    expect(personalYearNumber('1990-03-07', '2027-01-01')).not.toBe(
      personalYearNumber('1990-03-07', '2026-07-20'),
    );
  });

  it('rejects a malformed reference date', () => {
    expect(() => personalYearNumber('1990-03-07', 'July 2026')).toThrow(CalcEngineError);
  });
});

describe('personalMonthNumber', () => {
  it('adds the reference month to the personal year', () => {
    // Personal Year 2 + month 7 = 9.
    expect(personalMonthNumber('1990-03-07', '2026-07-20')).toBe(9);
  });

  it('wraps around the calendar rather than exceeding 9', () => {
    for (let month = 1; month <= 12; month++) {
      const ref = `2026-${String(month).padStart(2, '0')}-15`;
      const value = personalMonthNumber('1990-03-07', ref);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(9);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/cycleNumbers.test.ts`
Expected: FAIL — cannot resolve `./cycleNumbers`.

- [ ] **Step 3: Write the implementation**

Create `packages/calc-engine/src/numerology/cycleNumbers.ts`:

```ts
import { parseIsoDate } from '../date-parsing';
import { reduceNumber, toSingleDigit } from './reduce';
import type { NumerologyNumber } from './types';

/**
 * Numbers beyond the core four: one more fixed number from the birth date, one
 * derived from the core four, and the two that move with the calendar.
 *
 * Personal Year and Personal Month depend on "now", which would make them the
 * only impure functions in the domain. They take the reference date as an
 * **explicit required parameter** instead — so they stay pure and testable, and
 * the caller decides which timezone "today" is read in. The backend passes the
 * user's local date; a test passes a fixed one.
 */

/** Birthday — the day of the month, deliberately left unreduced (1–31). */
export function birthdayNumber(birthDate: string): number {
  return parseIsoDate(birthDate).day;
}

/** Maturity — Life Path plus Expression, reduced. */
export function maturityNumber(
  lifePath: Pick<NumerologyNumber, 'value'>,
  expression: Pick<NumerologyNumber, 'value'>,
): NumerologyNumber {
  return reduceNumber(lifePath.value + expression.value);
}

/**
 * Personal Year — birth month + birth day + the reference year.
 *
 * Returns a plain 1–9 digit rather than a {@link NumerologyNumber}: a cycle
 * position is a slot in a repeating nine-year rhythm, so a master number there
 * would have nowhere to point. Masters are reduced away.
 */
export function personalYearNumber(birthDate: string, referenceDate: string): number {
  const birth = parseIsoDate(birthDate);
  const reference = parseIsoDate(referenceDate);

  const sum =
    toSingleDigit(birth.month) + toSingleDigit(birth.day) + toSingleDigit(reference.year);
  return toSingleDigit(sum);
}

/** Personal Month — the Personal Year plus the reference month. */
export function personalMonthNumber(birthDate: string, referenceDate: string): number {
  const reference = parseIsoDate(referenceDate);
  const year = personalYearNumber(birthDate, referenceDate);
  return toSingleDigit(year + toSingleDigit(reference.month));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/cycleNumbers.test.ts`
Expected: PASS.

Note: `toSingleDigit` can return 0 only when its input is 0, which cannot happen here — month, day and year are all ≥ 1 and reduce to ≥ 1. The wrap-around test asserts this.

- [ ] **Step 5: Commit**

```bash
git add packages/calc-engine/src/numerology/cycleNumbers.ts packages/calc-engine/src/numerology/cycleNumbers.test.ts
git commit -m "feat(calc-engine): Birthday, Maturity and the personal cycle numbers (#61)"
```

---

### Task 7: Pinnacles and Challenges (#62)

**Files:**
- Create: `packages/calc-engine/src/numerology/periods.ts`
- Create: `packages/calc-engine/src/numerology/periods.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/calc-engine/src/numerology/periods.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { challenges, currentPeriodIndex, pinnacles } from './periods';

describe('pinnacles', () => {
  const result = pinnacles('1990-03-07');

  it('returns four periods, indexed 1-4', () => {
    expect(result.map((p) => p.index)).toEqual([1, 2, 3, 4]);
  });

  it('derives the values from the reduced birth components', () => {
    // month 3, day 7, year 1990 -> 1.
    // P1 = 3+7 = 10 -> 1;  P2 = 7+1 = 8;  P3 = P1+P2 = 9;  P4 = 3+1 = 4.
    expect(result.map((p) => p.number.value)).toEqual([1, 8, 9, 4]);
  });

  it('ends the first pinnacle at 36 minus the single-digit Life Path', () => {
    // Life Path is master 11, which collapses to 2 for the age maths: 36-2 = 34.
    expect(result[0]).toMatchObject({ startAge: 0, endAge: 34 });
  });

  it('runs the middle pinnacles for nine years each and leaves the last open', () => {
    expect(result[1]).toMatchObject({ startAge: 35, endAge: 43 });
    expect(result[2]).toMatchObject({ startAge: 44, endAge: 52 });
    expect(result[3]).toMatchObject({ startAge: 53, endAge: null });
  });

  it('covers every age with no gap and no overlap', () => {
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.startAge).toBe(result[i - 1]!.endAge! + 1);
    }
  });
});

describe('challenges', () => {
  const result = challenges('1990-03-07');

  it('returns four periods, indexed 1-4', () => {
    expect(result.map((c) => c.index)).toEqual([1, 2, 3, 4]);
  });

  it('uses absolute differences of the reduced birth components', () => {
    // month 3, day 7, year 1. C1=|3-7|=4; C2=|7-1|=6; C3=|4-6|=2; C4=|3-1|=2.
    expect(result.map((c) => c.value)).toEqual([4, 6, 2, 2]);
  });

  it('allows 0 as a genuine challenge value', () => {
    // 1991-05-05: month 5, day 5 -> C1 = 0.
    expect(challenges('1991-05-05')[0]!.value).toBe(0);
  });

  it('never exceeds 8', () => {
    for (const c of challenges('1999-09-09')) {
      expect(c.value).toBeGreaterThanOrEqual(0);
      expect(c.value).toBeLessThanOrEqual(8);
    }
  });
});

describe('currentPeriodIndex', () => {
  const periods = pinnacles('1990-03-07');

  it('picks the period containing the given age', () => {
    expect(currentPeriodIndex(periods, 10)).toBe(1);
    expect(currentPeriodIndex(periods, 34)).toBe(1);
    expect(currentPeriodIndex(periods, 35)).toBe(2);
    expect(currentPeriodIndex(periods, 99)).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/periods.test.ts`
Expected: FAIL — cannot resolve `./periods`.

- [ ] **Step 3: Write the implementation**

Create `packages/calc-engine/src/numerology/periods.ts`:

```ts
import { parseIsoDate } from '../date-parsing';
import { reduceNumber, toSingleDigit } from './reduce';
import type { NumerologyNumber } from './types';

/**
 * The two four-part life cycles: Pinnacles (what each period offers) and
 * Challenges (what it demands).
 *
 * Both report an **age range** alongside the value, not just the number. The
 * whole point of these blocks is knowing which period you are in right now, and
 * a bare list of four numbers cannot answer that.
 */

/** The length of every Pinnacle after the first, in years. */
const PINNACLE_SPAN = 9;

/** The first Pinnacle ends at this age minus the single-digit Life Path. */
const FIRST_PINNACLE_ANCHOR = 36;

export interface LifePeriod {
  /** 1–4, in chronological order. */
  index: 1 | 2 | 3 | 4;
  /** Age this period begins, inclusive. */
  startAge: number;
  /** Age this period ends, inclusive — `null` for the final, open-ended one. */
  endAge: number | null;
}

export interface Pinnacle extends LifePeriod {
  number: NumerologyNumber;
}

export interface Challenge extends LifePeriod {
  /** 0–8. Zero is a genuine Challenge value, not a missing one. */
  value: number;
}

/** The reduced single-digit birth components both cycles are built from. */
function birthComponents(birthDate: string): { month: number; day: number; year: number } {
  const { year, month, day } = parseIsoDate(birthDate);
  return {
    month: toSingleDigit(month),
    day: toSingleDigit(day),
    year: toSingleDigit(year),
  };
}

/**
 * The four Pinnacles with their age ranges.
 *
 * The first runs from birth to `36 − Life Path`, where the Life Path is
 * collapsed to a single digit even if it is a master number — the age maths has
 * no room for an 11.
 */
export function pinnacles(birthDate: string): Pinnacle[] {
  const { month, day, year } = birthComponents(birthDate);

  const first = reduceNumber(month + day);
  const second = reduceNumber(day + year);
  const third = reduceNumber(first.value + second.value);
  const fourth = reduceNumber(month + year);

  // `month`, `day` and `year` are already single digits here, so one more
  // collapse of their sum is all the age maths needs.
  const lifePathDigit = toSingleDigit(month + day + year);
  const firstEnd = FIRST_PINNACLE_ANCHOR - lifePathDigit;

  const numbers = [first, second, third, fourth];
  const bounds: [number, number | null][] = [
    [0, firstEnd],
    [firstEnd + 1, firstEnd + PINNACLE_SPAN],
    [firstEnd + PINNACLE_SPAN + 1, firstEnd + 2 * PINNACLE_SPAN],
    [firstEnd + 2 * PINNACLE_SPAN + 1, null],
  ];

  return numbers.map((number, i) => ({
    index: (i + 1) as 1 | 2 | 3 | 4,
    number,
    startAge: bounds[i]![0],
    endAge: bounds[i]![1],
  }));
}

/**
 * The four Challenges, sharing the Pinnacles' age ranges.
 *
 * Challenges are absolute differences, never reduced: the result is already
 * 0–8, and 0 carries its own meaning, so passing it through `reduceNumber`
 * would be both pointless and lossy.
 */
export function challenges(birthDate: string): Challenge[] {
  const { month, day, year } = birthComponents(birthDate);

  const first = Math.abs(month - day);
  const second = Math.abs(day - year);
  const third = Math.abs(first - second);
  const fourth = Math.abs(month - year);

  const values = [first, second, third, fourth];
  const ranges = pinnacles(birthDate);

  return values.map((value, i) => ({
    index: (i + 1) as 1 | 2 | 3 | 4,
    value,
    startAge: ranges[i]!.startAge,
    endAge: ranges[i]!.endAge,
  }));
}

/** Which period (1–4) a given age falls in. Ages past the last range return 4. */
export function currentPeriodIndex(periods: LifePeriod[], age: number): 1 | 2 | 3 | 4 {
  for (const period of periods) {
    if (age >= period.startAge && (period.endAge === null || age <= period.endAge)) {
      return period.index;
    }
  }
  return 4;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/periods.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc-engine/src/numerology/periods.ts packages/calc-engine/src/numerology/periods.test.ts
git commit -m "feat(calc-engine): Pinnacles and Challenges with age ranges (#62)"
```

---

### Task 8: `computeNumerologyProfile()` assembly (#63)

**Files:**
- Create: `packages/calc-engine/src/numerology/index.ts`
- Create: `packages/calc-engine/src/numerology/index.test.ts`
- Modify: `packages/calc-engine/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/calc-engine/src/numerology/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { computeNumerologyProfile, NUMEROLOGY_SCHEMA_VERSION } from './index';

const INPUT = {
  fullName: 'John Smith',
  birthDate: '1990-03-07',
  referenceDate: '2026-07-20',
};

describe('computeNumerologyProfile', () => {
  const profile = computeNumerologyProfile(INPUT);

  it('stamps the schema version', () => {
    expect(profile.schemaVersion).toBe(NUMEROLOGY_SCHEMA_VERSION);
  });

  it('composes every number the epic promises', () => {
    expect(profile.lifePath.value).toBe(11);
    expect(profile.expression.value).toBe(8);
    expect(profile.soulUrge.value).toBe(6);
    expect(profile.personality.value).toBe(11);
    expect(profile.birthday).toBe(7);
    expect(profile.maturity.value).toBe(1);
    expect(profile.personalYear).toBe(2);
    expect(profile.personalMonth).toBe(9);
    expect(profile.pinnacles).toHaveLength(4);
    expect(profile.challenges).toHaveLength(4);
  });

  it('marks which pinnacle and challenge period the person is in now', () => {
    // Born 1990-03-07, reference 2026-07-20 -> age 36 -> second period.
    expect(profile.currentAge).toBe(36);
    expect(profile.currentPinnacle).toBe(2);
    expect(profile.currentChallenge).toBe(2);
  });

  it('handles a birthday that has not yet occurred in the reference year', () => {
    const before = computeNumerologyProfile({ ...INPUT, referenceDate: '2026-01-05' });
    expect(before.currentAge).toBe(35);
  });

  it('is JSON-serialisable with no loss', () => {
    expect(JSON.parse(JSON.stringify(profile))).toEqual(profile);
  });

  it('rejects invalid input with CalcEngineError', () => {
    expect(() => computeNumerologyProfile({ ...INPUT, birthDate: 'nope' })).toThrow(
      CalcEngineError,
    );
    expect(() => computeNumerologyProfile({ ...INPUT, fullName: '' })).toThrow(CalcEngineError);
    expect(() => computeNumerologyProfile({ ...INPUT, referenceDate: '1980-01-01' })).toThrow(
      CalcEngineError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the implementation**

Create `packages/calc-engine/src/numerology/index.ts`:

```ts
import { CalcEngineError } from '../errors';
import { parseIsoDate } from '../date-parsing';
import {
  expressionNumber,
  lifePathNumber,
  personalityNumber,
  soulUrgeNumber,
} from './coreNumbers';
import {
  birthdayNumber,
  maturityNumber,
  personalMonthNumber,
  personalYearNumber,
} from './cycleNumbers';
import { challenges, currentPeriodIndex, pinnacles, type Challenge, type Pinnacle } from './periods';
import type { NumerologyNumber } from './types';

/**
 * Numerology assembly: the single, platform-independent function that turns a
 * name and a birth date into a full profile.
 *
 * Mirrors `computeNatalChart()` — one composition point, plain JSON out, no
 * Node built-ins, so the backend and the device compute identical results.
 *
 * Deliberately *not* included here: interpretation / reading text. That is
 * Pro-only data that stays behind the backend (spec §5.1), so it is never part
 * of the on-device calculation.
 */

/** Version of the {@link NumerologyProfile} shape, bumped on any breaking change. */
export const NUMEROLOGY_SCHEMA_VERSION = 1;

export interface NumerologyInput {
  /** Full birth name. Romanized internally, so any supported alphabet works. */
  fullName: string;
  /** Civil birth date, `YYYY-MM-DD`. */
  birthDate: string;
  /**
   * The date the cycle numbers and the current-period markers are computed
   * for, `YYYY-MM-DD`. Required rather than defaulted to "today" so this
   * function stays pure and the caller controls the timezone.
   */
  referenceDate: string;
}

export interface NumerologyProfile {
  schemaVersion: number;
  lifePath: NumerologyNumber;
  expression: NumerologyNumber;
  soulUrge: NumerologyNumber;
  personality: NumerologyNumber;
  /** Day of the month, 1–31, unreduced. */
  birthday: number;
  maturity: NumerologyNumber;
  /** Cycle position, 1–9. */
  personalYear: number;
  /** Cycle position, 1–9. */
  personalMonth: number;
  pinnacles: Pinnacle[];
  challenges: Challenge[];
  /** Whole years old on {@link NumerologyInput.referenceDate}. */
  currentAge: number;
  /** Which Pinnacle (1–4) {@link currentAge} falls in. */
  currentPinnacle: 1 | 2 | 3 | 4;
  /** Which Challenge (1–4) {@link currentAge} falls in. */
  currentChallenge: 1 | 2 | 3 | 4;
}

/** Whole years between two calendar dates, birthday-aware. */
function yearsBetween(from: string, to: string): number {
  const birth = parseIsoDate(from);
  const reference = parseIsoDate(to);

  let age = reference.year - birth.year;
  const hadBirthday =
    reference.month > birth.month ||
    (reference.month === birth.month && reference.day >= birth.day);
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * Compute a complete numerology profile.
 *
 * @throws {CalcEngineError} `invalid_input` for a malformed date, a name with
 *   no scoreable letters, or a reference date before the birth date.
 */
export function computeNumerologyProfile(input: NumerologyInput): NumerologyProfile {
  const currentAge = yearsBetween(input.birthDate, input.referenceDate);
  if (currentAge < 0) {
    throw new CalcEngineError(
      'invalid_input',
      `referenceDate (${input.referenceDate}) is before birthDate (${input.birthDate})`,
    );
  }

  const lifePath = lifePathNumber(input.birthDate);
  const expression = expressionNumber(input.fullName);
  const soulUrge = soulUrgeNumber(input.fullName);
  const personality = personalityNumber(input.fullName);

  const pinnacleList = pinnacles(input.birthDate);
  const challengeList = challenges(input.birthDate);

  return {
    schemaVersion: NUMEROLOGY_SCHEMA_VERSION,
    lifePath,
    expression,
    soulUrge,
    personality,
    birthday: birthdayNumber(input.birthDate),
    maturity: maturityNumber(lifePath, expression),
    personalYear: personalYearNumber(input.birthDate, input.referenceDate),
    personalMonth: personalMonthNumber(input.birthDate, input.referenceDate),
    pinnacles: pinnacleList,
    challenges: challengeList,
    currentAge,
    currentPinnacle: currentPeriodIndex(pinnacleList, currentAge),
    currentChallenge: currentPeriodIndex(challengeList, currentAge),
  };
}

export type { NumerologyNumber } from './types';
export type { Pinnacle, Challenge, LifePeriod } from './periods';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Export from the package entry point**

Append to `packages/calc-engine/src/index.ts`:

```ts
export {
  computeNumerologyProfile,
  NUMEROLOGY_SCHEMA_VERSION,
  type NumerologyInput,
  type NumerologyProfile,
  type NumerologyNumber,
  type Pinnacle,
  type Challenge,
  type LifePeriod,
} from './numerology';
```

- [ ] **Step 6: Verify the package builds and the export is reachable**

```bash
npm run typecheck -w @astrocalc/calc-engine
npm run build -w @astrocalc/calc-engine
```

Expected: both clean. The build matters — `apps/backend` imports the compiled `dist/`.

- [ ] **Step 7: Commit**

```bash
git add packages/calc-engine/src/numerology/index.ts packages/calc-engine/src/numerology/index.test.ts packages/calc-engine/src/index.ts
git commit -m "feat(calc-engine): computeNumerologyProfile() assembly (#63)"
```

---

### Task 9: Cross-validation fixtures (#63)

**Files:**
- Create: `packages/calc-engine/src/__fixtures__/reference-numerology.ts`
- Create: `packages/calc-engine/src/numerology/reference-numerology.test.ts`

The unit tests above verify each function against its own formula. This suite verifies the *whole profile* against independently hand-computed cases — the numerology equivalent of `reference-charts.test.ts`.

- [ ] **Step 1: Write the fixtures**

Create `packages/calc-engine/src/__fixtures__/reference-numerology.ts`:

```ts
import type { NumerologyInput } from '../numerology';

/**
 * Hand-verified numerology profiles, used to cross-check the assembled result
 * rather than any single formula.
 *
 * Each case was computed by hand from the documented rules — separate-component
 * Life Path reduction, master numbers preserved, karmic debt recorded, the
 * adjacency rule for Y — and the working is shown so a future reader can
 * re-derive it instead of trusting the number. A disagreement here is a real
 * bug, not a fixture to be updated until it passes.
 */
export interface ReferenceNumerologyCase {
  label: string;
  input: NumerologyInput;
  /** How the expected values were derived, for anyone re-checking them. */
  working: string;
  expected: {
    lifePath: number;
    lifePathIsMaster: boolean;
    lifePathKarmicDebt: number | null;
    expression: number;
    soulUrge: number;
    personality: number;
    birthday: number;
    maturity: number;
    personalYear: number;
    personalMonth: number;
    pinnacleValues: number[];
    challengeValues: number[];
  };
}

export const REFERENCE_NUMEROLOGY_CASES: ReferenceNumerologyCase[] = [
  {
    label: 'master Life Path, Latin name',
    input: { fullName: 'John Smith', birthDate: '1990-03-07', referenceDate: '2026-07-20' },
    working: [
      'Life Path: month 3, day 7, year 1990->19->10->1; 3+7+1 = 11 (master).',
      'Expression: JOHN = 1+6+8+5 = 20; SMITH = 1+4+9+2+8 = 24; 44 -> 8.',
      'Soul Urge: vowels O,I = 6+9 = 15 -> 6.',
      'Personality: consonants J,H,N,S,M,T,H = 1+8+5+1+4+2+8 = 29 -> 11 (master).',
      'Maturity: 11 + 8 = 19 -> 10 -> 1, karmic debt 19.',
      'Personal Year: 3 + 7 + (2026->10->1) = 11 -> 2.',
      'Personal Month: 2 + 7 = 9.',
      'Pinnacles: 3+7=10->1; 7+1=8; 1+8=9; 3+1=4.',
      'Challenges: |3-7|=4; |7-1|=6; |4-6|=2; |3-1|=2.',
    ].join(' '),
    expected: {
      lifePath: 11,
      lifePathIsMaster: true,
      lifePathKarmicDebt: null,
      expression: 8,
      soulUrge: 6,
      personality: 11,
      birthday: 7,
      maturity: 1,
      personalYear: 2,
      personalMonth: 9,
      pinnacleValues: [1, 8, 9, 4],
      challengeValues: [4, 6, 2, 2],
    },
  },
  {
    label: 'karmic-debt Life Path, Azerbaijani name',
    input: { fullName: 'Çingiz Əliyev', birthDate: '1969-12-31', referenceDate: '2026-07-20' },
    working: [
      'Romanized: CINGIZ ELIYEV.',
      'Life Path: month 12->3, day 31->4, year 1969->25->7; 3+4+7 = 14 -> 5, debt 14.',
      'Expression: CINGIZ = 3+9+5+7+9+8 = 41; ELIYEV = 5+3+9+7+5+4 = 33; 74 -> 11 (master).',
      'Soul Urge: Y in ELIYEV sits between I and E, both vowels, so it is a consonant.',
      '  Vowels I,I,E,I,E = 9+9+5+9+5 = 37 -> 10 -> 1.',
      'Personality: consonants C,N,G,Z,L,Y,V = 3+5+7+8+3+7+4 = 37 -> 10 -> 1.',
      'Maturity: 5 + 11 = 16 -> 7, karmic debt 16.',
      'Personal Year: 12->3, 31->4, 2026->1; 3+4+1 = 8.',
      'Personal Month: 8 + 7 = 15 -> 6.',
      'Pinnacles: 3+4=7; 4+7=11; 7+11=18->9; 3+7=10->1.',
      'Challenges: |3-4|=1; |4-7|=3; |1-3|=2; |3-7|=4.',
    ].join(' '),
    expected: {
      lifePath: 5,
      lifePathIsMaster: false,
      lifePathKarmicDebt: 14,
      expression: 11,
      soulUrge: 1,
      personality: 1,
      birthday: 31,
      maturity: 7,
      personalYear: 8,
      personalMonth: 6,
      pinnacleValues: [7, 11, 9, 1],
      challengeValues: [1, 3, 2, 4],
    },
  },
  {
    label: 'Cyrillic name, zero Challenge',
    input: { fullName: 'Иван Иванов', birthDate: '1991-05-05', referenceDate: '2026-07-20' },
    working: [
      'Romanized: IVAN IVANOV.',
      'Life Path: month 5, day 5, year 1991->20->2; 5+5+2 = 12 -> 3.',
      'Expression: IVAN = 9+4+1+5 = 19; IVANOV = 9+4+1+5+6+4 = 29; 48 -> 12 -> 3.',
      'Soul Urge: vowels I,A,I,A,O = 9+1+9+1+6 = 26 -> 8.',
      'Personality: consonants V,N,V,N,V = 4+5+4+5+4 = 22 (master).',
      'Maturity: 3 + 3 = 6.',
      'Personal Year: 5 + 5 + 1 = 11 -> 2.',
      'Personal Month: 2 + 7 = 9.',
      'Pinnacles: 5+5=10->1; 5+2=7; 1+7=8; 5+2=7.',
      'Challenges: |5-5|=0; |5-2|=3; |0-3|=3; |5-2|=3.',
    ].join(' '),
    expected: {
      lifePath: 3,
      lifePathIsMaster: false,
      lifePathKarmicDebt: null,
      expression: 3,
      soulUrge: 8,
      personality: 22,
      birthday: 5,
      maturity: 6,
      personalYear: 2,
      personalMonth: 9,
      pinnacleValues: [1, 7, 8, 7],
      challengeValues: [0, 3, 3, 3],
    },
  },
];
```

- [ ] **Step 2: Write the cross-validation suite**

Create `packages/calc-engine/src/numerology/reference-numerology.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REFERENCE_NUMEROLOGY_CASES } from '../__fixtures__/reference-numerology';
import { computeNumerologyProfile } from './index';

describe('numerology cross-validation', () => {
  for (const testCase of REFERENCE_NUMEROLOGY_CASES) {
    describe(testCase.label, () => {
      const profile = computeNumerologyProfile(testCase.input);
      const { expected } = testCase;

      it('matches the hand-computed core four', () => {
        expect(profile.lifePath.value).toBe(expected.lifePath);
        expect(profile.lifePath.isMaster).toBe(expected.lifePathIsMaster);
        expect(profile.lifePath.karmicDebt).toBe(expected.lifePathKarmicDebt);
        expect(profile.expression.value).toBe(expected.expression);
        expect(profile.soulUrge.value).toBe(expected.soulUrge);
        expect(profile.personality.value).toBe(expected.personality);
      });

      it('matches the hand-computed extended and cycle numbers', () => {
        expect(profile.birthday).toBe(expected.birthday);
        expect(profile.maturity.value).toBe(expected.maturity);
        expect(profile.personalYear).toBe(expected.personalYear);
        expect(profile.personalMonth).toBe(expected.personalMonth);
      });

      it('matches the hand-computed pinnacles and challenges', () => {
        expect(profile.pinnacles.map((p) => p.number.value)).toEqual(expected.pinnacleValues);
        expect(profile.challenges.map((c) => c.value)).toEqual(expected.challengeValues);
      });
    });
  }
});
```

- [ ] **Step 3: Run the suite**

Run: `npm test -w @astrocalc/calc-engine -- src/numerology/reference-numerology.test.ts`
Expected: PASS.

**If a case fails, do not edit the fixture to match the code.** Re-derive that case by hand from the `working` string. Only after confirming the hand computation is wrong should the fixture change — and then the `working` text must be corrected too, not just the number.

- [ ] **Step 4: Run everything, lint, and commit**

```bash
npm test -w @astrocalc/calc-engine
npm test -w @astrocalc/backend
npm run format
npm run lint
git add packages/calc-engine/src/__fixtures__/reference-numerology.ts packages/calc-engine/src/numerology/reference-numerology.test.ts
git commit -m "test(calc-engine): cross-validate numerology profiles against hand-computed cases (#63)"
```

---

### Task 10: Open the pull request

- [ ] **Step 1: Verify the whole repo is green**

```bash
npm test -w @astrocalc/calc-engine
npm test -w @astrocalc/backend
npm run lint
npm run format:check
npm run typecheck -w @astrocalc/calc-engine
```

All five must pass before opening the PR.

- [ ] **Step 2: Push and open the PR**

The branch should already be `feat/57-numerology-calc-engine`, created from an up-to-date `main`.

Write this PR body to a scratch file first (heredocs and `gh` argument quoting
fight each other on Windows PowerShell — use `--body-file`):

```markdown
Closes #58, #59, #60, #61, #62, #63.

## What this adds

The complete numerology calculation domain in `@astrocalc/calc-engine` — pure,
React-Native-safe, no Node built-ins, so the backend and the device compute
identical results.

- `computeNumerologyProfile()` + `NUMEROLOGY_SCHEMA_VERSION`, mirroring
  `computeNatalChart()`.
- Life Path, Expression, Soul Urge, Personality, Birthday, Maturity,
  Personal Year/Month, four Pinnacles and four Challenges — each with the
  master-number and karmic-debt facts a reading needs, not just a reduced digit.
- AZ/TR/RU romanization so a name scores the same regardless of display
  language, and a documented adjacency rule for when Y counts as a vowel.
- Three hand-computed cross-validation cases with their working recorded, so a
  disagreement is investigated rather than papered over.

## What this deliberately does NOT add

- **No backend route and no screen** — those are #64–#66, a separate plan.
- **No interpretation text.** Every number computes; nothing explains it yet.
  That is epic #76.
- **`listNumerologySubjects()` is not merged into `listInterpretationSubjects()`.**
  The latter drives `seedContent.test.ts` and the admin completeness check;
  adding 189 keys with no content behind them would fail that test immediately.
  Merging is #82.

## Testing

`npm test -w @astrocalc/calc-engine`, `npm test -w @astrocalc/backend`,
`npm run lint`, `npm run format:check` and
`npm run typecheck -w @astrocalc/calc-engine` all pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Then:

```bash
git push -u origin feat/57-numerology-calc-engine
gh pr create --base main \
  --title "feat(calc-engine): numerology calculation domain (#57)" \
  --body-file <the scratch file written above> \
  --label calc-engine --label enhancement --label i18n --label p1
```

Labels are mandatory per `CLAUDE.md` — carry over the source issues' labels.

- [ ] **Step 3: Update `BACKLOG.md`**

Add an entry at the top of the current date's section describing what shipped and what deliberately did not (no backend route, no screen, no interpretation content yet). Commit and push it to the same branch.

---

## Self-review notes

**Spec coverage:** #58 → Task 1; #59 → Task 4; #60 → Tasks 3 and 5; #61 → Task 6; #62 → Task 7; #63 → Tasks 8 and 9. Task 2 is a supporting refactor. Tasks #64–#66 (backend and mobile) are explicitly a separate plan and are not covered here.

**Known follow-ups this plan deliberately leaves open:**
- `listNumerologySubjects()` is not merged into `listInterpretationSubjects()` — that is #82, and merging it early would break the backend seed-parity test.
- The `matrix` interpretation category is added to the union in Task 1 but has no subject-key builder yet; that arrives with the Matrix epic (#67).
- No interpretation text is written. Every number computes; nothing explains it until epic #76.
