package com.weighttracker.data

import com.weighttracker.BuildConfig

class AppConfig {
    val apiBaseUrl: String = normalizeBaseUrl(BuildConfig.API_BASE_URL)
    val cognitoRegion: String = BuildConfig.COGNITO_REGION.trim()
    val cognitoDomain: String = normalizeCognitoDomain(BuildConfig.COGNITO_DOMAIN.trim())
    val cognitoClientId: String = BuildConfig.COGNITO_CLIENT_ID.trim()

    val redirectUri: String = "weighttracker://callback"
    val logoutUri: String = "weighttracker://logout"

    val isConfigured: Boolean =
        apiBaseUrl.isNotBlank() &&
            cognitoRegion.isNotBlank() &&
            cognitoDomain.isNotBlank() &&
            cognitoClientId.isNotBlank()

    private fun normalizeBaseUrl(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return ""
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

    private fun normalizeCognitoDomain(domain: String): String {
        if (domain.isEmpty()) return ""
        return if (domain.contains(".amazoncognito.com")) {
            domain
        } else {
            "$domain.auth.$cognitoRegion.amazoncognito.com"
        }
    }
}
