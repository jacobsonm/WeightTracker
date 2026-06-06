package com.weighttracker.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.weighttracker.data.AddWeighInRequest
import com.weighttracker.data.IntermediateGoal
import com.weighttracker.data.ProfilePutRequest
import com.weighttracker.data.ServiceLocator
import com.weighttracker.data.UserProfile
import com.weighttracker.data.WeighIn
import com.weighttracker.domain.ProgressSummary
import com.weighttracker.domain.ProgressCalculator
import com.weighttracker.util.DateTimeUtil
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.ZoneId
import java.time.ZonedDateTime

data class GoalFormRow(
    val weight: String = "",
    val label: String = "",
)

data class MainUiState(
    val isConfigured: Boolean = true,
    val isSignedIn: Boolean = false,
    val userLabel: String = "",
    val isLoading: Boolean = false,
    val statusMessage: String = "",
    val statusIsError: Boolean = false,
    val weighIns: List<WeighIn> = emptyList(),
    val profile: UserProfile? = null,
    val progressSummary: ProgressSummary = ProgressSummary(hasWeighIns = false),
    val addWeightInput: String = "",
    val addDateTime: ZonedDateTime = ZonedDateTime.now(),
    val profileUsername: String = "",
    val profileBirthdate: String = "",
    val profileSex: String = "male",
    val profileHeight: String = "",
    val profileTimezone: String = "",
    val profileTarget: String = "",
    val profileGoals: List<GoalFormRow> = emptyList(),
    val idealWeightText: String? = null,
    val deleteConfirmWeighIn: WeighIn? = null,
)

