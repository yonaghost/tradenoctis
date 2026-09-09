package com.noctis.app.ui.screens

import android.content.Intent
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import com.noctis.app.NoctisApplication
import com.noctis.app.browser.NoctisBridge
import com.noctis.app.browser.NoctisWebViewClient
import com.noctis.app.browser.TranslationSession
import com.noctis.app.image.ImagePipeline
import com.noctis.app.model.SUPPORTED_LANGUAGES
import com.noctis.app.ocr.MlKitOcrProvider
import com.noctis.app.pdf.PdfExporter
import com.noctis.app.translate.MlKitTranslationProvider
import com.noctis.app.ui.theme.*
import com.noctis.app.util.NoctisPreferences
import com.noctis.app.util.normalizeToUrl
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun TranslatorScreen(initialUrl: String, initialLang: String, onBack: () -> Unit) {
    val context = LocalContext.current
    val app = context.applicationContext as NoctisApplication
    val prefs = remember { NoctisPreferences(context) }
    val scope = rememberCoroutineScope()

    var addressText by remember { mutableStateOf(initialUrl) }
    var lang by remember { mutableStateOf(initialLang) }
    var mode by remember { mutableStateOf("translated") }
    var fontScale by remember { mutableStateOf(prefs.fontScale) }
    var progressDone by remember { mutableIntStateOf(0) }
    var progressTotal by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var pdfBusy by remember { mutableStateOf(false) }
    var navRevision by remember { mutableIntStateOf(0) } // bump to refresh canGoBack/Forward reads

    val session = remember { TranslationSession(targetLang = initialLang, fontScale = prefs.fontScale, translateImagesEnabled = prefs.translateImages) }
    val ocrProvider = remember { MlKitOcrProvider() }
    val translationProvider = remember { MlKitTranslationProvider(wifiOnlyDownloads = { prefs.wifiOnlyModelDownloads }) }
    val imagePipeline = remember { ImagePipeline(context, app.database, ocrProvider, translationProvider) }
    val injectedJs = remember {
        context.assets.open("noctis_inject.js").bufferedReader().use { it.readText() }
    }

    val webView = remember {
        WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
        }
    }

    LaunchedEffect(webView) {
        session.onProgress = { done, total -> progressDone = done; progressTotal = total }
        session.onReady = { isLoading = false }
        val bridge = NoctisBridge(webView, session, translationProvider, imagePipeline, scope)
        webView.addJavascriptInterface(bridge, "NoctisBridge")
        webView.webViewClient = NoctisWebViewClient(
            injectedJs = injectedJs,
            onPageStarted = {
                progressDone = 0; progressTotal = 0; isLoading = true
                addressText = it
                navRevision++
            },
            onPageFinished = {
                addressText = it
                webView.evaluateJavascript("window.__noctisSetScale && window.__noctisSetScale(${session.fontScale})", null)
                navRevision++
            },
        )
        webView.loadUrl(initialUrl)
    }

    DisposableEffect(Unit) {
        onDispose {
            translationProvider.close()
            webView.destroy()
        }
    }

    fun navigate(url: String) {
        session.targetLang = lang
        webView.loadUrl(url)
    }

    val canGoBack = remember(navRevision) { webView.canGoBack() }
    val canGoForward = remember(navRevision) { webView.canGoForward() }

    Column(modifier = Modifier.fillMaxSize().background(NoctisBg)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.Home, contentDescription = "Início", tint = NoctisMuted) }
            IconButton(onClick = { webView.goBack() }, enabled = canGoBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar", tint = NoctisMuted)
            }
            IconButton(onClick = { webView.goForward() }, enabled = canGoForward) {
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Avançar", tint = NoctisMuted)
            }
            IconButton(onClick = { webView.reload() }) {
                Icon(Icons.Filled.Refresh, contentDescription = "Recarregar", tint = NoctisMuted)
            }

            OutlinedTextField(
                value = addressText,
                onValueChange = { addressText = it },
                singleLine = true,
                modifier = Modifier.weight(1f).padding(horizontal = 4.dp),
                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Go),
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(onGo = { navigate(normalizeToUrl(addressText)) }),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = NoctisCard,
                    unfocusedContainerColor = NoctisCard,
                    focusedTextColor = NoctisInk,
                    unfocusedTextColor = NoctisInk,
                ),
            )

            var langMenuExpanded by remember { mutableStateOf(false) }
            Box {
                IconButton(onClick = { langMenuExpanded = true }) {
                    Icon(Icons.Filled.Language, contentDescription = "Idioma", tint = NoctisMuted)
                }
                DropdownMenu(expanded = langMenuExpanded, onDismissRequest = { langMenuExpanded = false }) {
                    SUPPORTED_LANGUAGES.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            onClick = {
                                lang = option.code
                                session.targetLang = option.code
                                prefs.targetLanguage = option.code
                                langMenuExpanded = false
                                webView.reload()
                            },
                        )
                    }
                }
            }

            IconButton(onClick = {
                pdfBusy = true
                scope.launch {
                    val pdfDir = File(context.cacheDir, "pdfs").apply { mkdirs() }
                    val outFile = File(pdfDir, "pagina-traduzida.pdf")
                    val ok = PdfExporter.export(webView, outFile)
                    pdfBusy = false
                    if (ok) {
                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", outFile)
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, "application/pdf")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        runCatching { context.startActivity(intent) }
                    }
                }
            }, enabled = !pdfBusy) {
                Icon(Icons.Filled.PictureAsPdf, contentDescription = "Baixar PDF", tint = NoctisAccent)
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Switch(
                checked = mode == "translated",
                onCheckedChange = {
                    mode = if (it) "translated" else "original"
                    webView.evaluateJavascript("window.__noctisSetMode && window.__noctisSetMode('${mode}')", null)
                },
                colors = SwitchDefaults.colors(checkedTrackColor = NoctisAccent),
            )
            Text(if (mode == "translated") "Tradução" else "Original", color = NoctisInk, fontSize = 13.sp)

            Spacer(Modifier.width(16.dp))

            Text("Fonte", color = NoctisMuted, fontSize = 12.sp)
            Slider(
                value = fontScale,
                onValueChange = {
                    fontScale = it
                    session.fontScale = it
                    prefs.fontScale = it
                    webView.evaluateJavascript("window.__noctisSetScale && window.__noctisSetScale($it)", null)
                },
                valueRange = 0.7f..1.8f,
                modifier = Modifier.width(120.dp),
                colors = SliderDefaults.colors(thumbColor = NoctisAccent, activeTrackColor = NoctisAccent),
            )

            Spacer(Modifier.weight(1f))

            if (isLoading || progressTotal > 0) {
                Text(
                    if (isLoading && progressTotal == 0) "Traduzindo…" else "Imagens: $progressDone/$progressTotal",
                    color = NoctisMuted,
                    fontSize = 11.sp,
                )
            }
        }

        Box(modifier = Modifier.weight(1f)) {
            AndroidView(factory = { webView }, modifier = Modifier.fillMaxSize())
        }
    }
}
