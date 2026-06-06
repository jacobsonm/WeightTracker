package com.weighttracker.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.weighttracker.data.ServiceLocator

class MainViewModelFactory(
    private val services: ServiceLocator,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MainViewModel::class.java)) {
            return MainViewModel(services) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
