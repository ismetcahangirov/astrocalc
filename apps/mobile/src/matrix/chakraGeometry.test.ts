import { describe, expect, it } from 'vitest';
import { computeDestinyMatrix, CHAKRA_ORDER } from '@astrocalc/calc-engine';
import { computeChakraBodyLayout, CANVAS_RATIO } from './chakraGeometry';

const MATRIX = computeDestinyMatrix({ birthDate: '1990-11-22' });
const SIZE = 360;

describe('computeChakraBodyLayout', () => {
  const layout = computeChakraBodyLayout(MATRIX, SIZE);

  it('sizes a portrait canvas', () => {
    expect(layout.size).toBe(SIZE);
    expect(layout.height).toBeCloseTo(SIZE * CANVAS_RATIO);
  });

  it('places seven chakra discs, crown to root', () => {
    expect(layout.nodes.map((n) => n.chakra)).toEqual([...CHAKRA_ORDER]);
  });

  it('carries each chakra its health-map cells, disc value = emotional', () => {
    for (let i = 0; i < layout.nodes.length; i++) {
      const node = layout.nodes[i]!;
      const row = MATRIX.health[i]!;
      expect([node.physical, node.energy, node.emotional]).toEqual([
        row.physical,
        row.energy,
        row.emotional,
      ]);
    }
  });

  it('stacks the discs on the central axis, top to bottom', () => {
    const cx = SIZE / 2;
    let prevY = -Infinity;
    for (const node of layout.nodes) {
      expect(node.center.x).toBe(cx);
      expect(node.center.y).toBeGreaterThan(prevY); // strictly descending down the body
      prevY = node.center.y;
    }
  });

  it('gives each chakra its own traditional colour', () => {
    const colors = layout.nodes.map((n) => n.color);
    expect(new Set(colors).size).toBe(colors.length); // all seven distinct
    expect(layout.nodes[0]!.color).toBe('#8B5CF6'); // crown violet
    expect(layout.nodes[6]!.color).toBe('#EF4444'); // root red
  });

  it('runs the channel from the crown disc to the root disc', () => {
    expect(layout.channel.top).toEqual(layout.nodes[0]!.center);
    expect(layout.channel.bottom).toEqual(layout.nodes[6]!.center);
  });

  it('emits a closed body path, a head, and two arms', () => {
    expect(layout.bodyPath.startsWith('M ')).toBe(true);
    expect(layout.bodyPath.trimEnd().endsWith('Z')).toBe(true);
    expect(layout.head.radius).toBeGreaterThan(0);
    expect(layout.head.center.x).toBe(SIZE / 2);
    expect(layout.arms).toHaveLength(2);
    for (const arm of layout.arms) expect(arm.startsWith('M ')).toBe(true);
  });

  it('scales with size', () => {
    const small = computeChakraBodyLayout(MATRIX, 200);
    expect(small.nodes[0]!.radius).toBeLessThan(layout.nodes[0]!.radius);
  });
});
