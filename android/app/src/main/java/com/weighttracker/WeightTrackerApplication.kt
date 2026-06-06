package com.weighttracker

import android.app.Application
import com.weighttracker.data.ServiceLocator

class WeightTrackerApplication : Application() {
    lateinit var services: ServiceLocator
        private set

    override fun onCreate() {
        super.onCreate()
        services = ServiceLocator(this)
    }
}
