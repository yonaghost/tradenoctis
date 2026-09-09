package com.noctis.app.translate

/**
 * Contract every translation backend must satisfy (mirrors
 * web/src/lib/providers/translation/TranslationProvider.ts).
 */
interface TranslationProvider {
    val id: String

    /** @return translated strings in the same order/length as [texts]. Must never throw for a single bad string — substitute the original instead. */
    suspend fun translate(texts: List<String>, sourceLang: String, targetLang: String): List<String>
}
