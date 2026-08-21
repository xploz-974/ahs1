package com.xploz.ahs1.player.playback

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.xploz.ahs1.player.AhsApplication
import com.xploz.ahs1.player.MainActivity
import com.xploz.ahs1.player.data.PlayerRepository
import com.xploz.ahs1.player.data.TokenStore
import com.xploz.ahs1.player.data.remote.ApiClient
import com.xploz.ahs1.player.data.remote.PlaybackEvent
import com.xploz.ahs1.player.data.remote.SyncFile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

data class PlaybackUiState(
    val isPlaying: Boolean = false,
    val currentTitle: String? = null,
    val currentArtist: String? = null,
    val nextTitle: String? = null,
    val queueSize: Int = 0
)

// Foreground Service : la lecture continue écran éteint / app en arrière-plan
// (§36). Reste volontairement simple pour cette version "en ligne" — pas de
// cache local (Phase 10), pas de fondu (les points de coupe trim_start/
// trim_end sont appliqués via ClippingConfiguration, les fondus viendront
// avec un AudioProcessor dédié plus tard).
class AudioService : Service() {

    private val binder = LocalBinder()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var player: ExoPlayer
    private lateinit var repository: PlayerRepository
    private var queue: List<SyncFile> = emptyList()

    private val _uiState = MutableStateFlow(PlaybackUiState())
    val uiState: StateFlow<PlaybackUiState> = _uiState.asStateFlow()

    inner class LocalBinder : Binder() {
        fun getService(): AudioService = this@AudioService
    }

    override fun onCreate() {
        super.onCreate()
        player = ExoPlayer.Builder(this).build()
        player.repeatMode = Player.REPEAT_MODE_ALL

        val tokenStore = TokenStore(this)
        repository = PlayerRepository(ApiClient.create(tokenStore), tokenStore)

        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                reportCurrentTrack()
                updateUiState()
                updateNotification()
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                updateUiState()
            }
        })

        startForeground(NOTIFICATION_ID, buildNotification())
        startHeartbeatLoop()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    fun loadQueue(files: List<SyncFile>) {
        queue = files.filter { it.category == "music" && it.url != null }
        if (queue.isEmpty()) return

        val items = queue.map { file ->
            MediaItem.Builder()
                .setUri(file.url)
                .setMediaId(file.id)
                .setClippingConfiguration(
                    MediaItem.ClippingConfiguration.Builder()
                        .setStartPositionMs(file.trim_start_ms)
                        .apply { file.trim_end_ms?.let { setEndPositionMs(it) } }
                        .build()
                )
                .build()
        }
        player.setMediaItems(items)
        player.prepare()
        player.playWhenReady = true
        updateUiState()
    }

    private fun reportCurrentTrack() {
        val file = queue.getOrNull(player.currentMediaItemIndex) ?: return
        scope.launch {
            repository.sendPlaybackEvent(
                PlaybackEvent(
                    client_event_id = UUID.randomUUID().toString(),
                    type = "MUSIC",
                    audio_id = file.id,
                    played_at = Instant.now().toString(),
                    duration_ms = file.duration_ms
                )
            )
        }
    }

    private fun startHeartbeatLoop() {
        scope.launch {
            while (true) {
                val currentTitle = queue.getOrNull(player.currentMediaItemIndex)?.title
                repository.sendHeartbeat(currentTrack = currentTitle, cacheStatus = "OK")
                delay(HEARTBEAT_INTERVAL_MS)
            }
        }
    }

    private fun updateUiState() {
        val index = player.currentMediaItemIndex
        val current = queue.getOrNull(index)
        val next = queue.getOrNull(index + 1) ?: queue.getOrNull(0)
        _uiState.value = PlaybackUiState(
            isPlaying = player.isPlaying,
            currentTitle = current?.title,
            currentArtist = null,
            nextTitle = next?.title,
            queueSize = queue.size
        )
    }

    private fun buildNotification(): Notification {
        val openApp = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val current = queue.getOrNull(player.currentMediaItemIndex)
        return NotificationCompat.Builder(this, AhsApplication.PLAYBACK_CHANNEL_ID)
            .setContentTitle(current?.title ?: "AHS1 — En attente")
            .setContentText("Diffusion en cours")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(openApp)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification() {
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, buildNotification())
    }

    override fun onDestroy() {
        player.release()
        super.onDestroy()
    }

    companion object {
        private const val NOTIFICATION_ID = 1
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
    }
}
