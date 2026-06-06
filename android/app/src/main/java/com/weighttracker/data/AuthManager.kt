package com.weighttracker.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues
import org.json.JSONObject
import java.util.Base64

class AuthManager(
    private val context: Context,
    private val config: AppConfig,
    private val tokenStore: TokenStore,
) {
    private val authService: AuthorizationService by lazy { AuthorizationService(context) }

    private val serviceConfig: AuthorizationServiceConfiguration by lazy {
        val base = "https://${config.cognitoDomain}"
        AuthorizationServiceConfiguration(
            Uri.parse("$base/oauth2/authorize"),
            Uri.parse("$base/oauth2/token"),
        )
    }

    fun isAuthenticated(): Boolean = tokenStore.isAuthenticated()

    fun getUserDisplayName(): String {
        val token = tokenStore.idToken ?: return "Signed in"
        return parseJwtPayload(token)?.let { payload ->
            payload.optString("email").takeIf { it.isNotBlank() }
                ?: payload.optString("cognito:username").takeIf { it.isNotBlank() }
                ?: payload.optString("sub").takeIf { it.isNotBlank() }
        } ?: "Signed in"
    }

    fun createSignInIntent(): Intent {
        val redirectUri = Uri.parse(config.redirectUri)
        val request = AuthorizationRequest.Builder(
            serviceConfig,
            config.cognitoClientId,
            ResponseTypeValues.CODE,
            redirectUri,
        )
            .setScopes("openid", "email", "profile")
            .build()

        return authService.getAuthorizationRequestIntent(request)
    }

    fun handleAuthorizationResponse(data: Intent?, onComplete: (Result<Unit>) -> Unit) {
        val response = data?.let { AuthorizationResponse.fromIntent(it) }
        val ex = data?.let { AuthorizationException.fromIntent(it) }
        handleAuthResponse(response, ex, onComplete)
    }

    private fun handleAuthResponse(
        response: AuthorizationResponse?,
        ex: AuthorizationException?,
        onComplete: (Result<Unit>) -> Unit,
    ) {
        when {
            ex != null -> onComplete(Result.failure(Exception(ex.errorDescription ?: ex.error)))
            response == null -> onComplete(Result.failure(IllegalStateException("No authorization response")))
            else -> {
                val tokenRequest = response.createTokenExchangeRequest()
                authService.performTokenRequest(tokenRequest) { tokenResponse, tokenEx ->
                    when {
                        tokenEx != null -> onComplete(
                            Result.failure(Exception(tokenEx.errorDescription ?: tokenEx.error)),
                        )
                        tokenResponse == null -> onComplete(
                            Result.failure(IllegalStateException("No token response")),
                        )
                        else -> {
                            tokenStore.idToken = tokenResponse.idToken
                            tokenStore.accessToken = tokenResponse.accessToken
                            tokenStore.refreshToken = tokenResponse.refreshToken
                            tokenStore.expiresAtEpochMs = tokenResponse.accessTokenExpirationTime
                                ?: (System.currentTimeMillis() + 3600_000L)
                            onComplete(Result.success(Unit))
                        }
                    }
                }
            }
        }
    }

    fun signOut() {
        tokenStore.clear()
    }

    private fun parseJwtPayload(token: String): JSONObject? {
        return try {
            val payload = token.split('.')[1]
            val json = String(Base64.getUrlDecoder().decode(padded(payload)))
            JSONObject(json)
        } catch (_: Exception) {
            null
        }
    }

    private fun padded(value: String): String {
        val mod = value.length % 4
        return if (mod == 0) value else value + "=".repeat(4 - mod)
    }
}
