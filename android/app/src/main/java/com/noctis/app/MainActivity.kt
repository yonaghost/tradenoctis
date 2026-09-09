package com.noctis.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.noctis.app.ui.screens.HomeScreen
import com.noctis.app.ui.screens.SettingsScreen
import com.noctis.app.ui.screens.TranslatorScreen
import com.noctis.app.ui.theme.NoctisTheme
import com.noctis.app.util.NoctisPreferences

private sealed class Screen {
    data object Home : Screen()
    data object Settings : Screen()
    data class Translator(val url: String, val lang: String) : Screen()
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NoctisTheme {
                val prefs = remember { NoctisPreferences(this) }
                var screen by remember { mutableStateOf<Screen>(Screen.Home) }

                when (val current = screen) {
                    is Screen.Home -> HomeScreen(
                        initialTargetLang = prefs.targetLanguage,
                        onTranslate = { url, lang ->
                            prefs.targetLanguage = lang
                            screen = Screen.Translator(url, lang)
                        },
                        onOpenSettings = { screen = Screen.Settings },
                    )
                    is Screen.Settings -> SettingsScreen(onBack = { screen = Screen.Home })
                    is Screen.Translator -> TranslatorScreen(
                        initialUrl = current.url,
                        initialLang = current.lang,
                        onBack = { screen = Screen.Home },
                    )
                }
            }
        }
    }
}