class MainViewModel(
    private val services: ServiceLocator,
) : ViewModel() {
    private val _uiState = MutableStateFlow(
        MainUiState(
            isConfigured = services.config.isConfigured,
            isSignedIn = services.authManager.isAuthenticated(),
            userLabel = if (services.authManager.isAuthenticated()) {
                services.authManager.getUserDisplayName()
            } else {
                ""
            },
        ),
    )
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        if (_uiState.value.isSignedIn) {
            refreshAll()
        }
    }

    fun refreshAll() {
        viewModelScope.launch {
            setLoading(true)
            try {
                val profile = loadProfile()
                val weighIns = services.apiClient.api.listWeighIns().weighIns
                applyData(profile, weighIns)
                setStatus("Loaded ${weighIns.size} weigh-in(s).", error = false)
            } catch (e: Exception) {
                setStatus(e.message ?: "Failed to load data", error = true)
            } finally {
                setLoading(false)
            }
        }
    }

    fun onSignedIn() {
        _uiState.update {
            it.copy(
                isSignedIn = true,
                userLabel = services.authManager.getUserDisplayName(),
            )
        }
        refreshAll()
    }

    fun reportError(message: String) {
        setStatus(message, error = true)
    }

    fun signOut() {
        services.authManager.signOut()
        _uiState.value = MainUiState(isConfigured = services.config.isConfigured)
    }

    fun updateAddWeight(value: String) {
        _uiState.update { it.copy(addWeightInput = value) }
    }

    fun updateAddDateTime(dateTime: ZonedDateTime) {
        _uiState.update { it.copy(addDateTime = dateTime) }
    }

    fun addWeighIn() {
        val weight = _uiState.value.addWeightInput.toDoubleOrNull()
        if (weight == null || weight <= 0) {
            setStatus("Enter a valid weight.", error = true)
            return
        }
        viewModelScope.launch {
            setLoading(true)
            try {
                val zone = DateTimeUtil.profileTimezone(_uiState.value.profile?.timezone)
                val dateTime = DateTimeUtil.localInputToUtcIso(_uiState.value.addDateTime)
                services.apiClient.api.addWeighIn(AddWeighInRequest(dateTime, weight))
                _uiState.update {
                    it.copy(
                        addWeightInput = "",
                        addDateTime = DateTimeUtil.nowForInput(zone),
                    )
                }
                refreshAll()
                setStatus("Weigh-in saved.", error = false)
            } catch (e: Exception) {
                setStatus(e.message ?: "Failed to save weigh-in", error = true)
            } finally {
                setLoading(false)
            }
        }
    }

    fun requestDelete(entry: WeighIn) {
        _uiState.update { it.copy(deleteConfirmWeighIn = entry) }
    }

    fun dismissDelete() {
        _uiState.update { it.copy(deleteConfirmWeighIn = null) }
    }

    fun confirmDelete() {
        val entry = _uiState.value.deleteConfirmWeighIn ?: return
        viewModelScope.launch {
            setLoading(true)
            try {
                val encoded = URLEncoder.encode(entry.dateTime, StandardCharsets.UTF_8.toString())
                services.apiClient.api.deleteWeighIn(encoded)
                dismissDelete()
                refreshAll()
                setStatus("Weigh-in deleted.", error = false)
            } catch (e: Exception) {
                setStatus(e.message ?: "Failed to delete", error = true)
            } finally {
                setLoading(false)
            }
        }
    }

    fun bindProfileForm(profile: UserProfile?) {
        if (profile == null) {
            val zone = ZoneId.systemDefault().id
            _uiState.update {
                it.copy(
                    profileUsername = "",
                    profileBirthdate = "",
                    profileSex = "male",
                    profileHeight = "",
                    profileTimezone = zone,
                    profileTarget = "",
                    profileGoals = emptyList(),
                    idealWeightText = null,
                )
            }
            return
        }
        _uiState.update {
            it.copy(
                profileUsername = profile.username,
                profileBirthdate = profile.birthdate,
                profileSex = profile.sex,
                profileHeight = profile.heightInches.toString(),
                profileTimezone = profile.timezone,
                profileTarget = profile.targetWeight?.toString() ?: "",
                profileGoals = profile.intermediateGoals?.map { goal ->
                    GoalFormRow(
                        weight = goal.weight.toString(),
                        label = goal.label ?: "",
                    )
                } ?: emptyList(),
                idealWeightText = formatIdealWeight(profile),
            )
        }
    }

    fun updateProfileField(update: MainUiState.() -> MainUiState) {
        _uiState.update(update)
    }

    fun addGoalRow() {
        _uiState.update { it.copy(profileGoals = it.profileGoals + GoalFormRow()) }
    }

    fun removeGoalRow(index: Int) {
        _uiState.update {
            it.copy(profileGoals = it.profileGoals.filterIndexed { i, _ -> i != index })
        }
    }

    fun saveProfile() {
        val state = _uiState.value
        val height = state.profileHeight.toDoubleOrNull()
        if (state.profileUsername.isBlank() || state.profileBirthdate.isBlank() ||
            height == null || state.profileTimezone.isBlank()
        ) {
            setStatus("Complete required profile fields.", error = true)
            return
        }
        val goals = state.profileGoals.mapNotNull { row ->
            val weight = row.weight.toDoubleOrNull() ?: return@mapNotNull null
            if (row.label.isBlank()) IntermediateGoal(weight) else IntermediateGoal(weight, row.label)
        }
        val target = state.profileTarget.trim().takeIf { it.isNotEmpty() }?.toDoubleOrNull()
        viewModelScope.launch {
            setLoading(true)
            try {
                val profile = services.apiClient.api.putProfile(
                    ProfilePutRequest(
                        username = state.profileUsername.trim(),
                        birthdate = state.profileBirthdate,
                        sex = state.profileSex,
                        heightInches = height,
                        timezone = state.profileTimezone.trim(),
                        targetWeight = target,
                        intermediateGoals = goals,
                    ),
                )
                val weighIns = _uiState.value.weighIns
                applyData(profile, weighIns)
                setStatus("Profile saved.", error = false)
            } catch (e: Exception) {
                setStatus(e.message ?: "Failed to save profile", error = true)
            } finally {
                setLoading(false)
            }
        }
    }

    private suspend fun loadProfile(): UserProfile? {
        return try {
            services.apiClient.api.getProfile()
        } catch (e: HttpException) {
            if (e.code() == 404) null else throw e
        }
    }

    private fun applyData(profile: UserProfile?, weighIns: List<WeighIn>) {
        val zone = DateTimeUtil.profileTimezone(profile?.timezone)
        _uiState.update {
            it.copy(
                profile = profile,
                weighIns = weighIns.sortedBy { w -> w.dateTime },
                progressSummary = ProgressCalculator.compute(weighIns, profile),
                addDateTime = DateTimeUtil.nowForInput(zone),
            )
        }
        bindProfileForm(profile)
    }

    private fun formatIdealWeight(profile: UserProfile): String? {
        val ideal = profile.idealWeight ?: return null
        val range = profile.idealWeightRange
        val rangeText = range?.let { r -> " (healthy BMI range: ${r.min}–${r.max} lbs)" } ?: ""
        return "Estimated ideal weight: $ideal lbs$rangeText"
    }

    private fun setLoading(loading: Boolean) {
        _uiState.update { it.copy(isLoading = loading) }
    }

    private fun setStatus(message: String, error: Boolean) {
        _uiState.update { it.copy(statusMessage = message, statusIsError = error) }
    }
}
