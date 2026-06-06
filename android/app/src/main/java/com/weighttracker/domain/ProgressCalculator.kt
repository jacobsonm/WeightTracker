package com.weighttracker.domain

import com.weighttracker.data.IntermediateGoal
import com.weighttracker.data.UserProfile
import com.weighttracker.data.WeighIn

data class ProgressMetric(
    val title: String,
    val value: String,
    val detail: String? = null,
    val isPrompt: Boolean = false,
)

data class ProgressSummary(
    val hasWeighIns: Boolean,
    val startingWeight: Double? = null,
    val currentWeight: Double? = null,
    val changeLabel: String? = null,
    val changeValue: String? = null,
    val goalProgress: ProgressMetric? = null,
    val targetProgress: ProgressMetric? = null,
)

object ProgressCalculator {
    fun compute(weighIns: List<WeighIn>, profile: UserProfile?): ProgressSummary {
        val sorted = weighIns.sortedBy { it.dateTime }
        if (sorted.isEmpty()) {
            return ProgressSummary(hasWeighIns = false)
        }

        val starting = sorted.first().weight
        val current = sorted.last().weight
        val change = totalChange(starting, current)

        val goalProgress = goalProgressMetric(starting, current, profile?.intermediateGoals)
        val targetProgress = targetProgressMetric(starting, current, profile?.targetWeight)

        return ProgressSummary(
            hasWeighIns = true,
            startingWeight = starting,
            currentWeight = current,
            changeLabel = change.first,
            changeValue = change.second,
            goalProgress = goalProgress,
            targetProgress = targetProgress,
        )
    }

    private fun totalChange(starting: Double, current: Double): Pair<String, String> {
        val delta = starting - current
        val abs = kotlin.math.abs(delta)
        val formatted = String.format("%.1f", abs)
        return when {
            delta > 0 -> "Since first weigh-in" to "Lost $formatted lbs"
            delta < 0 -> "Since first weigh-in" to "Gained $formatted lbs"
            else -> "Since first weigh-in" to "No change"
        }
    }

    private fun goalProgressMetric(
        start: Double,
        current: Double,
        goals: List<IntermediateGoal>?,
    ): ProgressMetric {
        if (goals.isNullOrEmpty()) {
            return ProgressMetric(
                title = "Goal progress",
                value = "Add a goal to show goal progress",
                isPrompt = true,
            )
        }
        val next = findNextIntermediateGoal(current, start, goals)
            ?: return ProgressMetric(
                title = "Goal progress",
                value = "All goals reached",
            )
        val pct = percentToward(start, current, next.weight)
        val label = next.label ?: "${next.weight} lbs"
        return ProgressMetric(
            title = "Goal progress",
            value = "$pct%",
            detail = "Toward $label",
        )
    }

    private fun targetProgressMetric(
        start: Double,
        current: Double,
        targetWeight: Double?,
    ): ProgressMetric {
        if (targetWeight == null) {
            return ProgressMetric(
                title = "Target progress",
                value = "Add a target weight to show progress",
                isPrompt = true,
            )
        }
        val pct = percentToward(start, current, targetWeight)
        return ProgressMetric(
            title = "Target progress",
            value = "$pct%",
            detail = "Toward ${String.format("%.1f", targetWeight)} lbs",
        )
    }

    fun percentToward(start: Double, current: Double, target: Double): Int {
        val total = target - start
        if (total == 0.0) {
            return if (current == start) 100 else 0
        }
        val done = current - start
        val pct = (done / total) * 100.0
        return pct.coerceIn(0.0, 100.0).toInt()
    }

    fun findNextIntermediateGoal(
        current: Double,
        start: Double,
        goals: List<IntermediateGoal>,
    ): IntermediateGoal? {
        val sorted = goals.sortedBy { it.weight }
        return when {
            start > current -> {
                val unmet = sorted.filter { current > it.weight }
                unmet.lastOrNull()
            }
            start < current -> {
                val unmet = sorted.filter { current < it.weight }
                unmet.firstOrNull()
            }
            else -> sorted.firstOrNull { current != it.weight }
        }
    }
}
