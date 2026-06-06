package com.weighttracker.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Accent = Color(0xFF0D7A6F)

private val AppColorScheme = lightColorScheme(
    primary = Accent,
    onPrimary = Color.White,
)

@Composable
fun WeightTrackerTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = AppColorScheme, content = content)
}
