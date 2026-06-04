import type { UserProfile } from './profile';

export type IdealWeightEstimate = {
  idealWeight: number;
  idealWeightRange: { min: number; max: number };
};

const LBS_PER_KG = 2.2046226218;

function devineKg(heightInches: number, sex: 'male' | 'female'): number {
  const base = sex === 'male' ? 50 : 45.5;
  return base + 2.3 * Math.max(0, heightInches - 60);
}

function bmiWeightRangeLbs(heightInches: number): {
  min: number;
  max: number;
} {
  const heightM = heightInches * 0.0254;
  const minKg = 18.5 * heightM * heightM;
  const maxKg = 24.9 * heightM * heightM;
  return {
    min: round1(minKg * LBS_PER_KG),
    max: round1(maxKg * LBS_PER_KG),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeIdealWeight(
  profile: Pick<UserProfile, 'heightInches' | 'sex'>,
): IdealWeightEstimate {
  const range = bmiWeightRangeLbs(profile.heightInches);

  let idealKg: number;
  if (profile.sex === 'male') {
    idealKg = devineKg(profile.heightInches, 'male');
  } else if (profile.sex === 'female') {
    idealKg = devineKg(profile.heightInches, 'female');
  } else {
    idealKg =
      (devineKg(profile.heightInches, 'male') +
        devineKg(profile.heightInches, 'female')) /
      2;
  }

  return {
    idealWeight: round1(idealKg * LBS_PER_KG),
    idealWeightRange: range,
  };
}
