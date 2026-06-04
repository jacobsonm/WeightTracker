import type { IntermediateGoal } from './profile';

const MIN_WEIGHT = 50;
const MAX_WEIGHT = 600;
const MAX_GOALS = 10;
const MAX_LABEL_LENGTH = 50;

export function parseOptionalWeight(
  value: unknown,
  fieldName: string,
): number | undefined | { error: string } {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: `${fieldName} must be a number` };
  }

  if (value < MIN_WEIGHT || value > MAX_WEIGHT) {
    return {
      error: `${fieldName} must be between ${MIN_WEIGHT} and ${MAX_WEIGHT}`,
    };
  }

  return value;
}

export function parseIntermediateGoals(
  value: unknown,
): IntermediateGoal[] | { error: string } {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return { error: 'intermediateGoals must be an array' };
  }

  if (value.length > MAX_GOALS) {
    return { error: `intermediateGoals must have at most ${MAX_GOALS} items` };
  }

  const goals: IntermediateGoal[] = [];

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      return { error: 'Each intermediate goal must be an object' };
    }

    const { weight, label } = entry as Record<string, unknown>;
    const parsedWeight = parseOptionalWeight(weight, 'intermediateGoals[].weight');
    if (typeof parsedWeight === 'object') {
      return parsedWeight;
    }

    if (parsedWeight === undefined) {
      return { error: 'Each intermediate goal requires a weight' };
    }

    let parsedLabel: string | undefined;
    if (label !== undefined && label !== null && label !== '') {
      if (typeof label !== 'string') {
        return { error: 'intermediateGoals[].label must be a string' };
      }
      const trimmed = label.trim();
      if (trimmed.length > MAX_LABEL_LENGTH) {
        return {
          error: `intermediateGoals[].label must be at most ${MAX_LABEL_LENGTH} characters`,
        };
      }
      parsedLabel = trimmed || undefined;
    }

    goals.push({
      weight: parsedWeight,
      ...(parsedLabel ? { label: parsedLabel } : {}),
    });
  }

  goals.sort((a, b) => a.weight - b.weight);
  return goals;
}
