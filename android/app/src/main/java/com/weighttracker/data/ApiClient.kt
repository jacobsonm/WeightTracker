package com.weighttracker.data

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.POST
import retrofit2.http.Path

interface WeightTrackerApi {
    @GET("weigh-ins")
    suspend fun listWeighIns(): WeighInListResponse

    @POST("weigh-ins")
    suspend fun addWeighIn(@Body body: AddWeighInRequest): WeighIn

    @DELETE("weigh-ins/{dateTime}")
    suspend fun deleteWeighIn(@Path("dateTime") dateTime: String)

    @GET("profile")
    suspend fun getProfile(): UserProfile

    @PUT("profile")
    suspend fun putProfile(@Body body: ProfilePutRequest): UserProfile
}

class ApiClient(
    config: AppConfig,
    private val tokenStore: TokenStore,
) {
    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val authInterceptor = Interceptor { chain ->
        val token = tokenStore.idToken
            ?: throw IllegalStateException("Not authenticated")
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        chain.proceed(request)
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            },
        )
        .build()

    val api: WeightTrackerApi = Retrofit.Builder()
        .baseUrl(config.apiBaseUrl)
        .client(httpClient)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(WeightTrackerApi::class.java)
}
