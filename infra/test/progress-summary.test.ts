const {
  computeProgressSummary,
  findNextIntermediateGoal,
  percentToward,
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('../../web/progress.js');

describe('percentToward', () => {
  it('computes loss progress toward lower target', () => {
    expect(percentToward(200, 195, 180)).toBe(25);
  });

  it('computes gain progress toward higher target', () => {
    expect(percentToward(150, 155, 170)).toBe(25);
  });

  it('caps at 100 when target exceeded on loss', () => {
    expect(percentToward(200, 175, 180)).toBe(100);
  });
});

describe('findNextIntermediateGoal', () => {
  const goals = [{ weight: 180 }, { weight: 170 }];

  it('returns closest unmet goal when losing', () => {
    expect(findNextIntermediateGoal(175, 200, goals)).toEqual({ weight: 170 });
  });

  it('returns first milestone when still above all goals', () => {
    expect(findNextIntermediateGoal(185, 200, goals)).toEqual({ weight: 180 });
  });
});

describe('computeProgressSummary', () => {
  it('returns prompts when no weigh-ins', () => {
    const summary = computeProgressSummary([], { targetWeight: 180 });
    expect(summary.hasWeighIns).toBe(false);
  });

  it('shows loss wording and target percent', () => {
    const summary = computeProgressSummary(
      [
        { DateTime: '2026-01-01T12:00:00.000Z', weight: 200 },
        { DateTime: '2026-02-01T12:00:00.000Z', weight: 190 },
      ],
      { targetWeight: 180, intermediateGoals: [] },
    );

    expect(summary.change?.value).toBe('Lost 10.0 lbs');
    expect(summary.targetProgress).toMatchObject({
      kind: 'percent',
      value: '50%',
    });
    expect(summary.goalProgress?.message).toBe(
      'Add a goal to show goal progress',
    );
  });

  it('shows gain wording when weight increased', () => {
    const summary = computeProgressSummary(
      [
        { DateTime: '2026-01-01T12:00:00.000Z', weight: 150 },
        { DateTime: '2026-02-01T12:00:00.000Z', weight: 155 },
      ],
      {},
    );

    expect(summary.change?.value).toBe('Gained 5.0 lbs');
  });

  it('prompts for target when unset', () => {
    const summary = computeProgressSummary(
      [{ DateTime: '2026-01-01T12:00:00.000Z', weight: 200 }],
      {},
    );

    expect(summary.targetProgress).toMatchObject({
      kind: 'prompt',
      message: 'Add a target weight to show progress',
    });
  });
});
