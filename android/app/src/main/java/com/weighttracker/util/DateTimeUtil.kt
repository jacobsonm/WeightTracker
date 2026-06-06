package com.weighttracker.util

import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

object DateTimeUtil {
    fun profileTimezone(profileZone: String?): ZoneId {
        if (profileZone.isNullOrBlank()) {
            return ZoneId.systemDefault()
        }
        return try {
            ZoneId.of(profileZone)
        } catch (_: Exception) {
            ZoneId.systemDefault()
        }
    }

    fun formatDisplayDate(isoUtc: String, zoneId: ZoneId): String {
        val instant = Instant.parse(isoUtc)
        return DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
            .withLocale(Locale.getDefault())
            .format(instant.atZone(zoneId))
    }

    fun formatDisplayDateTime(isoUtc: String, zoneId: ZoneId): String {
        val instant = Instant.parse(isoUtc)
        val formatter = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withLocale(Locale.getDefault())
        return formatter.format(instant.atZone(zoneId))
    }

    fun nowForInput(zoneId: ZoneId): ZonedDateTime = ZonedDateTime.now(zoneId)

    fun localInputToUtcIso(local: ZonedDateTime): String {
        val instant = local.withZoneSameInstant(ZoneId.of("UTC")).toInstant()
        return DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            .withZone(ZoneId.of("UTC"))
            .format(instant)
    }
}
