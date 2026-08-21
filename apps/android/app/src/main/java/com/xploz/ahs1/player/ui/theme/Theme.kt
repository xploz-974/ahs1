package com.xploz.ahs1.player.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Reprend la palette du dashboard web (signal-teal sur fond sombre) pour une
// identité visuelle cohérente entre Cloud et Player.
private val Signal = Color(0xFF3DDBC4)
private val Ink950 = Color(0xFF0B0F14)
private val Ink900 = Color(0xFF11161D)
private val Ink100 = Color(0xFFE8ECF1)

private val AhsColorScheme = darkColorScheme(
    primary = Signal,
    background = Ink950,
    surface = Ink900,
    onBackground = Ink100,
    onSurface = Ink100
)

@Composable
fun AHS1Theme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AhsColorScheme,
        content = content
    )
}
