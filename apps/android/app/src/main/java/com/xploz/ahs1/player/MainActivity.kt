package com.xploz.ahs1.player

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.xploz.ahs1.player.data.PlayerRepository
import com.xploz.ahs1.player.data.TokenStore
import com.xploz.ahs1.player.data.remote.ApiClient
import com.xploz.ahs1.player.playback.AudioService
import com.xploz.ahs1.player.playback.PlaybackUiState
import com.xploz.ahs1.player.ui.activation.ActivationScreen
import com.xploz.ahs1.player.ui.home.HomeScreen
import com.xploz.ahs1.player.ui.theme.AHS1Theme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var tokenStore: TokenStore
    private lateinit var repository: PlayerRepository

    private var audioService: AudioService? = null
    private var isServiceBound = false

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* pas bloquant si refusée */ }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            audioService = (binder as AudioService.LocalBinder).getService()
            isServiceBound = true
            syncAndLoadQueue()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            audioService = null
            isServiceBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        tokenStore = TokenStore(this)
        repository = PlayerRepository(ApiClient.create(tokenStore), tokenStore)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            AHS1Theme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var isActivated by remember { mutableStateOf(tokenStore.isActivated) }

                    LaunchedEffect(isActivated) {
                        if (isActivated) startAndBindService()
                    }

                    if (isActivated) {
                        val uiState by (audioService?.uiState?.collectAsState()
                            ?: remember { kotlinx.coroutines.flow.MutableStateFlow(PlaybackUiState()) }.collectAsState())
                        HomeScreen(storeName = tokenStore.storeName, uiState = uiState)
                    } else {
                        ActivationScreen(
                            repository = repository,
                            onActivated = { isActivated = true }
                        )
                    }
                }
            }
        }
    }

    private fun startAndBindService() {
        val intent = Intent(this, AudioService::class.java)
        startForegroundService(intent)
        bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    private fun syncAndLoadQueue() {
        lifecycleScope.launch {
            val sync = repository.fetchSync() ?: return@launch
            audioService?.loadQueue(sync.files)
        }
    }

    override fun onDestroy() {
        if (isServiceBound) {
            unbindService(connection)
            isServiceBound = false
        }
        super.onDestroy()
    }
}
