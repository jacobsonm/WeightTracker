(function (global) {
  function sortWeighInsChronologically(weighIns) {
    return [...weighIns].sort((a, b) => a.DateTime.localeCompare(b.DateTime));
  }

  /**
   * Progress from start toward target (0–100). Works for loss or gain.
   */
  function percentToward(start, current, target) {
    const total = target - start;
    if (total === 0) {
      return current === start ? 100 : null;
    }
    const done = current - start;
    const pct = (done / total) * 100;
    return Math.round(Math.max(0, Math.min(100, pct)));
  }

  function formatLbs(weight) {
    return `${weight.toFixed(1)} lbs`;
  }

  /**
   * Next intermediate goal not yet reached (by weight).
   */
  function findNextIntermediateGoal(current, start, goals) {
    if (!goals?.length) {
      return null;
    }

    const sorted = [...goals].sort((a, b) => a.weight - b.weight);

    if (start > current) {
      const unmet = sorted.filter((g) => current > g.weight);
      return unmet.length ? unmet[unmet.length - 1] : null;
    }

    if (start < current) {
      const unmet = sorted.filter((g) => current < g.weight);
      return unmet.length ? unmet[0] : null;
    }

    const unmet = sorted.filter((g) => current !== g.weight);
    return unmet.length ? unmet[0] : null;
  }

  function computeTotalChange(starting, current) {
    const delta = starting - current;
    const abs = Math.abs(delta).toFixed(1);

    if (delta > 0) {
      return {
        label: 'Since first weigh-in',
        value: `Lost ${abs} lbs`,
      };
    }
    if (delta < 0) {
      return {
        label: 'Since first weigh-in',
        value: `Gained ${abs} lbs`,
      };
    }
    return {
      label: 'Since first weigh-in',
      value: 'No change',
    };
  }

  function goalProgressDisplay(start, current, goal) {
    const pct = percentToward(start, current, goal.weight);
    if (pct === null) {
      return { value: '—', detail: null };
    }
    const label = goal.label ? goal.label : `${goal.weight} lbs`;
    return {
      value: `${pct}%`,
      detail: `Toward ${label}`,
    };
  }

  function targetProgressDisplay(start, current, targetWeight) {
    const pct = percentToward(start, current, targetWeight);
    if (pct === null) {
      return { value: '—', detail: null };
    }
    return {
      value: `${pct}%`,
      detail: `Toward ${targetWeight.toFixed(1)} lbs`,
    };
  }

  function computeProgressSummary(weighIns, profile) {
    const sorted = sortWeighInsChronologically(weighIns);

    if (sorted.length === 0) {
      return { hasWeighIns: false };
    }

    const startingWeight = sorted[0].weight;
    const currentWeight = sorted[sorted.length - 1].weight;
    const change = computeTotalChange(startingWeight, currentWeight);

    let goalProgress = {
      kind: 'prompt',
      title: 'Goal progress',
      message: 'Add a goal to show goal progress',
    };

    const goals = profile?.intermediateGoals ?? [];
    if (goals.length > 0) {
      const nextGoal = findNextIntermediateGoal(
        currentWeight,
        startingWeight,
        goals,
      );
      if (nextGoal) {
        const display = goalProgressDisplay(
          startingWeight,
          currentWeight,
          nextGoal,
        );
        goalProgress = {
          kind: 'percent',
          title: 'Goal progress',
          value: display.value,
          detail: display.detail,
        };
      } else {
        goalProgress = {
          kind: 'message',
          title: 'Goal progress',
          value: 'All goals reached',
          detail: null,
        };
      }
    }

    let targetProgress = {
      kind: 'prompt',
      title: 'Target progress',
      message: 'Add a target weight to show progress',
    };

    const targetWeight = profile?.targetWeight;
    if (targetWeight !== undefined && Number.isFinite(targetWeight)) {
      const display = targetProgressDisplay(
        startingWeight,
        currentWeight,
        targetWeight,
      );
      targetProgress = {
        kind: 'percent',
        title: 'Target progress',
        value: display.value,
        detail: display.detail,
      };
    }

    return {
      hasWeighIns: true,
      startingWeight,
      currentWeight,
      change,
      goalProgress,
      targetProgress,
    };
  }

  const api = {
    sortWeighInsChronologically,
    percentToward,
    findNextIntermediateGoal,
    computeProgressSummary,
  };

  global.WeightTrackerProgress = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
