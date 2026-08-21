package com.xploz.ahs1.player.data

import android.os.Build
import com.xploz.ahs1.player.data.remote.AhsApi
import com.xploz.ahs1.player.data.remote.EnrollRequest
import com.xploz.ahs1.player.data.remote.HeartbeatRequest
import com.xploz.ahs1.player.data.remote.PlaybackEvent
import com.xploz.ahs1.player.data.remote.PlaybackRequest
import com.xploz.ahs1.player.data.remote.RefreshRequest
import com.xploz.ahs1.player.data.remote.SyncResponse
import retrofit2.Response

sealed class ActivationResult {
    data object Success : ActivationResult()
    data class Error(val message: String) : ActivationResult()
}

// Point d'entrée unique vers AHS1 API. Toute méthode authentifiée passe par
// [authorized], qui retente une fois après un /refresh en cas de 401 — c'est
// la seule gestion d'expiration nécessaire pour cette version basique
// (pas de file d'attente de requêtes concurrentes, un seul appelant à la fois).
class PlayerRepository(
    private val api: AhsApi,
    private val tokenStore: TokenStore
) {
    suspend fun activate(code: String): ActivationResult {
        return try {
            val response = api.enroll(EnrollRequest(code.trim()))
            val body = response.body()
            if (!response.isSuccessful || body == null) {
                return ActivationResult.Error(errorMessage(response))
            }
            tokenStore.accessToken = body.access_token
            tokenStore.refreshToken = body.refresh_token
            tokenStore.playerName = body.player.name
            tokenStore.storeName = body.player.store
            ActivationResult.Success
        } catch (e: Exception) {
            ActivationResult.Error(e.message ?: "Erreur réseau")
        }
    }

    suspend fun fetchSync(): SyncResponse? {
        val response = authorized { api.sync() } ?: return null
        return response.body()
    }

    suspend fun sendHeartbeat(currentTrack: String?, cacheStatus: String = "OK") {
        authorized {
            api.heartbeat(
                HeartbeatRequest(
                    network = "wifi",
                    current_track = currentTrack,
                    cache_status = cacheStatus,
                    app_version = "1.0.0"
                )
            )
        }
    }

    suspend fun sendPlaybackEvent(event: PlaybackEvent) {
        authorized { api.playback(PlaybackRequest(listOf(event))) }
    }

    /** Exécute [call] ; si la réponse est 401, tente un /refresh puis rejoue une fois. */
    private suspend fun <T> authorized(call: suspend () -> Response<T>): Response<T>? {
        val first = runCatching { call() }.getOrNull() ?: return null
        if (first.code() != 401) return first

        if (!refresh()) return null
        return runCatching { call() }.getOrNull()
    }

    private suspend fun refresh(): Boolean {
        val refreshToken = tokenStore.refreshToken ?: return false
        return try {
            val response = api.refresh(RefreshRequest(refreshToken))
            val body = response.body()
            if (!response.isSuccessful || body == null) {
                if (response.code() == 401) tokenStore.clear() // refresh token révoqué/expiré
                return false
            }
            tokenStore.accessToken = body.access_token
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun errorMessage(response: Response<*>): String = when (response.code()) {
        404 -> "Code d'activation invalide."
        409 -> "Ce player est déjà activé."
        410 -> "Code d'activation expiré — régénère-le depuis le dashboard."
        else -> "Échec de l'activation (${response.code()})."
    }

    companion object {
        val deviceLabel: String get() = "${Build.MANUFACTURER} ${Build.MODEL}"
    }
}
