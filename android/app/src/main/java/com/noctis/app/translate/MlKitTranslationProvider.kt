package com.noctis.app.translate

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import kotlinx.coroutines.tasks.await

/**
 * Translation backend built on Google ML Kit Translate — on-device neural
 * machine translation. Models (~30MB per language) download once and are
 * cached by the OS across app runs, then translation works fully offline.
 * No API key is required.
 *
 * Known limitations (see docs/LIMITATIONS.md):
 *  - ML Kit ships a single "Chinese" model, not separate Simplified/
 *    Traditional variants like the web app's provider options.
 *  - ML Kit Translate has no built-in "auto-detect" mode; we run the
 *    separate Language Identification model first when `sourceLang == "auto"`.
 *  - Language coverage is whatever ML Kit currently supports on-device —
 *    narrower than a cloud MT API, by design (this is the trade-off for
 *    running fully offline).
 */
class MlKitTranslationProvider(private val wifiOnlyDownloads: () -> Boolean) : TranslationProvider {
    override val id = "mlkit"

    private val languageIdentifier by lazy { LanguageIdentification.getClient() }
    private val translators = mutableMapOf<Pair<String, String>, Translator>()

    private fun toTranslateLanguageCode(iso: String): String? {
        if (iso.startsWith("zh")) return TranslateLanguage.CHINESE
        return TranslateLanguage.fromLanguageTag(iso)
    }

    private suspend fun resolveSourceCode(text: String, sourceLangHint: String): String? {
        if (sourceLangHint != "auto") return toTranslateLanguageCode(sourceLangHint)
        val detected = runCatching { languageIdentifier.identifyLanguage(text).await() }.getOrNull()
        if (detected == null || detected == "und") return null
        return toTranslateLanguageCode(detected)
    }

    private fun getOrCreateTranslator(sourceCode: String, targetCode: String): Translator {
        val key = sourceCode to targetCode
        return translators.getOrPut(key) {
            val options = TranslatorOptions.Builder()
                .setSourceLanguage(sourceCode)
                .setTargetLanguage(targetCode)
                .build()
            Translation.getClient(options)
        }
    }

    override suspend fun translate(texts: List<String>, sourceLang: String, targetLang: String): List<String> {
        if (texts.isEmpty()) return emptyList()
        val targetCode = toTranslateLanguageCode(targetLang) ?: return texts

        return texts.map { text ->
            if (text.isBlank()) return@map text
            runCatching {
                val sourceCode = resolveSourceCode(text, sourceLang) ?: return@map text
                if (sourceCode == targetCode) return@map text

                val translator = getOrCreateTranslator(sourceCode, targetCode)
                val conditions = DownloadConditions.Builder()
                    .apply { if (wifiOnlyDownloads()) requireWifi() }
                    .build()
                translator.downloadModelIfNeeded(conditions).await()
                translator.translate(text).await()
            }.getOrElse { text } // Fallback requirement: never break, keep original text.
        }
    }

    fun close() {
        translators.values.forEach { it.close() }
        translators.clear()
    }
}
