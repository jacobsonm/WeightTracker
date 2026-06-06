package com.weighttracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.weighttracker.ui.ConfigErrorScreen
import com.weighttracker.ui.MainViewModel
import com.weighttracker.ui.MainViewModelFactory
import com.weighttracker.ui.SignInScreen
import com.weighttracker.ui.WeightTrackerApp
import com.weighttracker.ui.WeightTrackerTheme

class MainActivity : ComponentActivity() {
    private val services by lazy { (application as WeightTrackerApplication).services }

    private val viewModel: MainViewModel by viewModels {
        MainViewModelFactory(services)
    }

    private val authLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        services.authManager.handleAuthorizationResponse(result.data) { authResult ->
            authResult.onSuccess { viewModel.onSignedIn() }
                .onFailure { e ->
                    viewModel.reportError(e.message ?: "Sign-in failed")
                }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WeightTrackerTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val state by viewModel.uiState.collectAsState()
                    when {
                        !state.isConfigured -> ConfigErrorScreen(
                            message = "Copy android/local.properties.example to local.properties, " +
                                "fill in CDK outputs, then rebuild the app.",
                        )
                        !state.isSignedIn -> SignInScreen(
                            onSignIn = {
                                authLauncher.launch(services.authManager.createSignInIntent())
                            },
                        )
                        state.isLoading && state.weighIns.isEmpty() && state.profile == null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        }
                        else -> WeightTrackerApp(
                            viewModel = viewModel,
                            onSignOut = { viewModel.signOut() },
                        )
                    }
                }
            }
        }
    }
}
