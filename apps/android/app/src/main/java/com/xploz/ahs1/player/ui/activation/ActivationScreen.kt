package com.xploz.ahs1.player.ui.activation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.xploz.ahs1.player.data.ActivationResult
import com.xploz.ahs1.player.data.PlayerRepository
import kotlinx.coroutines.launch

@Composable
fun ActivationScreen(
    repository: PlayerRepository,
    onActivated: () -> Unit
) {
    var code by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Bienvenue sur AHS1",
            fontSize = 22.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onBackground
        )

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 32.dp))

        Text(
            text = "Code d'activation",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
        )

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))

        OutlinedTextField(
            value = code,
            onValueChange = { code = it.uppercase() },
            singleLine = true,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 24.dp))

        Button(
            onClick = {
                error = null
                isLoading = true
                scope.launch {
                    when (val result = repository.activate(code)) {
                        is ActivationResult.Success -> onActivated()
                        is ActivationResult.Error -> error = result.message
                    }
                    isLoading = false
                }
            },
            enabled = !isLoading && code.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.padding(2.dp))
            } else {
                Text("ACTIVER")
            }
        }

        error?.let {
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 16.dp))
            Text(text = it, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
        }
    }
}
