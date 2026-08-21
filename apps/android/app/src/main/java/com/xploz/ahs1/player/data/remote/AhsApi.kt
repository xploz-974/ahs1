package com.xploz.ahs1.player.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

data class EnrollRequest(val activation_code: String)

data class PlayerInfo(val id: String, val name: String, val type: String, val store: String?)

data class EnrollResponse(
    val access_token: String,
    val refresh_token: String,
    val expires_in: Int,
    val player: PlayerInfo
)

data class RefreshRequest(val refresh_token: String)
data class RefreshResponse(val access_token: String, val expires_in: Int)

data class StoreInfo(val id: String, val name: String, val timezone: String)
data class ConfigPlayer(
    val id: String,
    val name: String,
    val type: String,
    val status: String,
    val app_version: String?,
    val configuration: Map<String, Any>,
    val stores: StoreInfo?
)
data class ConfigResponse(val player: ConfigPlayer)

data class ManifestResponse(
    val music_version: Int,
    val advertisements_version: Int,
    val jingles_version: Int,
    val playlist_version: Int,
    val updated_at: String?
)

data class SyncFile(
    val id: String,
    val title: String,
    val category: String,
    val format: String,
    val checksum: String,
    val size: Long,
    val duration_ms: Long,
    val trim_start_ms: Long,
    val trim_end_ms: Long?,
    val fade_in_ms: Long,
    val fade_out_ms: Long,
    val url: String?
)
data class SyncResponse(val manifest: ManifestResponse?, val files: List<SyncFile>)

data class HeartbeatRequest(
    val network: String? = null,
    val current_track: String? = null,
    val current_ad: String? = null,
    val storage_available: Long? = null,
    val cache_status: String = "OK",
    val app_version: String? = null
)
data class HeartbeatResponse(val ok: Boolean, val status: String)

data class PlaybackEvent(
    val client_event_id: String,
    val type: String, // MUSIC | ADVERTISEMENT | JINGLE
    val audio_id: String?,
    val campaign_id: String? = null,
    val played_at: String,
    val duration_ms: Long?,
    val status: String = "COMPLETED"
)
data class PlaybackRequest(val events: List<PlaybackEvent>)
data class PlaybackResponse(val ok: Boolean, val received: Int, val inserted: Int?)

interface AhsApi {
    @POST("api/player/enroll")
    suspend fun enroll(@Body body: EnrollRequest): Response<EnrollResponse>

    @POST("api/player/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<RefreshResponse>

    @GET("api/player/config")
    suspend fun config(): Response<ConfigResponse>

    @GET("api/player/manifest")
    suspend fun manifest(): Response<ManifestResponse>

    @GET("api/player/sync")
    suspend fun sync(): Response<SyncResponse>

    @POST("api/player/heartbeat")
    suspend fun heartbeat(@Body body: HeartbeatRequest): Response<HeartbeatResponse>

    @POST("api/player/playback")
    suspend fun playback(@Body body: PlaybackRequest): Response<PlaybackResponse>
}
