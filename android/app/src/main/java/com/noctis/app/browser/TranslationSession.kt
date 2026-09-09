package com.noctis.app.browser

/** Mutable settings + callbacks shared between the Compose UI and the JS bridge for one WebView. */
class TranslationSession(
    var sourceLang: String = "auto",
    var targetLang: String = "pt",
    var fontScale: Float = 1f,
    var translateImagesEnabled: Boolean = true,
    var onProgress: (done: Int, total: Int) -> Unit = { _, _ -> },
    var onReady: () -> Unit = {},
)
