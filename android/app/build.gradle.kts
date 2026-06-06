import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

fun prop(name: String, default: String = ""): String =
    localProperties.getProperty(name, default).replace("\"", "\\\"")

android {
    namespace = "com.weighttracker"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.weighttracker"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "API_BASE_URL", "\"${prop("API_BASE_URL")}\"")
        buildConfigField("String", "COGNITO_REGION", "\"${prop("COGNITO_REGION")}\"")
        buildConfigField("String", "COGNITO_DOMAIN", "\"${prop("COGNITO_DOMAIN")}\"")
        buildConfigField("String", "COGNITO_CLIENT_ID", "\"${prop("COGNITO_CLIENT_ID")}\"")
        manifestPlaceholders["appAuthRedirectScheme"] = "weighttracker"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.okhttp.logging)
    implementation(libs.moshi)
    implementation(libs.appauth)
    implementation(libs.security.crypto)

    debugImplementation(libs.androidx.compose.ui.tooling.preview)
}
