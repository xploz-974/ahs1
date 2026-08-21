package com.xploz.ahs1.player.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

// Stockage chiffré des tokens et de l'identité du player (§10 — "ne pas
// stocker les identifiants en clair"). Room/DataStore ne sont pas nécessaires
// ici : peu de valeurs, lues/écrites rarement.
class TokenStore(context: Context) {

    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        prefs = EncryptedSharedPreferences.create(
            context,
            "ahs1_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()

    var playerName: String?
        get() = prefs.getString(KEY_PLAYER_NAME, null)
        set(value) = prefs.edit().putString(KEY_PLAYER_NAME, value).apply()

    var storeName: String?
        get() = prefs.getString(KEY_STORE_NAME, null)
        set(value) = prefs.edit().putString(KEY_STORE_NAME, value).apply()

    val isActivated: Boolean
        get() = accessToken != null && refreshToken != null

    fun clear() {
        prefs.edit().clear().apply()
    }

    private companion object {
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
        const val KEY_PLAYER_NAME = "player_name"
        const val KEY_STORE_NAME = "store_name"
    }
}
