package com.weighttracker.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.weighttracker.data.UserProfile
import com.weighttracker.data.WeighIn
import com.weighttracker.util.DateTimeUtil
import java.time.ZoneId

@Composable
fun HistoryScreen(
    weighIns: List<WeighIn>,
    profile: UserProfile?,
    deleteCandidate: WeighIn?,
    onDeleteRequest: (WeighIn) -> Unit,
    onDeleteConfirm: () -> Unit,
    onDeleteDismiss: () -> Unit,
) {
    val zone = DateTimeUtil.profileTimezone(profile?.timezone)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Trend", style = MaterialTheme.typography.titleMedium)
                if (weighIns.isEmpty()) {
                    Text("No data to chart yet.", modifier = Modifier.padding(top = 8.dp))
                } else {
                    WeightChart(
                        weighIns = weighIns,
                        zone = zone,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(260.dp)
                            .padding(top = 8.dp),
                    )
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Weigh-ins", style = MaterialTheme.typography.titleMedium)
                if (weighIns.isEmpty()) {
                    Text("No weigh-ins yet.", modifier = Modifier.padding(top = 8.dp))
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        weighIns.forEach { entry ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(DateTimeUtil.formatDisplayDateTime(entry.dateTime, zone))
                                    Text(String.format("%.1f lbs", entry.weight))
                                }
                                TextButton(onClick = { onDeleteRequest(entry) }) {
                                    Text("Delete")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    deleteCandidate?.let { entry ->
        AlertDialog(
            onDismissRequest = onDeleteDismiss,
            title = { Text("Delete weigh-in?") },
            text = {
                Text(
                    DateTimeUtil.formatDisplayDateTime(entry.dateTime, zone),
                )
            },
            confirmButton = {
                TextButton(onClick = onDeleteConfirm) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = onDeleteDismiss) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun WeightChart(
    weighIns: List<WeighIn>,
    zone: ZoneId,
    modifier: Modifier = Modifier,
) {
    val weights = weighIns.map { it.weight }
    val min = (weights.minOrNull() ?: 0.0) - 5.0
    val max = (weights.maxOrNull() ?: 0.0) + 5.0
    val lineColor = MaterialTheme.colorScheme.primary
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    val labelEntries = chartLabelEntries(weighIns)

    Column(modifier = modifier) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
        ) {
            if (weights.size < 2) return@Canvas

            val left = 16f
            val right = size.width - 16f
            val top = 16f
            val bottom = size.height - 16f
            val range = (max - min).coerceAtLeast(1.0)

            drawLine(
                color = gridColor,
                start = Offset(left, bottom),
                end = Offset(right, bottom),
                strokeWidth = 2f,
            )

            val path = Path()
            weights.forEachIndexed { index, weight ->
                val x = left + (right - left) * index / weights.lastIndex
                val y = bottom - ((weight - min) / range * (bottom - top)).toFloat()
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }

            drawPath(
                path = path,
                color = lineColor,
                style = Stroke(width = 4f, cap = StrokeCap.Round),
            )
        }

        ChartLabelRow(
            labelEntries = labelEntries,
            zone = zone,
        )
    }
}

@Composable
private fun ChartLabelRow(
    labelEntries: List<WeighIn>,
    zone: ZoneId,
) {
    when (labelEntries.size) {
        1 -> {
            Box(modifier = Modifier.fillMaxWidth()) {
                ChartPointLabel(
                    entry = labelEntries[0],
                    zone = zone,
                    modifier = Modifier.align(Alignment.Center),
                    textAlign = TextAlign.Center,
                )
            }
        }
        2 -> {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                ChartPointLabel(labelEntries[0], zone, textAlign = TextAlign.Start)
                ChartPointLabel(labelEntries[1], zone, textAlign = TextAlign.End)
            }
        }
        else -> {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                ChartPointLabel(labelEntries[0], zone, textAlign = TextAlign.Start)
                ChartPointLabel(
                    entry = labelEntries[1],
                    zone = zone,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                ChartPointLabel(labelEntries[2], zone, textAlign = TextAlign.End)
            }
        }
    }
}

@Composable
private fun ChartPointLabel(
    entry: WeighIn,
    zone: ZoneId,
    modifier: Modifier = Modifier,
    textAlign: TextAlign = TextAlign.Start,
) {
    Column(modifier = modifier, horizontalAlignment = alignmentFor(textAlign)) {
        Text(
            text = DateTimeUtil.formatDisplayDate(entry.dateTime, zone),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = textAlign,
        )
        Text(
            text = String.format("%.1f lbs", entry.weight),
            style = MaterialTheme.typography.bodySmall,
            textAlign = textAlign,
        )
    }
}

private fun alignmentFor(textAlign: TextAlign) = when (textAlign) {
    TextAlign.Center -> Alignment.CenterHorizontally
    TextAlign.End, TextAlign.Right -> Alignment.End
    else -> Alignment.Start
}

private fun chartLabelEntries(weighIns: List<WeighIn>): List<WeighIn> {
    if (weighIns.isEmpty()) return emptyList()
    if (weighIns.size == 1) return listOf(weighIns[0])
    if (weighIns.size == 2) return listOf(weighIns.first(), weighIns.last())
    val middle = weighIns[weighIns.size / 2]
    return listOf(weighIns.first(), middle, weighIns.last())
}
