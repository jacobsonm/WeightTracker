export type IntermediateGoal = {
  weight: number;
  label?: string;
};

export type UserProfile = {
  UserId: string;
  username: string;
  birthdate: string;
  sex: 'male' | 'female' | 'other';
  heightInches: number;
  timezone: string;
  targetWeight?: number;
  intermediateGoals?: IntermediateGoal[];
};

export type UserProfileResponse = UserProfile & {
  idealWeight?: number;
  idealWeightRange?: { min: number; max: number };
};
