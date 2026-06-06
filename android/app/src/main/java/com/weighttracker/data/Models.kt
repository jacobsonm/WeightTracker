package com.weighttracker.data

import com.squareup.moshi.Json

data class WeighIn(
    @Json(name = "DateTime") val dateTime: String,
    @Json(name = "weight") val weight: Double,
)

data class WeighInListResponse(
    @Json(name = "weighIns") val weighIns: List<WeighIn> = emptyList(),
)

data class AddWeighInRequest(
    @Json(name = "DateTime") val dateTime: String,
    @Json(name = "weight") val weight: Double,
)

data class IntermediateGoal(
    @Json(name = "weight") val weight: Double,
    @Json(name = "label") val label: String? = null,
)

data class IdealWeightRange(
    @Json(name = "min") val min: Double,
    @Json(name = "max") val max: Double,
)

data class UserProfile(
    @Json(name = "username") val username: String,
    @Json(name = "birthdate") val birthdate: String,
    @Json(name = "sex") val sex: String,
    @Json(name = "heightInches") val heightInches: Double,
    @Json(name = "timezone") val timezone: String,
    @Json(name = "targetWeight") val targetWeight: Double? = null,
    @Json(name = "intermediateGoals") val intermediateGoals: List<IntermediateGoal>? = null,
    @Json(name = "idealWeight") val idealWeight: Double? = null,
    @Json(name = "idealWeightRange") val idealWeightRange: IdealWeightRange? = null,
)

data class ProfilePutRequest(
    @Json(name = "username") val username: String,
    @Json(name = "birthdate") val birthdate: String,
    @Json(name = "sex") val sex: String,
    @Json(name = "heightInches") val heightInches: Double,
    @Json(name = "timezone") val timezone: String,
    @Json(name = "targetWeight") val targetWeight: Double? = null,
    @Json(name = "intermediateGoals") val intermediateGoals: List<IntermediateGoal> = emptyList(),
)
