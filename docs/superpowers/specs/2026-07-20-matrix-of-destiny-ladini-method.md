# Spec 4 — The Ladini Matrix of Destiny, as an implementable method

Date: 2026-07-20
Status: approved (research)
Scope: methodology only — this document defines "correct" for the calc-engine
Issues: #68 (this doc), #67 (epic), #69–#72 (the implementation it gates)

## Why this document exists

The Matrix of Destiny has no canonical published standard. Natalia Ladini's
school is the most widely implemented, which is what makes the README's
"cross-validated against reference calculators" claim achievable at all — but
her own material is not on the open web in a form that states the arithmetic.
Every formula below is therefore **reconstructed** from secondary sources and,
more importantly, from working implementations, then checked against calculators
that were actually driven and read.

Without this document there is no definition of "correct" to test against, which
is why #68 gates every other issue in the epic.

### What the evidence actually is

Three classes, in ascending order of trust:

1. **Prose articles.** Numerous, mutually copied, and frequently self-inconsistent
   (§7 lists the ones that contradict themselves). Useful for names, weak for
   arithmetic.
2. **Independent open-source implementations.** Three were read in full:
   [samwega/Destiny-Matrix-Calculator-and-Tools](https://github.com/samwega/Destiny-Matrix-Calculator-and-Tools),
   [Alesia-15/DestinyMatrix](https://github.com/Alesia-15/DestinyMatrix), and
   [3gr1v750v/fate_matrix-web](https://github.com/3gr1v750v/fate_matrix-web)
   (Python). They use three incompatible letter schemes and agree on every
   formula in §2–§5 once normalised.
3. **Live calculators, driven and read.** [matrica-sudby.ru](https://matrica-sudby.ru/)
   and [beloesolnce.ru/matrix](https://beloesolnce.ru/matrix/) were run on
   discriminating birth dates and their rendered output recorded. This is what
   settled the reduction rule (§1), because the two candidate rules produce
   different answers for those dates.

Agreement *between independent implementations in different notations* is the
strongest evidence here, and it is what pins down the core square, the ancestral
square, the purposes and the chakra map. Where only prose supports a position, it
is marked as such.

## 1. The reduction rule — the one decision everything else rests on

```
reduceToArcana(n):    # n >= 1
    while n > 22:
        n = digitSum(n)
    return n
```

**22 is kept as 22.** It is never reduced further and never turned into 0. The
comparison is a strict `> 22`, so a birth day of 22 yields arcana 22.

### The fork, and why this branch

Two rules are in circulation for a sum above 22:

| Rule | 29 → | 52 → | Held by |
| --- | --- | --- | --- |
| **Repeated digit-summing** (adopted) | 11 | 7 | Both live calculators, all three code implementations, and the published worked examples |
| Subtracting 22 | 7 | 8 | [matrica.diffsight.ru](https://matrica.diffsight.ru/), [calculatorov.ru](https://calculatorov.ru/matrica-sudby-po-godam-rasschitat-onlayn-besplatno/) |

This is a **real** fork, not sloppy paraphrasing — the dissenting sites publish
worked examples that are internally consistent with subtraction and inconsistent
with digit-summing. The two rules agree only by coincidence, and a chart computed
under one is not a rounding difference from the other; it is a different chart.

Digit-summing is adopted because it is what every implementation does, what both
live calculators produce, and what reproduces every published worked example.
`human-design.space` names it as the classical Ladini rule explicitly.

**The subtract-22 rule is recorded, not supported.** Offering both would mean
shipping two incompatible answers with no principled basis for choosing between
them, and the app has committed to Ladini (#67).

### Two structural consequences worth knowing

- **0 is not in the codomain.** Digit-summing a positive integer yields a
  positive integer and the loop stops at 22, so the "is 22 really 0?" question
  several sources raise never arises. It *would* arise under subtract-22, where
  22 − 22 = 0 — one more reason that rule is not implemented. (Some sources
  describe arcana 22, the Fool, as a *conceptual* "karmic zero"; that is
  interpretive language about the Tarot card, and no source emits 0 as a value.)
- **The reduction can never output 19–22.** The largest raw sum anywhere in the
  Matrix is 88 (four arcana of 22), whose digit sum is 16; the largest digit sum
  of any two-digit number is 18. So arcana 19, 20, 21 and 22 appear **only** when
  the raw value was already ≤ 22 — never as the result of a reduction. This is a
  useful invariant to test against, and it is why a single-pass digit sum and a
  looped one are equivalent for every value the Matrix can reach. (This engine
  loops anyway; the equivalence is an accident of the input range, not a property
  worth relying on.)

### Birth day → arcana, exhaustively

Days 1–22 pass through unchanged. Above that:

| Day | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
| --- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Arcana | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 3 | 4 |

Note this is **not monotonic** — day 30 gives 3, which is lower than day 29's 11.
That is correct and confirmed live; a test asserting monotonicity would be
asserting a bug.

## 2. The core square (the four cardinal points, the centre)

```
A = reduceToArcana(day)                    LEFT   / West
B = reduceToArcana(month)                  TOP    / North     (1–12, never reduces)
C = reduceToArcana(digitSum(year))         RIGHT  / East      (1987 → 25 → 7)
D = reduceToArcana(A + B + C)              BOTTOM / South     ("karmic tail")
E = reduceToArcana(A + B + C + D)          CENTRE             ("comfort zone")
```

```
                    B  (month)
                    │
      A  (day) ──── E ──── C  (year)
                    │
                    D  (A+B+C)
```

**D and E are computed from the already-reduced A, B, C** — never from the raw
day/month/year. For 29.01.1987 that is D = 11 + 1 + 7 = 19, not 29 + 1 + 25.
Getting this wrong is the single most common way to produce a plausible-looking
wrong chart, and it is why the reference cases in §6 print the intermediate
values.

Likewise E is **not** `reduceToArcana(2 × (A+B+C))`, even though D = A+B+C before
reduction makes that look equivalent. It is not: D is reduced before it enters E.

Position names, for the interpretation content that will hang off them:
A — the personality portrait; B — talents / "higher essence"; C — ancestral and
material programmes; D — the karmic tail; E — the point of inner comfort.

## 3. The ancestral square (the four diagonal corners)

A terminology warning first, because the Russian sources name these the opposite
way round from how an English reader expects: «диагональный квадрат» (*diagonal*
square) is the **personal** square of §2, and «прямой квадрат» / «родовой
квадрат» (*straight* / *ancestral* square) is the one below, whose corners sit on
the figure's diagonals. This document uses compass directions throughout to
remove the ambiguity entirely.

```
NW = reduceToArcana(A + B)     top-left
NE = reduceToArcana(B + C)     top-right
SE = reduceToArcana(C + D)     bottom-right
SW = reduceToArcana(D + A)     bottom-left
```

Each corner is the sum of its two adjacent cardinal points. Unanimous across
every source and implementation.

### The lines

```
paternalLine = reduceToArcana(NW + SE)     the male/father line   (NW ↔ SE)
maternalLine = reduceToArcana(NE + SW)     the female/mother line (NE ↔ SW)
```

Unanimous. The top two corners are the *spiritual* half of each line and the
bottom two the *material* half — so NW is paternal-spiritual, SE
paternal-material, NE maternal-spiritual, SW maternal-material.

No source assigns the male line to the NE–SW diagonal, so this assignment is safe.

### The ancestral centre, and its one real divergence

```
ancestralCentre = reduceToArcana(NW + NE + SE + SW)          [adopted]
```

- **Adopted (all four corners):** `gadalkindom.ru`'s formula list, and all three
  code implementations.
- **Rejected (the two upper corners only):** `matrica-sudby.ru` and
  `matrica-sudbyy.ru` both state the ancestral centre is the sum of the *upper*
  corners. Their own published worked triples are arithmetically consistent only
  with the four-corner rule, so this reads as an error on those pages rather than
  a school. Recorded here so the next reader who finds those pages does not
  "fix" the implementation to match them.

A further point, defined by `gadalkindom.ru` and both JS implementations:

```
ancestralPersonal = reduceToArcana(E + ancestralCentre)
```

### The inner points (ancestral programmes)

Each corner carries a triple running outward → inward:

```
X2 = reduceToArcana(X  + ancestralCentre)     inner point, nearest the centre
X1 = reduceToArcana(X  + X2)                  middle point
```

for X in {NW, NE, SE, SW}. Verified numerically against three published triples
(22-6-11, 8-5-15, 18-7-7 with an ancestral centre of 7), all three of which
reproduce exactly.

## 4. The purposes

```
sky   = reduceToArcana(B + D)                        the vertical axis
earth = reduceToArcana(A + C)                        the horizontal axis

personal  = reduceToArcana(sky + earth)
social    = reduceToArcana(paternalLine + maternalLine)
spiritual = reduceToArcana(personal + social)
planetary = reduceToArcana(social + spiritual)
```

`sky` uses **D, the bottom vertex — not E, the centre.** Confirmed in all three
implementations.

Traditionally read as life stages: personal to ~40, social after 40, spiritual
after 60.

**`planetary` is the weakest-supported position in this document** — two sources,
one of them code. Two of the three implementations stop at `spiritual` and never
compute it. It is included because it is well-formed and consistently defined
where it *is* defined, but it is the first thing to suspect if a future
cross-check disagrees.

A useful sanity check from `gadalkindom.ru`: the values 1, 2 and 13 are
mathematically unreachable for `social`.

## 5. The secondary lines

### 5.1 Money and relationships — the same five arcana

This is the largest divergence in the whole method, and it is **not** a
disagreement about arithmetic. It is two schools reading the same five numbers as
two different things.

```
entry     = reduceToArcana(D + E)                    "d1"
partner   = reduceToArcana(C + E)                    "c1"
core      = reduceToArcana(entry + partner)          "x"
toEntry   = reduceToArcana(entry + core)             "x1"
toPartner = reduceToArcana(core + partner)           "x2"
```

read as the line `entry – toEntry – core – toPartner – partner`.

- `tvoyamatritsa.ru` and `numerolog.ru` call these the **money channel**.
- `gadalkindom.ru` defines `R = M + L`, `R1 = R + M`, `R2 = R + L` and calls them
  the **relationship programme**. Substituting M = D+E and L = C+E gives
  R = `core`, R1 = `toEntry`, R2 = `toPartner` — *the identical triple*.
- `beloesolnce.ru` splits the difference, saying these Svadhistana points govern
  "the money channel and our capacity to enter relationships" — both at once.

**Decision: compute them once and expose them once**, under a name that says so.
Shipping a `money` field and a `love` field holding identical numbers would
present one finding as two independent ones, and every reader comparing them
would conclude there was a bug. The interpretation content (#81) can write both
readings against the same keys.

An independent check that the inner-ring reading is the right one: since
E = 2 × (A+B+C) before reduction and digit-summing preserves value mod 9,
`D + E ≡ 3D (mod 9)`, so `entry` is always a multiple of 3 — exactly matching the
published claim that this point only ever takes the values {3,6,9,12,15,18,21}
and that "1 and 2 never occur there". The outer-ring candidate does not have this
property.

Some sources compute a relationship line from **two** partners' dates. That is a
compatibility artifact, a different feature, and out of scope here (#67 covers
one person's Matrix; synastry is explicitly out of scope in the roadmap spec).

### 5.2 The health map

Seven chakra rows × three columns. Column 1 is always a horizontal-axis (earth)
point, column 2 always a vertical-axis (sky) point, column 3 always their sum.

| Chakra | Physical | Energy |
| --- | --- | --- |
| Sahasrara | `A` | `B` |
| Ajna | `A + Vishuddha.physical` | `B + Vishuddha.energy` |
| Vishuddha | `A + E` | `B + E` |
| Anahata | `Vishuddha.physical + E` | `Vishuddha.energy + E` |
| Manipura | `E` | `E` |
| Svadhisthana | `C + E` | `D + E` |
| Muladhara | `C` | `D` |

with `emotional = reduceToArcana(physical + energy)` for every row, and every
cell reduced.

**Vishuddha must be computed and reduced before Ajna and Anahata**, which consume
it. Geometrically the rows are a recursive bisection of each axis arm: Vishuddha
is the midpoint of (outer, centre), Ajna the midpoint of (outer, Vishuddha),
Anahata the midpoint of (Vishuddha, centre).

This is the best-verified block in the document: two prose sources in unrelated
notations reproduce each other cell for cell, and the samwega implementation
matches both exactly.

Note that Svadhisthana's two cells are `C + E` and `D + E` — the same `partner`
and `entry` points as §5.1. That is not a coincidence; it is why that line is
described as sitting on the Svadhisthana row.

**Two divergences, both resolved against a single page:** `gadalkindom.ru`'s
*health-map* page places Svadhisthana one ring further out and writes Manipura as
a single value; its own *methodology* page contradicts both, and the code agrees
with the methodology page. Treated as an error on that one page.

**The summary ("Ключ") row is implemented as variant (a):** each of the three
columns summed across all seven chakras and reduced, so `emotional` is the
emotional column's total rather than `physical + energy` of the summary itself.

This was originally left out as undecidable, but the disagreement is narrower
than it first read. The two upper cells are a column sum in *every* source; only
the third cell has two candidates — (a) the emotional column summed, or (b)
`physical(summary) + energy(summary)`. Both reference *code* implementations use
(a) uniformly (every summary cell is `reduce(sum of its own column)`), and that
is what the live calculators run; (b) comes from a single prose source. So (a)
is adopted, with the stronger evidence and internal consistency.

Confirmed externally: for 1979-07-29 the computed summary is 14 / 12 / 8, which
is exactly what `beloesolnce.ru` and `gadalkindom.ru` print. (One caveat worth
recording: on *that* date (a) and (b) happen to agree, because
`reduce(14 + 12) = 8` equals the emotional column total by coincidence — so the
discriminating fixture is 1990-11-22, where (a) gives 16 and (b) would give 7.)

The one thing still **not** carried over is the single-pass digit-sum bug one
implementation has (`154 → 4 + 15 = 19` instead of `1+5+4 = 10`): this engine's
`reduceToArcana` loops, so its totals are correct where that implementation's are
not.

## 6. Worked reference cases

These become the fixtures in `packages/calc-engine/src/__fixtures__/reference-matrices.ts`.
Cases 1 and 2 were verified against two live calculators, cell by cell; all five
were verified against an independent reference implementation executed directly.

### Case 1 — 1990-11-22 (birth day of exactly 22)

```
day 22 → 22                       (kept, not reduced — the strict > 22 boundary)
month 11 → 11
year 1990 → 1+9+9+0 = 19          (≤ 22, so no further reduction)
D = 22 + 11 + 19 = 52 → 5+2 = 7
E = 22 + 11 + 19 + 7 = 59 → 5+9 = 14

NW = 22 + 11 = 33 → 6      NE = 11 + 19 = 30 → 3
SE = 19 + 7  = 26 → 8      SW = 7 + 22  = 29 → 11
ancestralCentre = 6 + 3 + 8 + 11 = 28 → 10

sky   = 11 + 7  = 18       earth = 22 + 19 = 41 → 5
personal = 18 + 5 = 23 → 5
paternalLine = 6 + 8 = 14  maternalLine = 3 + 11 = 14
social = 14 + 14 = 28 → 10
spiritual = 5 + 10 = 15
planetary = 10 + 15 = 25 → 7
```

### Case 2 — 1987-01-29 (day and year both reduce)

```
day 29 → 2+9 = 11
month 1 → 1
year 1987 → 1+9+8+7 = 25 → 2+5 = 7
D = 11 + 1 + 7 = 19
E = 11 + 1 + 7 + 19 = 38 → 3+8 = 11

NW = 12   NE = 8   SE = 8   SW = 30 → 3
sky = 1 + 19 = 20          earth = 11 + 7 = 18
```

Note `Vishuddha.physical` here is `A + E = 11 + 11 = 22` — arcana 22 arrived at
by a raw sum that is exactly 22, the other way it can occur.

### Case 3 — 1990-05-12 (nothing reduces; the plain case)

```
day 12 → 12, month 5 → 5, year 1990 → 19
D = 12 + 5 + 19 = 36 → 9
E = 12 + 5 + 19 + 9 = 45 → 9
```

### Case 4 — 2000-12-31 (day 31, a year with a small digit sum)

```
day 31 → 3+1 = 4, month 12 → 12, year 2000 → 2
D = 4 + 12 + 2 = 18
E = 4 + 12 + 2 + 18 = 36 → 9
SW = 18 + 4 = 22           (a corner landing on exactly 22)
```

### Case 5 — 1975-08-30 (day 30 → 3; year digit sum exactly 22)

```
day 30 → 3+0 = 3           (lower than day 29's 11 — the non-monotonicity)
month 8 → 8
year 1975 → 1+9+7+5 = 22   (kept as 22)
D = 3 + 8 + 22 = 33 → 6
E = 3 + 8 + 22 + 6 = 39 → 12
```

The full expected value for every position in every case lives in the fixture
file; the derivations above are what a reader should be able to re-check by hand.

## 7. Known divergences, collected

Every one of these is a place where sources genuinely disagree, or where a source
contradicts itself. They are listed so that a future reader who finds the losing
variant recognises it as considered and rejected rather than missed.

| # | Question | Adopted | Rejected variant |
| --- | --- | --- | --- |
| 1 | Reduction above 22 | repeated digit-sum | subtract 22 (§1) |
| 2 | Ancestral centre | sum of all four corners | sum of the two upper corners (§3) |
| 3 | Money vs relationship line | one line, both readings | two separate lines with identical values (§5.1) |
| 4 | Planetary purpose | `social + spiritual` | omitted entirely by two implementations (§4) |
| 5 | Svadhisthana row | `C+E` / `D+E` | one ring further out (§5.2) |
| 6 | Health summary row | column sums, reduced (variant a) | third cell as `physical + energy` (variant b); a single-pass digit sum (§5.2) |
| 7 | Relationship line inputs | one person's date | both partners' dates — a different feature (§5.1) |
| 8 | Corner letter naming | compass directions | the H/I letter assignment is swapped between sources; cosmetic only (§3) |

Two sources are flagged as unreliable rather than merely divergent:

- **`matricaladini.ru`** — the Ladini-branded site itself — describes the comfort
  zone as a flat digit sum of the entire birth date (`1+2+0+3+1+9+8+5`), which is
  neither rule and does not reproduce its own method's output. An implementer
  citing the "official" site would get the wrong centre.
- **`matrica-sudby.ru`** presents, alongside its correct diagonal description, a
  scheme splitting parents top/bottom rather than diagonally, contradicting every
  other source *and its own adjacent paragraph*.

## 8. What this document does not settle

- **No canonical Ladini primary text was found on the open web.** Her official
  site publishes output categories and no formulas; the book excerpts reachable
  all stop before the calculation chapter. Everything here is reconstruction, and
  should be re-examined if a primary source surfaces.
- **The health summary row** (§5.2) is implemented as variant (a); the
  losing variant (b) and the single-pass-reduction bug are recorded there.
- **Interpretation content** is out of scope entirely — this document defines
  what the numbers *are*, never what they mean. That is epic #76.
