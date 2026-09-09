package com.noctis.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.noctis.app.model.SUPPORTED_LANGUAGES
import com.noctis.app.ui.theme.*
import com.noctis.app.util.normalizeToUrl

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    initialTargetLang: String,
    onTranslate: (url: String, lang: String) -> Unit,
    onOpenSettings: () -> Unit,
) {
    var input by remember { mutableStateOf("") }
    var lang by remember { mutableStateOf(initialTargetLang) }
    var langMenuExpanded by remember { mutableStateOf(false) }

    fun submit() {
        val url = normalizeToUrl(input)
        if (url.isNotEmpty()) onTranslate(url, lang)
    }

    Box(modifier = Modifier.fillMaxSize().background(NoctisBg)) {
        IconButton(onClick = onOpenSettings, modifier = Modifier.align(Alignment.TopEnd).padding(12.dp)) {
            Icon(Icons.Filled.Settings, contentDescription = "Configurações", tint = NoctisMuted)
        }

        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("NOCTIS", color = NoctisInk, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(
                "Traduza páginas da internet no seu idioma.",
                color = NoctisMuted,
                fontSize = 15.sp,
                modifier = Modifier.padding(horizontal = 8.dp),
            )
            Spacer(Modifier.height(24.dp))

            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Cole uma URL ou pesquise…", color = NoctisMuted) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { submit() }),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = NoctisCard,
                    unfocusedContainerColor = NoctisCard,
                    focusedTextColor = NoctisInk,
                    unfocusedTextColor = NoctisInk,
                    focusedBorderColor = NoctisAccent,
                    unfocusedBorderColor = NoctisBorder,
                ),
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(12.dp))

            ExposedDropdownMenuBox(expanded = langMenuExpanded, onExpandedChange = { langMenuExpanded = it }) {
                OutlinedTextField(
                    value = SUPPORTED_LANGUAGES.firstOrNull { it.code == lang }?.label ?: lang,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Idioma de destino", color = NoctisMuted) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = NoctisCard,
                        unfocusedContainerColor = NoctisCard,
                        focusedTextColor = NoctisInk,
                        unfocusedTextColor = NoctisInk,
                        focusedBorderColor = NoctisAccent,
                        unfocusedBorderColor = NoctisBorder,
                    ),
                    modifier = Modifier.menuAnchor().fillMaxWidth(),
                )
                ExposedDropdownMenu(expanded = langMenuExpanded, onDismissRequest = { langMenuExpanded = false }) {
                    SUPPORTED_LANGUAGES.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            onClick = { lang = option.code; langMenuExpanded = false },
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            Button(
                onClick = { submit() },
                colors = ButtonDefaults.buttonColors(containerColor = NoctisAccent, contentColor = NoctisBg),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Text("Traduzir →", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
