export interface ProportionalShare {
  index: number;
  share: number;
}

/**
 * Distributes an integer total proportionally among a list of non-negative
 * weights. Shares are floored; any remaining units are given one-by-one to the
 * heaviest weights first. Weights of zero receive no share.
 */
export function distributeProportionally(total: number, weights: number[]): ProportionalShare[] {
  if (total < 0) throw new Error('El total a distribuir no puede ser negativo');
  if (weights.some((w) => w < 0)) throw new Error('Los pesos no pueden ser negativos');

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return weights.map((_, index) => ({ index, share: 0 }));
  }

  const shares = weights.map((weight, index) => {
    const share = Math.floor((total * weight) / totalWeight);
    return { index, weight, share };
  });

  const distributed = shares.reduce((sum, s) => sum + s.share, 0);
  let remainder = total - distributed;

  if (remainder > 0) {
    const sorted = shares
      .filter((s) => s.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    for (let i = 0; i < sorted.length && remainder > 0; i++) {
      sorted[i].share++;
      remainder--;
    }
  }

  return shares.map(({ index, share }) => ({ index, share }));
}
