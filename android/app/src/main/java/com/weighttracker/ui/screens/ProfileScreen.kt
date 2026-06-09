package com.weighttracker.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.weighttracker.ui.GoalFormRow
import com.weighttracker.util.ProfileOptions

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(
    username: String,
    birthdate: String,
    sex: String,
    height: String,
    timezone: String,
    target: String,
    goals: List<GoalFormRow>,
    idealWeightText: String?,
    onUsernameChange: (String) -> Unit,
    onBirthdateChange: (String) -> Unit,
    onSexChange: (String) -> Unit,
    onHeightChange: (String) -> Unit,
    onTimezoneChange: (String) -> Unit,
    onTargetChange: (String) -> Unit,
    onGoalWeightChange: (Int, String) -> Unit,
    onGoalLabelChange: (Int, String) -> Unit,
    onAddGoal: () -> Unit,
    onRemoveGoal: (Int) -> Unit,
    onSave: () -> Unit,
) {
    val timezoneOptions = remember { ProfileOptions.timezoneOptions() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Profile", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(
                    value = username,
                    onValueChange = onUsernameChange,
                    label = { Text("Display name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = birthdate,
                    onValueChange = onBirthdateChange,
                    label = { Text("Birthdate (YYYY-MM-DD)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )

                Text("Sex", style = MaterialTheme.typography.labelLarge)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ProfileOptions.sexOptions.forEach { option ->
                        FilterChip(
                            selected = sex == option,
                            onClick = { onSexChange(option) },
                            label = { Text(ProfileOptions.sexLabel(option)) },
                        )
                    }
                }

                OutlinedTextField(
                    value = height,
                    onValueChange = onHeightChange,
                    label = { Text("Height (inches)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )

                TimezonePicker(
                    value = timezone,
                    options = timezoneOptions,
                    onValueChange = onTimezoneChange,
                )

                idealWeightText?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall)
                }
                OutlinedTextField(
                    value = target,
                    onValueChange = onTargetChange,
                    label = { Text("Target weight (lbs)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                Text("Intermediate goals (lbs)", style = MaterialTheme.typography.labelLarge)
                goals.forEachIndexed { index, goal ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedTextField(
                            modifier = Modifier.weight(1f),
                            value = goal.weight,
                            onValueChange = { onGoalWeightChange(index, it) },
                            label = { Text("Weight") },
                            singleLine = true,
                        )
                        OutlinedTextField(
                            modifier = Modifier.weight(1f),
                            value = goal.label,
                            onValueChange = { onGoalLabelChange(index, it) },
                            label = { Text("Label") },
                            singleLine = true,
                        )
                        TextButton(onClick = { onRemoveGoal(index) }) {
                            Text("Remove")
                        }
                    }
                }
                TextButton(onClick = onAddGoal) { Text("Add goal") }
                Button(onClick = onSave, modifier = Modifier.fillMaxWidth()) {
                    Text("Save profile")
                }
                Text(
                    "Ideal weight is estimated from height and sex (Devine formula). Goals appear as lines on the chart in History.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimezonePicker(
    value: String,
    options: List<String>,
    onValueChange: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val displayValue = value.ifBlank { "Select timezone" }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = Modifier.fillMaxWidth(),
    ) {
        OutlinedTextField(
            value = displayValue,
            onValueChange = {},
            readOnly = true,
            label = { Text("Timezone") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth(),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { zone ->
                DropdownMenuItem(
                    text = { Text(zone) },
                    onClick = {
                        onValueChange(zone)
                        expanded = false
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                )
            }
        }
    }
}
