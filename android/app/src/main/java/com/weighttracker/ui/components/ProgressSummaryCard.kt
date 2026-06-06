package com.weighttracker.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.weighttracker.domain.ProgressMetric
import com.weighttracker.domain.ProgressSummary

@Composable
fun ProgressSummaryCard(summary: ProgressSummary) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Progress", style = MaterialTheme.typography.titleMedium)
            if (!summary.hasWeighIns) {
                Text(
                    "Add a weigh-in to see your progress.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                return@Column
            }

            val metrics = buildList {
                add(ProgressMetric("Starting weight", String.format("%.1f lbs", summary.startingWeight)))
                add(ProgressMetric("Current weight", String.format("%.1f lbs", summary.currentWeight)))
                add(
                    ProgressMetric(
                        summary.changeLabel ?: "Since first weigh-in",
                        summary.changeValue ?: "",
                    ),
                )
                summary.goalProgress?.let { add(it) }
                summary.targetProgress?.let { add(it) }
            }

            metrics.chunked(2).forEach { rowMetrics ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    rowMetrics.forEach { metric ->
                        MetricTile(
                            metric = metric,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (rowMetrics.size == 1) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricTile(
    metric: ProgressMetric,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                metric.title.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                metric.value,
                style = if (metric.isPrompt) {
                    MaterialTheme.typography.bodyMedium
                } else {
                    MaterialTheme.typography.titleLarge
                },
                modifier = Modifier.padding(top = 4.dp),
            )
            metric.detail?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
