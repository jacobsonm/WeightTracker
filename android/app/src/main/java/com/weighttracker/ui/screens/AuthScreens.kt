package com.weighttracker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ConfigErrorScreen(message: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Configuration required", style = MaterialTheme.typography.headlineSmall)
        Text(
            modifier = Modifier.padding(top = 12.dp),
            text = message,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
fun SignInScreen(onSignIn: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Weight Tracker", style = MaterialTheme.typography.headlineMedium)
        Text(
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
            text = "Sign in with your Cognito account.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Button(onClick = onSignIn, modifier = Modifier.fillMaxWidth()) {
            Text("Sign in")
        }
    }
}
