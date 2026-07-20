import { describe, expect, it } from 'vitest';
import { computeCoreSquare } from './core';
import {
  CHAKRA_ORDER,
  computeHealthMap,
  computeHealthSummary,
  computeMoneyAndRelationshipLine,
} from './lines';
import { isArcana, sumArcana } from './reduce';

/** 1990-11-22: day 22, month 11, year 19, sum 7, centre 14. */
const CORE = computeCoreSquare('1990-11-22');

describe('computeMoneyAndRelationshipLine', () => {
  it('derives both ends from the centre', () => {
    const line = computeMoneyAndRelationshipLine(CORE);
    expect(line.entry).toBe(21); // sum 7 + centre 14
    expect(line.partner).toBe(6); // year 19 + centre 14 = 33 -> 6
  });

  it('builds the core from the two ends and the flanks from the core', () => {
    const line = computeMoneyAndRelationshipLine(CORE);
    expect(line.core).toBe(9); // 21 + 6 = 27 -> 9
    expect(line.toEntry).toBe(3); // 21 + 9 = 30 -> 3
    expect(line.toPartner).toBe(15); // 9 + 6 = 15
  });

  it('always produces an entry point that is a multiple of 3', () => {
    // The discriminating check between the inner-ring reading (adopted) and the
    // outer-ring one. `centre` is 2*(day+month+year) before reduction and
    // digit-summing preserves value mod 9, so entry = sum + centre is congruent
    // to 3*sum mod 9 — hence always a multiple of 3, matching the published
    // claim that "1 and 2 never occur there". The rejected outer-ring candidate
    // has no such property, so this test is the reason to believe the formula
    // rather than just a restatement of it.
    for (let year = 1900; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        for (const day of [1, 9, 17, 28]) {
          const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const { entry } = computeMoneyAndRelationshipLine(computeCoreSquare(iso));
          expect(entry % 3, `${iso} -> entry ${entry}`).toBe(0);
        }
      }
    }
  });
});

describe('computeHealthMap', () => {
  it('returns the seven chakras crown to root', () => {
    expect(computeHealthMap(CORE).map((row) => row.chakra)).toEqual(CHAKRA_ORDER);
  });

  it('puts the raw cardinals at the crown and the root', () => {
    const rows = computeHealthMap(CORE);
    const [sahasrara] = rows;
    const muladhara = rows[rows.length - 1]!;
    expect(sahasrara!.physical).toBe(CORE.day);
    expect(sahasrara!.energy).toBe(CORE.month);
    expect(muladhara.physical).toBe(CORE.year);
    expect(muladhara.energy).toBe(CORE.sum);
  });

  it('puts the centre on both sides of Manipura', () => {
    const manipura = computeHealthMap(CORE).find((r) => r.chakra === 'manipura')!;
    expect(manipura.physical).toBe(CORE.centre);
    expect(manipura.energy).toBe(CORE.centre);
  });

  it('feeds the REDUCED Vishuddha into Ajna and Anahata', () => {
    // The ordering constraint. Vishuddha physical = day 22 + centre 14 = 36 -> 9.
    // Ajna physical = day 22 + 9 = 31 -> 4, and Anahata physical = 9 + 14 = 23 -> 5.
    // Chaining the *unreduced* 36 instead would give 58 -> 13 and 50 -> 5.
    const rows = computeHealthMap(CORE);
    const vishuddha = rows.find((r) => r.chakra === 'vishuddha')!;
    const ajna = rows.find((r) => r.chakra === 'ajna')!;
    const anahata = rows.find((r) => r.chakra === 'anahata')!;

    expect(vishuddha.physical).toBe(9);
    expect(ajna.physical).toBe(sumArcana(CORE.day, vishuddha.physical));
    expect(ajna.physical).toBe(4);
    expect(anahata.physical).toBe(sumArcana(vishuddha.physical, CORE.centre));
    expect(anahata.physical).toBe(5);
  });

  it('sums each row into its emotional cell', () => {
    for (const row of computeHealthMap(CORE)) {
      expect(row.emotional).toBe(sumArcana(row.physical, row.energy));
    }
  });

  it('places the money line on the Svadhisthana row', () => {
    // Not a coincidence and not duplicated data by accident — the line sits on
    // this row, which is exactly how the sources describe it. Asserted so the
    // relationship is visible rather than looking like a copy-paste slip.
    const svadhisthana = computeHealthMap(CORE).find((r) => r.chakra === 'svadhisthana')!;
    const line = computeMoneyAndRelationshipLine(CORE);
    expect(svadhisthana.physical).toBe(line.partner);
    expect(svadhisthana.energy).toBe(line.entry);
  });

  it('produces only valid arcana across an exhaustive sweep', () => {
    for (let year = 1900; year <= 2030; year++) {
      for (const [month, day] of [
        [3, 14],
        [9, 29],
        [12, 31],
      ] as const) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        for (const row of computeHealthMap(computeCoreSquare(iso))) {
          for (const value of [row.physical, row.energy, row.emotional]) {
            expect(isArcana(value), `${iso} ${row.chakra} -> ${value}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('computeHealthSummary', () => {
  it('totals each column across all seven chakras and reduces', () => {
    // 1990-11-22, hand-summed from the health map:
    //   physical: 22+4+9+5+14+6+19 = 79 -> 16
    //   energy:   11+18+7+21+14+21+7 = 99 -> 18
    //   emotional: 6+22+16+8+10+9+8 = 79 -> 16
    const summary = computeHealthSummary(computeHealthMap(CORE));
    expect(summary).toEqual({ physical: 16, energy: 18, emotional: 16 });
  });

  it('matches the totals two live calculators print for 1979-07-29', () => {
    // The external check that settles variant (a): beloesolnce.ru and
    // gadalkindom.ru both print 14 / 12 / 8 for this date. If the third cell
    // were `physical + energy` (the rejected variant b) it would be
    // reduce(14+12) = 8 here by coincidence — so this date does NOT
    // discriminate the two, which is exactly why the next test exists.
    const summary = computeHealthSummary(computeHealthMap(computeCoreSquare('1979-07-29')));
    expect(summary).toEqual({ physical: 14, energy: 12, emotional: 8 });
  });

  it('sums the emotional COLUMN, not physical+energy of the summary', () => {
    // The one real divergence in this row. For 1990-11-22 the two rules give
    // different answers, so this pins variant (a) down:
    //   (a) emotional column summed = 16
    //   (b) reduce(physical 16 + energy 18) = reduce(34) = 7
    const rows = computeHealthMap(CORE);
    const summary = computeHealthSummary(rows);
    expect(summary.emotional).toBe(16);
    expect(summary.emotional).not.toBe(sumArcana(summary.physical, summary.energy));
  });

  it('produces only valid arcana across an exhaustive sweep', () => {
    // Seven arcana of at most 22 sum to at most 154, which always reduces back
    // into 1-22 — asserted rather than assumed.
    for (let year = 1900; year <= 2030; year++) {
      for (const [month, day] of [
        [1, 1],
        [6, 22],
        [12, 31],
      ] as const) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const summary = computeHealthSummary(computeHealthMap(computeCoreSquare(iso)));
        for (const value of [summary.physical, summary.energy, summary.emotional]) {
          expect(isArcana(value), `${iso} -> ${value}`).toBe(true);
        }
      }
    }
  });
});
