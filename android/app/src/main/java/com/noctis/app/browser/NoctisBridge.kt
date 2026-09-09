package com.noctis.app.browser

import android.graphics.Bitmap
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.noctis.app.image.ImagePipeline
import com.noctis.app.translate.TranslationProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream

/**
 * Bridge object exposed to the page's JavaScript as `window.NoctisBridge`
 * (see assets/noctis_inject.js). Every method here is invoked by the
 * WebView on a background thread; results are delivered back into the page
 * asynchronously via `evaluateJavascript`, since ML Kit calls are not
 * instantaneous.
 */
class NoctisBridge(
    private val webView: WebView,
    private val session: TranslationSession,
    private val translationProvider: TranslationProvider,
    private val imagePipeline: ImagePipeline,
    private val scope: CoroutineScope,
) {
    private val json = Json { ignoreUnknownKeys = true }

    @JavascriptInterface
    fun requestTranslateTexts(requestId: String, textsJson: String) {
        scope.launch {
            val texts = runCatching { json.decodeFromString<List<String>>(textsJson) }.getOrElse { emptyList() }
            val translations = if (texts.isEmpty()) {
                emptyList()
            } else {
                runCatching { translationProvider.translate(texts, session.sourceLang, session.targetLang) }
                    .getOrElse { texts }
            }
            resolve(requestId, json.encodeToString(translations))
        }
    }

    @JavascriptInterface
    fun requestTranslateImage(requestId: String, imageUrl: String) {
        scope.launch {
            if (!session.translateImagesEnabled) {
                resolve(requestId, "null")
                return@launch
            }
            val bitmap = runCatching {
                imagePipeline.translateImage(imageUrl, session.sourceLang, session.targetLang, session.fontScale)
            }.getOrNull()
            resolve(requestId, if (bitmap != null) json.encodeToString(bitmapToDataUrl(bitmap)) else "null")
        }
    }

    @JavascriptInterface
    fun reportProgress(done: Int, total: Int) {
        session.onProgress(done, total)
    }

    @JavascriptInterface
    fun reportReady() {
        session.onReady()
    }

    private fun resolve(requestId: String, valueJs: String) {
        val safeId = json.encodeToString(requestId)
        webView.post { webView.evaluateJavascript("window.__noctisResolve($safeId, $valueJs)", null) }
    }

    private fun bitmapToDataUrl(bitmap: Bitmap): String {
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        return "data:image/png;base64,$base64"
    }
}
