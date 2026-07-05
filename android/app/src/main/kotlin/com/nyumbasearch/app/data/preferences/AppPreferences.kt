package com.nyumbasearch.app.data.preferences

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Encrypted preferences for session metadata and in-app settings. */
class AppPreferences(context: Context) {
    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var darkModeOverride: String?
        get() = prefs.getString(KEY_DARK_MODE, null)
        set(value) = prefs.edit().putString(KEY_DARK_MODE, value).apply()

    var lastViewedNeighborhood: String?
        get() = prefs.getString(KEY_LAST_HOOD, null)
        set(value) = prefs.edit().putString(KEY_LAST_HOOD, value).apply()

    companion object {
        private const val PREFS_NAME = "nyumba_secure_prefs"
        private const val KEY_DARK_MODE = "dark_mode_override"
        private const val KEY_LAST_HOOD = "last_viewed_neighborhood"
    }
}
