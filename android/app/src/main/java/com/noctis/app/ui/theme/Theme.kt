package com.noctis.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val NoctisBg = Color(0xFF0B0F14)
val NoctisSurface = Color(0xFF111820)
val NoctisCard = Color(0xFF18212B)
val NoctisBorder = Color(0xFF263340)
val NoctisInk = Color(0xFFF1F5F9)
val NoctisMuted = Color(0xFF94A3B8)
val NoctisAccent = Color(0xFF00E5A0)
val NoctisAccentDark = Color(0xFF00B981)

private val NoctisColorScheme = darkColorScheme(
    background = NoctisBg,
    surface = NoctisSurface,
    surfaceVariant = NoctisCard,
    primary = NoctisAccent,
    onPrimary = NoctisBg,
    secondary = NoctisAccentDark,
    onBackground = NoctisInk,
    onSurface = NoctisInk,
    outline = NoctisBorder,
)

@Composable
fun NoctisTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = NoctisColorScheme, content = content)
}
