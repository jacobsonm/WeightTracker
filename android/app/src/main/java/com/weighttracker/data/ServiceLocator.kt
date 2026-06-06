package com.weighttracker.data

import android.content.Context

class ServiceLocator(context: Context) {
    val config = AppConfig()
    val tokenStore = TokenStore(context)
    val authManager = AuthManager(context, config, tokenStore)
    val apiClient = ApiClient(config, tokenStore)
}
