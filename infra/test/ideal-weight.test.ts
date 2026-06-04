import { computeIdealWeight } from '../lambda/shared/ideal-weight';

describe('computeIdealWeight', () => {
  it('computes Devine ideal weight for male profile', () => {
    const result = computeIdealWeight({ heightInches: 70, sex: 'male' });
    expect(result.idealWeight).toBe(160.9);
    expect(result.idealWeightRange.min).toBeGreaterThan(0);
    expect(result.idealWeightRange.max).toBeGreaterThan(result.idealWeightRange.min);
  });

  it('computes average Devine for other sex', () => {
    const male = computeIdealWeight({ heightInches: 68, sex: 'male' }).idealWeight;
    const female = computeIdealWeight({ heightInches: 68, sex: 'female' }).idealWeight;
    const other = computeIdealWeight({ heightInches: 68, sex: 'other' }).idealWeight;
    expect(other).toBeGreaterThanOrEqual(Math.min(male, female));
    expect(other).toBeLessThanOrEqual(Math.max(male, female));
    expect(other).toBe(145.8);
  });
});
