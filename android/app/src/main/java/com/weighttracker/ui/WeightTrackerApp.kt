package com.weighttracker.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.weighttracker.ui.screens.HistoryScreen
import com.weighttracker.ui.screens.HomeScreen
import com.weighttracker.ui.screens.ProfileScreen

enum class AppTab(val route: String, val label: String) {
    Home("home", "Home"),
    Profile("profile", "Profile"),
    History("history", "History"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeightTrackerApp(viewModel: MainViewModel, onSignOut: () -> Unit) {
    val state by viewModel.uiState.collectAsState()
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route

    LaunchedEffect(state.statusMessage) {
        if (state.statusMessage.isNotBlank()) {
            snackbarHostState.showSnackbar(state.statusMessage)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Weight Tracker") },
                actions = {
                    Text(
                        modifier = Modifier.padding(end = 8.dp),
                        text = state.userLabel,
                    )
                    TextButton(onClick = onSignOut) {
                        Text("Sign out")
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                AppTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute == tab.route,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {
                            Icon(
                                when (tab) {
                                    AppTab.Home -> Icons.Default.Home
                                    AppTab.Profile -> Icons.Default.Person
                                    AppTab.History -> Icons.Default.History
                                },
                                contentDescription = tab.label,
                            )
                        },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = AppTab.Home.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(AppTab.Home.route) {
                HomeScreen(
                    weightInput = state.addWeightInput,
                    dateTime = state.addDateTime,
                    timezone = state.profile?.timezone,
                    progressSummary = state.progressSummary,
                    onWeightChange = viewModel::updateAddWeight,
                    onDateTimeChange = viewModel::updateAddDateTime,
                    onSaveWeighIn = viewModel::addWeighIn,
                )
            }
            composable(AppTab.Profile.route) {
                ProfileScreen(
                    username = state.profileUsername,
                    birthdate = state.profileBirthdate,
                    sex = state.profileSex,
                    height = state.profileHeight,
                    timezone = state.profileTimezone,
                    target = state.profileTarget,
                    goals = state.profileGoals,
                    idealWeightText = state.idealWeightText,
                    onUsernameChange = { v -> viewModel.updateProfileField { copy(profileUsername = v) } },
                    onBirthdateChange = { v -> viewModel.updateProfileField { copy(profileBirthdate = v) } },
                    onSexChange = { v -> viewModel.updateProfileField { copy(profileSex = v) } },
                    onHeightChange = { v -> viewModel.updateProfileField { copy(profileHeight = v) } },
                    onTimezoneChange = { v -> viewModel.updateProfileField { copy(profileTimezone = v) } },
                    onTargetChange = { v -> viewModel.updateProfileField { copy(profileTarget = v) } },
                    onGoalWeightChange = { index, value ->
                        viewModel.updateProfileField {
                            copy(
                                profileGoals = profileGoals.mapIndexed { i, row ->
                                    if (i == index) row.copy(weight = value) else row
                                },
                            )
                        }
                    },
                    onGoalLabelChange = { index, value ->
                        viewModel.updateProfileField {
                            copy(
                                profileGoals = profileGoals.mapIndexed { i, row ->
                                    if (i == index) row.copy(label = value) else row
                                },
                            )
                        }
                    },
                    onAddGoal = viewModel::addGoalRow,
                    onRemoveGoal = viewModel::removeGoalRow,
                    onSave = viewModel::saveProfile,
                )
            }
            composable(AppTab.History.route) {
                HistoryScreen(
                    weighIns = state.weighIns,
                    profile = state.profile,
                    deleteCandidate = state.deleteConfirmWeighIn,
                    onDeleteRequest = viewModel::requestDelete,
                    onDeleteConfirm = viewModel::confirmDelete,
                    onDeleteDismiss = viewModel::dismissDelete,
                )
            }
        }
    }
}
