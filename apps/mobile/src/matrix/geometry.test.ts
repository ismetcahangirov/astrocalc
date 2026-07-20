import { describe, expect, it } from 'vitest';
import { computeDestinyMatrix } from '@astrocalc/calc-engine';
import {
  computeOctagramLayout,
  normalize360,
  pointOnCircle,
  type OctagramLayout,
} from './geometry';

const SIZE = 320;
/** 1990-11-22: day 22, month 11, year 19, sum 7, centre 14; corners 6/3/8/11. */
const MATRIX = computeDestinyMatrix({ birthDate: '1990-11-22' });

function layout(): OctagramLayout {
  return computeOctagramLayout(MATRIX, SIZE);
}

/** Distance between two points, for radius assertions. */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('normalize360', () => {
  it.each([
    [0, 0],
    [360, 0],
    [370, 10],
    [-90, 270],
    [-450, 270],
  ])('normalize360(%i) = %i', (input, expected) => {
    expect(normalize360(input)).toBe(expected);
  });
});

describe('pointOnCircle', () => {
  const center = { x: 100, y: 100 };

  it('places 0° to the right and 90° above, with the y-axis flipped', () => {
    expect(pointOnCircle(center, 50, 0).x).toBeCloseTo(150);
    expect(pointOnCircle(center, 50, 0).y).toBeCloseTo(100);
    // 90° is *above* the centre, so y decreases — the flip that makes the
    // figure read the way it is drawn rather than upside down.
    expect(pointOnCircle(center, 50, 90).y).toBeCloseTo(50);
  });

  it('places 180° left and 270° below', () => {
    expect(pointOnCircle(center, 50, 180).x).toBeCloseTo(50);
    expect(pointOnCircle(center, 50, 270).y).toBeCloseTo(150);
  });
});

