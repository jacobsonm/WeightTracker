package com.weighttracker.ui.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.weighttracker.domain.ProgressSummary
import com.weighttracker.ui.components.ProgressSummaryCard
import com.weighttracker.util.DateTimeUtil
import java.time.ZonedDateTime

@Composable
fun HomeScreen(
    weightInput: String,
    dateTime: ZonedDateTime,
    timezone: String?,
    progressSummary: ProgressSummary,
    onWeightChange: (String) -> Unit,
    onDateTimeChange: (ZonedDateTime) -> Unit,
    onSaveWeighIn: () -> Unit,
) {
    val context = LocalContext.current
    val zone = DateTimeUtil.profileTimezone(timezone)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Add weigh-in", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = weightInput,
                    onValueChange = onWeightChange,
                    label = { Text("Weight (lbs)") },
                    singleLine = true,
                )
                Text(
                    text = DateTimeUtil.formatDisplayDateTime(
                        DateTimeUtil.localInputToUtcIso(dateTime),
                        zone,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            DatePickerDialog(
                                context,
                                { _, year, month, day ->
                                    onDateTimeChange(
                                        dateTime.withYear(year).withMonth(month + 1).withDayOfMonth(day),
                                    )
                                },
                                dateTime.year,
                                dateTime.monthValue - 1,
                                dateTime.dayOfMonth,
                            ).show()
                        },
                    ) {
                        Text("Change date")
                    }
                    OutlinedButton(
                        onClick = {
                            TimePickerDialog(
                                context,
                                { _, hour, minute ->
                                    onDateTimeChange(
                                        dateTime.withHour(hour).withMinute(minute).withSecond(0).withNano(0),
                                    )
                                },
                                dateTime.hour,
                                dateTime.minute,
                                false,
                            ).show()
                        },
                    ) {
                        Text("Change time")
                    }
                }
                Text(
                    text = "Uses your profile timezone. Saving again with the same date and time updates that entry.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Button(onClick = onSaveWeighIn, modifier = Modifier.fillMaxWidth()) {
                    Text("Save weigh-in")
                }
            }
        }

        ProgressSummaryCard(progressSummary)
    }
}
