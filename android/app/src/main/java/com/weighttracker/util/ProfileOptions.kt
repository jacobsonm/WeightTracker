package com.weighttracker.util

import java.time.ZoneId

object ProfileOptions {
    val sexOptions = listOf("male", "female", "other")

    fun sexLabel(value: String): String =
        value.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }

    fun timezoneOptions(): List<String> = ZoneId.getAvailableZoneIds().sorted()
}
