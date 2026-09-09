package com.noctis.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.noctis.app.NoctisApplication
import com.noctis.app.image.ImagePipeline
import com.noctis.app.model.SUPPORTED_LANGUAGES
import com.noctis.app.ocr.MlKitOcrProvider
import com.noctis.app.translate.MlKitTranslationProvider
import com.noctis.app.ui.theme.*
import com.noctis.app.util.NoctisPreferences
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val app = context.applicationContext as NoctisApplication
    val prefs = remember { NoctisPreferences(context) }
    val scope = rememberCoroutineScope()

    var targetLang by remember { mutableStateOf(prefs.targetLanguage) }
    var translateImages by remember { mutableStateOf(prefs.translateImages) }
    var wifiOnly by remember { mutableStateOf(prefs.wifiOnlyModelDownloads) }
    var clearingCache by remember { mutableStateOf(false) }
    var langMenuExpanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().background(NoctisBg).verticalScroll(rememberScrollState())) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(12.dp)) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = null, tint = NoctisMuted) }
            Text("Configurações", color = NoctisInk, fontSize = 18.sp)
        }

        SettingsSection(title = "Idioma de destino padrão") {
            ExposedDropdownMenuBox(expanded = langMenuExpanded, onExpandedChange = { langMenuExpanded = it }) {
                OutlinedTextField(
                    value = SUPPORTED_LANGUAGES.firstOrNull { it.code == targetLang }?.label ?: targetLang,
                    onValueChange = {},
                    readOnly = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedContainerColor = NoctisCard, unfocusedContainerColor = NoctisCard),
                    modifier = Modifier.menuAnchor().fillMaxWidth(),
                )
                ExposedDropdownMenu(expanded = langMenuExpanded, onDismissRequest = { langMenuExpanded = false }) {
                    SUPPORTED_LANGUAGES.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            onClick = { targetLang = option.code; prefs.targetLanguage = option.code; langMenuExpanded = false },
                        )
                    }
                }
            }
        }

        SettingsSection(title = "Tradução de imagens") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(
                    checked = translateImages,
                    onCheckedChange = { translateImages = it; prefs.translateImages = it },
                    colors = SwitchDefaults.colors(checkedTrackColor = NoctisAccent),
                )
                Spacer(Modifier.width(8.dp))
                Text("Traduzir texto dentro de imagens (OCR local)", color = NoctisInk, fontSize = 13.sp)
            }
        }

        SettingsSection(title = "Download de modelos de tradução") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(
                    checked = wifiOnly,
                    onCheckedChange = { wifiOnly = it; prefs.wifiOnlyModelDownloads = it },
                    colors = SwitchDefaults.colors(checkedTrackColor = NoctisAccent),
                )
                Spacer(Modifier.width(8.dp))
                Text("Baixar apenas via Wi-Fi", color = NoctisInk, fontSize = 13.sp)
            }
            Text(
                "Os modelos de tradução do ML Kit (~30MB por idioma) ficam salvos no aparelho após o primeiro uso e funcionam offline depois disso.",
                color = NoctisMuted,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        SettingsSection(title = "Armazenamento") {
            Button(
                onClick = {
                    clearingCache = true
                    scope.launch {
                        app.database.ocrCacheDao().clear()
                        ImagePipeline(context, app.database, MlKitOcrProvider(), MlKitTranslationProvider { wifiOnly }).clearCache()
                        clearingCache = false
                    }
                },
                enabled = !clearingCache,
                colors = ButtonDefaults.buttonColors(containerColor = NoctisCard, contentColor = NoctisInk),
            ) {
                Text(if (clearingCache) "Limpando…" else "Limpar cache de OCR/imagens")
            }
        }

        SettingsSection(title = "Sobre") {
            Text(
                "Noctis 0.1.0 — tradução de páginas e imagens com OCR e tradução on-device (Google ML Kit). " +
                    "Nenhum dado de navegação é enviado a servidores do Noctis; o OCR e a tradução rodam localmente no aparelho.",
                color = NoctisMuted,
                fontSize = 12.sp,
            )
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
        Text(title, color = NoctisMuted, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        content()
    }
    HorizontalDivider(color = NoctisBorder)
}