describe('computeOctagramLayout', () => {
  it('centres the figure on the canvas', () => {
    const l = layout();
    expect(l.center).toEqual({ x: SIZE / 2, y: SIZE / 2 });
    expect(l.size).toBe(SIZE);
  });

  it('places the four cardinals at the compass points the method defines', () => {
    const l = layout();
    const at = (key: string) => l.nodes.find((n) => n.key === key)!;

    // day west, month north, year east, sum south.
    expect(at('core.day').point.x).toBeLessThan(l.center.x);
    expect(at('core.day').point.y).toBeCloseTo(l.center.y);
    expect(at('core.month').point.y).toBeLessThan(l.center.y);
    expect(at('core.year').point.x).toBeGreaterThan(l.center.x);
    expect(at('core.sum').point.y).toBeGreaterThan(l.center.y);
  });

  it('carries each position’s arcana onto its node', () => {
    const l = layout();
    const arcanaFor = (key: string) => l.nodes.find((n) => n.key === key)!.arcana;

    expect(arcanaFor('core.day')).toBe(22);
    expect(arcanaFor('core.month')).toBe(11);
    expect(arcanaFor('core.year')).toBe(19);
    expect(arcanaFor('core.sum')).toBe(7);
    expect(arcanaFor('core.centre')).toBe(14);
    expect(arcanaFor('ancestral.paternalSpiritual')).toBe(6); // NW
    expect(arcanaFor('ancestral.maternalSpiritual')).toBe(3); // NE
    expect(arcanaFor('ancestral.paternalMaterial')).toBe(8); // SE
    expect(arcanaFor('ancestral.maternalMaterial')).toBe(11); // SW
    expect(arcanaFor('ancestral.centre')).toBe(10);
  });

  it('puts the ancestral corners on the diagonals, between the cardinals', () => {
    const l = layout();
    const nw = l.nodes.find((n) => n.key === 'ancestral.paternalSpiritual')!;
    // North-west: left of centre and above it.
    expect(nw.point.x).toBeLessThan(l.center.x);
    expect(nw.point.y).toBeLessThan(l.center.y);
    expect(nw.angle).toBe(135);
  });

  it('places all eight outer points on one circle', () => {
    const l = layout();
    const outer = l.nodes.filter((n) => n.kind === 'cardinal' || n.kind === 'diagonal');
    expect(outer).toHaveLength(8);
    for (const node of outer) {
      expect(distance(node.point, l.center)).toBeCloseTo(l.radius);
    }
  });

  it('runs each ancestral arm inward along its own diagonal', () => {
    const l = layout();
    const corner = l.nodes.find((n) => n.key === 'ancestral.paternalSpiritual')!;
    const middle = l.nodes.find((n) => n.key === 'ancestral.paternalSpiritual.middle')!;
    const inner = l.nodes.find((n) => n.key === 'ancestral.paternalSpiritual.inner')!;

    // Same bearing, strictly decreasing distance from the centre.
    expect(middle.angle).toBe(corner.angle);
    expect(inner.angle).toBe(corner.angle);
    expect(distance(middle.point, l.center)).toBeLessThan(distance(corner.point, l.center));
    expect(distance(inner.point, l.center)).toBeLessThan(distance(middle.point, l.center));
  });

  it('puts the ancestral centre just below the personal one, not on top of it', () => {
    const l = layout();
    const centre = l.nodes.find((n) => n.key === 'core.centre')!;
    const ancestral = l.nodes.find((n) => n.key === 'ancestral.centre')!;

    expect(centre.point).toEqual(l.center);
    expect(ancestral.point.x).toBe(l.center.x);
    expect(ancestral.point.y).toBeGreaterThan(l.center.y);
    // They must not collide — two discs drawn at the same spot would render as
    // one, silently hiding a value.
    expect(distance(ancestral.point, centre.point)).toBeGreaterThan(0);
  });

  it('draws the parental lines between OPPOSITE corners', () => {
    // Adjacent corners would just redraw the ancestral square. The paternal line
    // is NW↔SE and the maternal NE↔SW, so each must pass through the centre —
    // asserted by checking the midpoint of each segment is the centre.
    const l = layout();
    expect(l.parentalLines).toHaveLength(2);
    for (const line of l.parentalLines) {
      expect((line.from.x + line.to.x) / 2).toBeCloseTo(l.center.x);
      expect((line.from.y + line.to.y) / 2).toBeCloseTo(l.center.y);
    }
  });

  it('closes both squares into four edges each', () => {
    const l = layout();
    expect(l.personalSquare).toHaveLength(4);
    expect(l.ancestralSquare).toHaveLength(4);
    // Closed: the last edge's end is the first edge's start.
    expect(l.personalSquare[3]!.to).toEqual(l.personalSquare[0]!.from);
    expect(l.ancestralSquare[3]!.to).toEqual(l.ancestralSquare[0]!.from);
  });

  it('emits one spoke to each outer point', () => {
    const l = layout();
    expect(l.spokes).toHaveLength(8);
    for (const spoke of l.spokes) expect(spoke.from).toEqual(l.center);
  });

  it('gives every node a unique key', () => {
    const keys = layout().nodes.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('places every node and label inside the canvas', () => {
    // The margin exists so captions do not clip. Checked across several sizes
    // because the ratios are all relative and an off-by-one in the margin only
    // shows up at one end of the range.
    for (const size of [200, 320, 480]) {
      const l = computeOctagramLayout(MATRIX, size);
      for (const node of l.nodes) {
        for (const p of [node.point, node.label]) {
          expect(p.x, `${node.key} at size ${size}`).toBeGreaterThanOrEqual(0);
          expect(p.x, `${node.key} at size ${size}`).toBeLessThanOrEqual(size);
          expect(p.y, `${node.key} at size ${size}`).toBeGreaterThanOrEqual(0);
          expect(p.y, `${node.key} at size ${size}`).toBeLessThanOrEqual(size);
        }
      }
    }
  });

  it('scales purely with the canvas size', () => {
    const small = computeOctagramLayout(MATRIX, 200);
    const large = computeOctagramLayout(MATRIX, 400);
    expect(large.radius).toBeCloseTo(small.radius * 2);
  });

  it('renders only arcana that exist in the Matrix', () => {
    for (const node of layout().nodes) {
      expect(node.arcana).toBeGreaterThanOrEqual(1);
      expect(node.arcana).toBeLessThanOrEqual(22);
    }
  });

  it('lays out every date in a broad sweep without producing a NaN', () => {
    // The whole point of keeping this math pure: a NaN here would render as a
    // blank canvas with no error, which is the hardest kind of bug to notice.
    for (const birthDate of ['1900-01-01', '1975-08-30', '2000-12-31', '2030-06-15']) {
      const l = computeOctagramLayout(computeDestinyMatrix({ birthDate }), 300);
      for (const node of l.nodes) {
        expect(Number.isFinite(node.point.x), `${birthDate} ${node.key}`).toBe(true);
        expect(Number.isFinite(node.point.y), `${birthDate} ${node.key}`).toBe(true);
      }
    }
  });

  it('places the chakra health points on the two central axes (§5.2)', () => {
    const l = layout();
    const at = (key: string) => l.nodes.find((n) => n.key === key)!;
    const cell = (name: string) => MATRIX.health.find((r) => r.chakra === name)!;

    // Physical column → the horizontal axis (same y as the centre); energy
    // column → the vertical axis (same x as the centre).
    for (const name of ['ajna', 'vishuddha', 'anahata', 'svadhisthana']) {
      const physical = at(`chakra.${name}.physical`);
      expect(physical.kind).toBe('axis');
      expect(physical.point.y).toBeCloseTo(l.center.y);
      expect(physical.arcana).toBe(cell(name).physical);

      const energy = at(`chakra.${name}.energy`);
      expect(energy.point.x).toBeCloseTo(l.center.x);
      expect(energy.arcana).toBe(cell(name).energy);
    }

    // The crown arm steps inward: ajna (0.75) outside vishuddha (0.5) outside
    // anahata (0.25).
    const d = (key: string) => distance(at(key).point, l.center);
    expect(d('chakra.ajna.physical')).toBeGreaterThan(d('chakra.vishuddha.physical'));
    expect(d('chakra.vishuddha.physical')).toBeGreaterThan(d('chakra.anahata.physical'));
  });

  it('draws the money/relationship line between the Svadhisthana points, marked $ and ♥', () => {
    const l = layout();
    expect(l.moneyLine).toHaveLength(1);
    const [seg] = l.moneyLine;
    const ends = [seg!.from, seg!.to];
    // One end sits east on the horizontal (partner, C+E), the other south on the
    // vertical (entry, D+E) — where §5.1 says the line's ends lie.
    expect(ends.some((p) => p.x > l.center.x && Math.abs(p.y - l.center.y) < 1)).toBe(true);
    expect(ends.some((p) => p.y > l.center.y && Math.abs(p.x - l.center.x) < 1)).toBe(true);

    // The two marks are distinct and both fall in the SE quadrant.
    expect(l.moneyMark).not.toEqual(l.loveMark);
    for (const m of [l.moneyMark, l.loveMark]) {
      expect(m.x).toBeGreaterThan(l.center.x);
      expect(m.y).toBeGreaterThan(l.center.y);
    }
  });
});
