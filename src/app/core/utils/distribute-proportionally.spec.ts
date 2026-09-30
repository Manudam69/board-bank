import { describe, it, expect } from 'vitest';
import { distributeProportionally } from './distribute-proportionally';

describe('distributeProportionally', () => {
  it('distributes evenly when weights are equal', () => {
    const result = distributeProportionally(100, [50, 50]);
    expect(result).toEqual([
      { index: 0, share: 50 },
      { index: 1, share: 50 },
    ]);
  });

  it('distributes proportionally with unequal weights', () => {
    const result = distributeProportionally(100, [30, 70]);
    expect(result).toEqual([
      { index: 0, share: 30 },
      { index: 1, share: 70 },
    ]);
  });

  it('gives remainder to the heaviest weights first', () => {
    const result = distributeProportionally(10, [1, 1, 1]);
    const shares = result.map((r) => r.share);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10);
    expect(shares).toEqual([4, 3, 3]);
  });

  it('returns zero for zero weights', () => {
    const result = distributeProportionally(50, [0, 100, 0]);
    expect(result).toEqual([
      { index: 0, share: 0 },
      { index: 1, share: 50 },
      { index: 2, share: 0 },
    ]);
  });

  it('returns all zeros when total is zero', () => {
    const result = distributeProportionally(0, [30, 70]);
    expect(result).toEqual([
      { index: 0, share: 0 },
      { index: 1, share: 0 },
    ]);
  });

  it('throws for negative total', () => {
    expect(() => distributeProportionally(-1, [50, 50])).toThrow();
  });

  it('throws for negative weights', () => {
    expect(() => distributeProportionally(100, [-1, 50])).toThrow();
  });

  it('distributes all available when total is less than total owed', () => {
    const result = distributeProportionally(25, [100, 100, 100]);
    const shares = result.map((r) => r.share);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(25);
    expect(shares).toEqual([9, 8, 8]);
  });
});
